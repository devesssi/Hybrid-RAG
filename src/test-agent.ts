// src/test-agent.ts
import { conversationalEngine } from "../lib/engine.js";

async function runTestSession() {
  const thread_id = "local-session-test-001";
  const config = { configurable: { thread_id } };

  console.log("🚀 Initializing Stateful Hybrid RAG Verification Loop...");

  // Turn 1: Establish base technical context
  console.log("\n==================== TURN 1 ====================");
  console.log("User: What is Mini Claude?");
  
  let state = await conversationalEngine.invoke(
    { messages: [{ role: "user", content: "What is the summary of the document name mini claude?" }] },
    config
  );
  console.log(`\nAI Response:\n${state.finalAnswer}`);

  // Turn 2: Follow up using ambiguous terms ("it")
  console.log("\n==================== TURN 2 ====================");
  console.log("User: What are the main features of project management?");
  
  state = await conversationalEngine.invoke(
    { messages: [{ role: "user", content: "What are the main features of project management?" }] },
    config
  );
  
  console.log(`\n⚙️ LangGraph Query Optimizer Output: "${state.optimizedQuery}"`);
  console.log(`\nAI Response:\n${state.finalAnswer}`);
  console.log(`📦 Citations Collected: ${state.citations.length} RRF Blocks`);
}

runTestSession().catch((err) => {
  console.error("Critical test runner crash:", err);
  process.exit(1);
});