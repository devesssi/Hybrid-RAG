import { db } from "./db/index";
import { documentChunks } from "./db/schema";
import { getEmbedding } from "../lib/ai";
import { sql, cosineDistance } from "drizzle-orm";
import { traceable } from "langsmith/traceable";

interface SearchResult {
  id: string;
  content: string;
  score: number;
}

// 1. Hardened Child Trace: Keyword FTS with Relevance Ranking
const keywordSearchStep = traceable(
  async (queryText: string, limit: number) => {
    return db
      .select({
        id: documentChunks.id,
        content: documentChunks.content,
        parentContent: documentChunks.parentContent,
        // Calculate literal text match density
        ftsRank: sql<number>`ts_rank(to_tsvector('english', ${documentChunks.content}), websearch_to_tsquery('english', ${queryText}))`,
      })
      .from(documentChunks)
      .where(
        sql`to_tsvector('english', ${documentChunks.content}) @@ websearch_to_tsquery('english', ${queryText})`
      )
      .orderBy(sql`ts_rank(to_tsvector('english', ${documentChunks.content}), websearch_to_tsquery('english', ${queryText})) DESC`)
      .limit(limit);
  },
  { name: "PostgreSQL Keyword FTS", run_type: "retriever" }
);

// 2. Isolated Child Trace: Semantic Vector Search with Leak Prevention
const vectorSearchStep = traceable(
  async (queryVector: number[], limit: number) => {
    return db
      .select({
        id: documentChunks.id,
        content: documentChunks.content,
        parentContent: documentChunks.parentContent,
      })
      .from(documentChunks)
      // Guardrail: Cosine Distance <= 0.30 translates to a Similarity Score >= 0.70
      .where(sql`${cosineDistance(documentChunks.embedding, queryVector)} <= 0.30`)
      .orderBy(cosineDistance(documentChunks.embedding, queryVector))
      .limit(limit);
  },
  { name: "pgvector Semantic Search", run_type: "retriever" }
);

// 3. Main Exported Traceable Hybrid Retriever
export const hybridRetrieve = traceable(
  async function hybridRetrieve(
    queryText: string,
    limit: number = 5
  ): Promise<SearchResult[]> {
    
    // Concurrent Execution: Embed user query and hit the Keyword FTS Index
    const [queryVector, textMatches] = await Promise.all([
      getEmbedding(queryText),
      keywordSearchStep(queryText, limit),
    ]);

    // Compute Semantic Matching on child vectors (bounded by similarity threshold)
    const vectorMatches = await vectorSearchStep(queryVector, limit);

    // ⚡ SEMANTIC GATE: If vector space returns ZERO valid matches, the query is out-of-bounds.
    // Discard text matches that are just catching generic filler words (low ftsRank).
    const filteredTextMatches = textMatches.filter((item) => {
      if (vectorMatches.length === 0) {
        // Require a high-density keyword hit if the query lacks semantic alignment
        return item.ftsRank >= 0.1; 
      }
      return true;
    });

    // Reciprocal Rank Fusion (RRF) Blending Layer
    const rrfMap = new Map<string, { contextPayload: string; score: number }>();
    const K = 60;

    const scoreStream = (
      matches: Array<{ id: string; content: string; parentContent: string | null }>,
      weightMultiplier: number
    ) => {
      matches.forEach((item, index) => {
        const rank = index + 1;
        const reciprocalScore = (1 / (K + rank)) * weightMultiplier;

        const existing = rrfMap.get(item.id);
        if (existing) {
          existing.score += reciprocalScore;
        } else {
          const bestContext =
            item.parentContent && item.parentContent.trim() !== ""
              ? item.parentContent
              : item.content;

          rrfMap.set(item.id, {
            contextPayload: bestContext,
            score: reciprocalScore,
          });
        }
      });
    };

    // Blend the gated pipelines
    scoreStream(vectorMatches, 1.2);
    scoreStream(filteredTextMatches, 1.0);

    // Sort and hand the finalized RRF matrix back to the engine
    return Array.from(rrfMap.entries())
      .map(([id, data]) => ({
        id,
        content: data.contextPayload,
        score: data.score,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },
  { name: "Hybrid Retrieval Architecture (RRF)", run_type: "retriever" }
);