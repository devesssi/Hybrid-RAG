import { getDb } from "./db/index";
import { documents, documentChunks } from "./db/schema";
import { getEmbedding } from "../lib/ai";

interface ProcessDocumentInput {
  title: string;
  sourceUrl?: string;
  rawText: string;
}

const CHILD_CHUNK_WORDS = 120;
const CHILD_CHUNK_OVERLAP_WORDS = 24;

function splitIntoChildChunks(text: string): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  if (words.length <= CHILD_CHUNK_WORDS) return words.length ? [words.join(" ")] : [];

  const chunks: string[] = [];
  const step = CHILD_CHUNK_WORDS - CHILD_CHUNK_OVERLAP_WORDS;
  for (let start = 0; start < words.length; start += step) {
    const chunk = words.slice(start, start + CHILD_CHUNK_WORDS).join(" ");
    if (chunk) chunks.push(chunk);
    if (start + CHILD_CHUNK_WORDS >= words.length) break;
  }
  return chunks;
}

export async function ingestDocument({ title, sourceUrl, rawText }: ProcessDocumentInput) {
  try {
    const db = getDb();
    console.log(`🚀 Starting optimized ingestion for: "${title}" (${rawText.length} characters)`);

    // 1. Initialize parent document entry
    const [insertedDoc] = await db.insert(documents).values({
      title,
      sourceUrl,
    }).returning({ id: documents.id });

    if (!insertedDoc) throw new Error("Failed to register document master record.");
    const documentId = insertedDoc.id;

    // 2. Keep paragraphs as parent context, then create overlapping child windows.
    const paragraphs = rawText
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    // Staging array to collect all rows for a single bulk database insert
    const insertPayload: Array<{
      documentId: string;
      content: string;
      parentContent: string;
      embedding: number[];
    }> = [];

    // 3. Flatten and build individual execution tasks
    for (const paragraph of paragraphs) {
      for (const childChunk of splitIntoChildChunks(paragraph)) {
        insertPayload.push({
          documentId,
          content: childChunk,
          parentContent: paragraph,
          embedding: [], 
        });
      }
    }

    console.log(`📦 Prepared ${insertPayload.length} distinct child chunks. Processing vectors...`);

    // 4. Concurrency Control: Adjusted to smaller slices and longer cool-down intervals
    const BATCH_SIZE = 10;
    for (let i = 0; i < insertPayload.length; i += BATCH_SIZE) {
      const currentBatch = insertPayload.slice(i, i + BATCH_SIZE);
      
      console.log(`⏳ Processing vector slice: ${i} to ${Math.min(i + BATCH_SIZE, insertPayload.length)}...`);

      // Resolve embeddings concurrently for the active safe slice
      await Promise.all(
        currentBatch.map(async (item) => {
          item.embedding = await getEmbedding(item.content);
        })
      );

      // Sustainable cooling period to respect free tier RPM limits
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }

    // 5. Bulk Database Write: Insert everything in chunks of 200 items in a single step
    const DB_BULK_SIZE = 200;
    console.log(`\n💾 Streaming chunks directly into PostgreSQL...`);
    
    for (let i = 0; i < insertPayload.length; i += DB_BULK_SIZE) {
      const dbBatch = insertPayload.slice(i, i + DB_BULK_SIZE);
      await db.insert(documentChunks).values(dbBatch);
    }

    console.log(`\n✅ Hierarchical ingestion complete. Active entries registered: ${insertPayload.length}`);
    return documentId;

  } catch (error) {
    console.error("❌ Critical batch ingestion layout crash:", error);
    throw error;
  }
}
