// src/query.ts
import { sql } from "drizzle-orm";
import { db } from "./db/index.js";
import { documentChunks } from "./db/schema.js";
import { getEmbedding, generateAnswer } from "../lib/ai.js";

interface QueryOptions {
  topK?: number;
  minSimilarity?: number;
}

export async function queryRAG(question: string, options: QueryOptions = {}) {
  const topK = options.topK || 5;
  
  try {
    // 1. Generate the vector embedding for the incoming user query
    const queryVector = await getEmbedding(question);
    
    // Convert numerical array to the string format pgvector expects: '[0.123, 0.456, ...]'
    const vectorString = `[${queryVector.join(",")}]`;

    // 2. Compute Cosine Similarity (1 - Cosine Distance) via Drizzle sql template
    // pgvector '<=>' operator computes cosine distance
    const similarityScore = sql<number>`1 - (${documentChunks.embedding} <=> ${vectorString})`;

    console.log(`🔍 Searching vector space for closest matching blocks...`);
    const matches = await db
      .select({
        content: documentChunks.content,
        parentContent: documentChunks.parentContent,
        similarity: similarityScore,
      })
      .from(documentChunks)
      .orderBy(sql`${documentChunks.embedding} <=> ${vectorString}`) // Order by closest distance
      .limit(topK);

    if (matches.length === 0) {
      return {
        answer: "No relevant context found within the database to answer this question.",
        sources: [],
      };
    }

    // Print out matching blocks and scores for debugging telemetry
    console.log(`\n📚 Found ${matches.length} relevant context chunks:`);
    matches.forEach((match, index) => {
      console.log(`   [${index + 1}] Score: ${(match.similarity * 100).toFixed(2)}% | Content: "${match.content.substring(0, 60)}..."`);
    });

    // 3. Aggregate the contents into a cohesive context payload
    const contextPayload = matches
      .map((match) => `Chunk: ${match.content}\nContext Group: ${match.parentContent}`)
      .join("\n\n---\n\n");

    // 4. Fire the prompt + context over to Groq
    console.log(`\n🤖 Sending payload to Groq (llama-3.3-70b-versatile)...`);
    const answer = await generateAnswer(question, contextPayload);

    return {
      answer,
      sources: matches,
    };

  } catch (error) {
    console.error("❌ RAG Query Execution Failure:", error);
    throw error;
  }
}