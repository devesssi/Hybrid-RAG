import { NextResponse } from "next/server";
import { ingestDocument } from "../../../ingest";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No document file detected in request payload." }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported." }, { status: 415 });
    }

    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Upload a PDF between 1 byte and 4 MB." }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const { PDFParse } = await import("pdf-parse");

    // pdf-parse initializes Node canvas polyfills before it loads PDF.js.
    // That avoids browser-only globals (such as DOMMatrix) on Vercel.
    const parser = new PDFParse({ data: new Uint8Array(bytes) });
    const textResult = await parser.getText();
    await parser.destroy();
    const extractedText = textResult.text.trim();

    if (!extractedText) {
      return NextResponse.json({ error: "The uploaded PDF contains no processable text context." }, { status: 400 });
    }

    const documentId = await ingestDocument({
      title: file.name.replace(/\.[^/.]+$/, ""),
      rawText: extractedText,
    });

    return NextResponse.json({
      success: true,
      message: "Document successfully indexed into vector database.",
      documentId,
    });
  } catch (error: unknown) {
    console.error("PDF ingestion failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The document could not be processed." },
      { status: 500 }
    );
  }
}
