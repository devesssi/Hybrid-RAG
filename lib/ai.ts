import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import * as dotenv from "dotenv";
import { traceable } from "langsmith/traceable"; 
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generates a vector embedding for a given text snippet using Google GenAI.
 * Wrapped with LangSmith traceable as an 'embedding' run type.
 */
export const getEmbedding = traceable(
  async (text: string, attempt = 1): Promise<number[]> => {
    const MAX_RETRIES = 5;
    const BASE_DELAY = 3000;

    try {
      const response = await ai.models.embedContent({
        model: "gemini-embedding-2-preview",
        contents: { parts: [{ text }] },
        config: {
          outputDimensionality: 1536,
        },
      });

      if (!response.embeddings || response.embeddings.length === 0) {
        throw new Error("Failed to retrieve embeddings from Google API.");
      }

      const firstEmbedding = response.embeddings[0];
      if (!firstEmbedding || !firstEmbedding.values) {
        throw new Error("Embedding values are missing from response payload.");
      }

      return firstEmbedding.values;
    } catch (error: any) {
      const errorMessage = error.message || "";
      const errorStatus = error.status || (error.error && error.error.code);

      const isRateLimit =
        errorStatus === 429 ||
        errorMessage.includes("429") ||
        errorMessage.includes("RESOURCE_EXHAUSTED");
      const isNetworkTimeout =
        error.code === "UND_ERR_CONNECT_TIMEOUT" ||
        errorMessage.toLowerCase().includes("fetch failed");

      if (isRateLimit || isNetworkTimeout) {
        if (attempt > MAX_RETRIES) {
          console.error(
            `\n❌ Exceeded maximum retry attempts (${MAX_RETRIES}) due to persistent API/Network issues.`
          );
          throw error;
        }

        let delayMs = BASE_DELAY * Math.pow(2, attempt) + Math.random() * 1000;

        if (isRateLimit) {
          const match = errorMessage.match(/retry in\s+([\d.]+)\s*s/i);
          if (match && match[1]) {
            delayMs = (parseFloat(match[1]) + 2) * 1000;
          }
          console.warn(
            `\n⚠️ Rate limit hit (429). Retrying in ${(delayMs / 1000).toFixed(
              2
            )}s... (Attempt ${attempt}/${MAX_RETRIES})`
          );
        } else {
          console.warn(
            `\n📡 Network connection timeout. Retrying in ${(
              delayMs / 1000
            ).toFixed(2)}s... (Attempt ${attempt}/${MAX_RETRIES})`
          );
        }

        await sleep(delayMs);
        // Recursive calls automatically nest under the parent run in LangSmith
        return getEmbedding(text, attempt + 1);
      }

      console.error("Error generating Google embedding:", error);
      throw error;
    }
  },
  { name: "Gemini_Embedding", run_type: "embedding" }
);

/**
 * Takes the extracted context chunks and the user prompt,
 * then generates a fast completion using Groq.
 * Wrapped with LangSmith traceable as an 'llm' run type.
 */
export const generateAnswer = traceable(
  async (prompt: string, context: string): Promise<string> => {
    try {
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are an advanced engineering assistant. Use the following context blocks to answer the user's question accurately. If you don't know the answer based on the context, state that clearly.
            
Context:
${context}`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
      });

      return response.choices[0]?.message?.content || "No response generated.";
    } catch (error) {
      console.error("Groq generation failed:", error);
      throw error;
    }
  },
  { name: "Groq_Generation", run_type: "llm" }
);

/**
 * Parent execution pipeline.
 * Wrapping this combines your embedding step and your generation step
 * into a single unified execution tree in your LangSmith dashboard.
 */
export const runRAGPipeline = traceable(
  async (
    prompt: string,
    fetchContextCallback: (vector: number[]) => Promise<string>
  ): Promise<string> => {
    // 1. Get the embedding via Gemini
    const embedding = await getEmbedding(prompt);

    // 2. Retrieve your data chunks from your vector store using the embedding
    const context = await fetchContextCallback(embedding);

    // 3. Generate the speed-optimized response via Groq
    const answer = await generateAnswer(prompt, context);

    return answer;
  },
  { name: "Full_RAG_Pipeline", run_type: "chain" }
);