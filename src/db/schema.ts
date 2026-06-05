import { index, pgTable, text, timestamp, uuid, vector } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// 1. Parent Documents Metadata Table
export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  sourceUrl: text("source_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 2. Child Document Chunks Table
export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .references(() => documents.id, { onDelete: "cascade" })
      .notNull(),
    content: text("content").notNull(),
    parentContent: text("parent_content"), // Excellent structural placeholder for Parent-Child RAG
    embedding: vector("embedding", { dimensions: 1536 }),
  },
  (table) => [
    // ⚡ Flawless HNSW Index for rapid semantic Approximate Nearest Neighbor (ANN) search
    index("chunk_vector_hnsw_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
    
    // ⚡ NEW: GIN Functional Index to make your Full-Text Search keyword engine lightning fast
    index("chunk_fts_idx").using("gin", sql`to_tsvector('english', ${table.content})`),

    // ⚡ NEW: Standard B-Tree index on the Foreign Key to optimize metadata pre-filtering queries
    index("chunk_document_id_idx").on(table.documentId),
  ]
);