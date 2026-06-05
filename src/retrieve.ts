import { db } from "./db/index";
import { documentChunks } from "./db/schema";
import { getEmbedding } from "../lib/ai";
import { sql, cosineDistance } from "drizzle-orm";

interface SearchResult {
  id: string;
  content: string; // This will hold the maximum density context (parent text)
  score: number;
}

export async function hybridRetrieve(queryText: string, limit: number = 5): Promise<SearchResult[]> {
  // 1. Concurrent Execution: Embed user query and hit the Keyword FTS Index
  const [queryVector, textMatches] = await Promise.all([
    getEmbedding(queryText),
    
    db.select({
      id: documentChunks.id,
      content: documentChunks.content,
      parentContent: documentChunks.parentContent, // ⚡ Select parent context
    })
    .from(documentChunks)
    .where(sql`to_tsvector('english', ${documentChunks.content}) @@ websearch_to_tsquery('english', ${queryText})`)
    .limit(limit),
  ]);

  // 2. Compute Semantic Matching on the child vectors
  const vectorMatches = await db.select({
    id: documentChunks.id,
    content: documentChunks.content,
    parentContent: documentChunks.parentContent, // ⚡ Select parent context
  })
  .from(documentChunks)
  .orderBy(cosineDistance(documentChunks.embedding, queryVector))
  .limit(limit);

  // 3. Reciprocal Rank Fusion (RRF) Blending Layer
  const rrfMap = new Map<string, { contextPayload: string; score: number }>();
  const K = 60;

  const scoreStream = (matches: typeof textMatches, weightMultiplier: number) => {
    matches.forEach((item, index) => {
      const rank = index + 1;
      const reciprocalScore = (1 / (K + rank)) * weightMultiplier;

      const existing = rrfMap.get(item.id);
      if (existing) {
        existing.score += reciprocalScore;
      } else {
        // ⚡ CRITICAL: If a parent exists, pass the wide paragraph to Groq. 
        // Otherwise, fall back cleanly to the smaller child chunk text.
        const bestContext = item.parentContent && item.parentContent.trim() !== "" 
          ? item.parentContent 
          : item.content;

        rrfMap.set(item.id, {
          contextPayload: bestContext,
          score: reciprocalScore
        });
      }
    });
  };

  scoreStream(vectorMatches, 1.2);
  scoreStream(textMatches, 1.0);

  // 4. Sort and hand the final RRF matrix back to the engine
  return Array.from(rrfMap.entries()).map(([id, data]) => ({
    id,
    content: data.contextPayload, // Injected context string
    score: data.score
  }))
  .sort((a, b) => b.score - a.score)
  .slice(0, limit);
}