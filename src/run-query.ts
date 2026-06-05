// src/run-query.ts
import { queryRAG } from "./query.js";

async function main() {
  // Grab prompt from terminal argument or fall back to a default question
  const question = process.argv.slice(2).join(" ") || "what is this document about ? ";

  console.log(`\n👤 User Question: "${question}"\n`);
  
  const result = await queryRAG(question, { topK: 4 });

  console.log(`\n✨ Final Response:\n`);
  console.log(result.answer);
  console.log(`\n==================================================\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});