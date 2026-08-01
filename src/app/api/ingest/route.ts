import { NextResponse } from "next/server";
import { createRequire } from "node:module";
import { ingestDocument } from "../../../ingest";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const require = createRequire(import.meta.url);

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
    // pdf-parse ships its Node canvas setup separately. It must run first on
    // Vercel, where Node does not provide DOMMatrix by default.
    const { getData } = require("pdf-parse/worker") as typeof import("pdf-parse/worker");
    const { PDFParse } = require("pdf-parse") as typeof import("pdf-parse");
    // Use the package's self-contained worker data URL. The default worker path
    // is a sibling file that Vercel's output tracer does not retain.
    PDFParse.setWorker(getData());

    // This stays a Node require so Next does not choose the browser export.
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
