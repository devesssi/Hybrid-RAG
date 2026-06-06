// src/app/api/chat/route.ts
import { NextResponse } from "next/server";
import { conversationalEngine } from "../../../../lib/engine"; // Adjust path to target your compiled LangGraph
import { traceable } from "langsmith/traceable";

// Encapsulate the LangGraph execution block so LangSmith captures the entry inputs and outputs
const traceEngineInvoke = traceable(
  async (message: string, conversationId: string) => {
    // Bind execution context to the distinct conversational thread session
    const config = { configurable: { thread_id: conversationId } };

    return await conversationalEngine.invoke(
      {
        messages: [{ role: "user", content: message }],
      },
      config
    );
  },
  { name: "LangGraph Chat Execution Engine", run_type: "chain" }
);

export async function POST(req: Request) {
  try {
    const { message, conversationId } = await req.json();

    if (!message || !conversationId) {
      return NextResponse.json(
        { error: "Missing required arguments: 'message' and 'conversationId' must be supplied." },
        { status: 400 }
      );
    }

    console.log(`💬 Processing API chat request for session context: [${conversationId}]`);

    // Invoke your LangGraph state architecture wrapped in the tracking layout
    const finalState = await traceEngineInvoke(message, conversationId);

    // Ship back the structured answer along with vector citation scores to feed the UI
    return NextResponse.json({
      success: true,
      answer: finalState.finalAnswer,
      citations: finalState.citations || [],
    });

  } catch (error: any) {
    console.error("❌ Critical Chat API Architecture Failure:", error);
    return NextResponse.json(
      { error: error.message || "Internal network agent processing error." },
      { status: 500 }
    );
  }
}