import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import * as dotenv from "dotenv";
dotenv.config(); 

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" }); 
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generates a vector embedding for a given text snippet using Google GenAI.
 * Includes built-in exponential backoff to handle 429 rate limits and connection timeouts.
 */
export async function getEmbedding(text: string, attempt = 1): Promise<number[]> {
  const MAX_RETRIES = 5;
  const BASE_DELAY = 3000; // 3 seconds base fallback

  try {
    const response = await ai.models.embedContent({
      model: "gemini-embedding-2-preview",
      contents: { parts: [{ text }] }, 
      config: {
        outputDimensionality: 1536 
      }
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

    // Detect Rate Limits (429) or Network Timeouts/Fetch drops
    const isRateLimit = errorStatus === 429 || errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED");
    const isNetworkTimeout = error.code === "UND_ERR_CONNECT_TIMEOUT" || errorMessage.toLowerCase().includes("fetch failed");

    if (isRateLimit || isNetworkTimeout) {
      if (attempt > MAX_RETRIES) {
        console.error(`\n❌ Exceeded maximum retry attempts (${MAX_RETRIES}) due to persistent API/Network issues.`);
        throw error;
      }

      // Calculate exponential backoff delay with a random jitter
      let delayMs = BASE_DELAY * Math.pow(2, attempt) + Math.random() * 1000;
      
      if (isRateLimit) {
        // Dynamically parse out Google's explicit cooldown hint (e.g., "Please retry in 21.61s")
        const match = errorMessage.match(/retry in\s+([\d.]+)\s*s/i);
        if (match && match[1]) {
          delayMs = (parseFloat(match[1]) + 2) * 1000; // Add a 2-second safety buffer
        }
        console.warn(`\n⚠️ Rate limit hit (429). Retrying in ${(delayMs / 1000).toFixed(2)}s... (Attempt ${attempt}/${MAX_RETRIES})`);
      } else {
        console.warn(`\n📡 Network connection timeout. Retrying in ${(delayMs / 1000).toFixed(2)}s... (Attempt ${attempt}/${MAX_RETRIES})`);
      }

      await sleep(delayMs);
      return getEmbedding(text, attempt + 1); // Recurse
    }

    console.error("Error generating Google embedding:", error);
    throw error;
  }
}

/**
 * Takes the extracted context chunks and the user prompt, 
 * then generates a fast completion using Groq.
 */
export async function generateAnswer(prompt: string, context: string): Promise<string> {
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
}