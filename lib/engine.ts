// lib/engine.ts
import { StateGraph, Annotation, MemorySaver } from "@langchain/langgraph";
import { hybridRetrieve } from "../src/retrieve"; 
import { generateAnswer } from "./ai"; 
import Groq from "groq-sdk";
import * as dotenv from "dotenv";

dotenv.config();

// Instantiate a local Groq client dedicated to high-speed query optimization
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

// 1. Define the Global State Schema for the Agent
const AgentState = Annotation.Root({
  // Preserves full conversational logs across multi-turn interactions
  messages: Annotation<Array<{ role: "user" | "assistant" | "system"; content: string }>>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  // Holds the RRF-optimized search string derived from history
  optimizedQuery: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  // Stores the final generated grounded response text
  finalAnswer: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  // Packages RRF-ranked database chunks to pass back to the UI for citations
  citations: Annotation<any[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
});

/**
 * Node 1: Contextual Query Rewriter
 * Looks at conversation history to resolve pronouns and context ambiguities.
 */
// Inside lib/engine.ts - Replace the rewriterNode function

async function rewriterNode(state: typeof AgentState.State) {
  const history = state.messages;
  const latestMessage = history[history.length - 1]?.content || "";

  // Skip optimization if it's the opening turn
  if (history.length <= 1) {
    return { optimizedQuery: latestMessage };
  }

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are an advanced search query optimizer for a RAG database.
Analyze the conversation history and the latest user message.

Your job is to output a standalone, descriptive search query.
- If the latest message changes the topic completely, ignore the history and output the latest message keywords.
- If the latest message uses pronouns (it, they, he, she) or implies history, resolve the references to create a full standalone query.
- CRITICAL: Output ONLY the raw search terms. Do NOT wrap your answer in quotes, do NOT add markdown, and do NOT explain your reasoning.`,
        },
        ...history.slice(-6),
      ],
      temperature: 0.1,
    });

    let optimized = response.choices[0]?.message?.content?.trim() || latestMessage;
    
    // Defensive Engineering: Strip any leading/trailing single or double quotes added by the LLM
    optimized = optimized.replace(/^["']|["']$/g, "").trim();

    return { optimizedQuery: optimized };
  } catch (error) {
    console.warn("⚠️ Query rewrite failed, falling back to raw user input:", error);
    return { optimizedQuery: latestMessage };
  }
}
/**
 * Node 2: Hybrid RAG Execution Node
 * Executes your existing RRF retrieval logic and generates the final response.
 */
async function hybridRAGNode(state: typeof AgentState.State) {
  try {
    console.log(`🔍 Processing hybrid query via RRF: "${state.optimizedQuery}"`);

    // 1. Leverage your existing pre-sorted unique chunk retrieval algorithm
    const contextChunks = await hybridRetrieve(state.optimizedQuery, 4);

    // 2. Compile matching text chunks into a single structured string
    const contextString = contextChunks.map((chunk) => chunk.content).join("\n\n");

    if (!contextString) {
      return {
        finalAnswer: "I couldn't find any documents matching your question in the knowledge base.",
        citations: [],
      };
    }

    console.log(`⚡ Injection context compiled (${contextChunks.length} RRF-ranked chunks). Routing to Groq...`);

    // 3. Pipe the curated context straight into your original generation engine
    const finalAnswer = await generateAnswer(state.optimizedQuery, contextString);

    return {
      finalAnswer,
      citations: contextChunks.map((chunk) => ({
        content: chunk.content,
        score: (chunk as any).score || null, // Capture RRF metadata if available
      })),
    };
  } catch (error) {
    console.error("❌ Stateful RAG node execution failed:", error);
    return {
      finalAnswer: "An internal processing error occurred within the conversational pipeline.",
      citations: [],
    };
  }
}

// 3. Chain nodes together into a compilation workflow
const workflow = new StateGraph(AgentState)
  .addNode("rewriter", rewriterNode)
  .addNode("hybridRAG", hybridRAGNode)
  .addEdge("__start__", "rewriter")
  .addEdge("rewriter", "hybridRAG")
  .addEdge("hybridRAG", "__end__");

// Export compiled engine with an internal memory checkpointer for persistence
export const conversationalEngine = workflow.compile({
  checkpointer: new MemorySaver(),
});