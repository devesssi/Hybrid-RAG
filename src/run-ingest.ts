// src/run-ingest.ts
import { parseAndIngestDirectory } from "./parser.js";
import path from "path";

async function main() {
  // Point to a directory containing your real markdown or text files
  const dataFolder = path.join(process.cwd(), "knowledge-base");

  console.log("🚀 Initializing Batch Document Ingestion Layer...");
  await parseAndIngestDirectory({ dirPath: dataFolder });
}

main().catch((err) => {
  console.error("🚨 Critical Ingestion Failure:", err);
  process.exit(1);
});