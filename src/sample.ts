import { ingestDocument } from "./ingest.js";
import { askEngine } from "../lib/engine.js"; // Adjusted path to your orchestrator

async function runDiagnostics() {
  console.log("⚡ Starting Hierarchical RAG Engine Test Lifecycle...\n");
  
  // 1. Provide a multi-sentence, multi-paragraph text block to test sentence-splitting
  const sampleText = 
    "Verbamind's advanced architecture utilizes Drizzle ORM combined with pgvector. " +
    "This architecture setup allows the system to store high-dimensional embeddings natively within PostgreSQL. " +
    "By leveraging Groq's speculative decoding, localized data streams are processed instantly with sub-100ms latency.\n\n" +
    "For system configuration management, the engine relies on strict environment files loaded at runtime. " +
    "This profile processing ensures that sensitive API keys for Gemini and Groq remain securely isolated.";

  console.log("📥 Testing data ingestion...");
  
  // Align with the object-based interface of your new ingest pipeline
  await ingestDocument({
    title: "Verbamind Core Architecture Specs",
    sourceUrl: "https://internal.verbamind.ai/docs",
    rawText: sampleText
  });

  // 2. Add a tiny delay for DB indexing to settle
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 3. Fire a precise search query against the engine
  const query = "exactly how is drizzle used in the system?";
  console.log(`\n🔍 Querying Engine via RRF Pipeline: "${query}"`);
  
  try {
    const response = await askEngine(query);
    console.log("\n🤖 Engine Response:");
    console.log("----------------------------------------");
    console.log(response);
    console.log("----------------------------------------");
    console.log("\n🎉 Diagnostic test completed successfully!");
  } catch (error) {
    console.error("\n❌ Diagnostic test failed:", error);
  }
}

runDiagnostics();