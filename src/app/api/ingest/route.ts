// src/app/api/ingest/route.ts
import { NextResponse } from "next/server";
import { ingestDocument } from "../../../ingest";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No document file detected in request payload." }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported." }, { status: 415 });
    }

    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Upload a PDF between 1 byte and 10 MB." }, { status: 413 });
    }

    console.log(`📡 API received upload request for file: ${file.name}`);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    console.log(`📄 Extracting structural text layout natively via pdfjs-dist...`);

    // Instantiate document loading directly out of the binary byte array
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      disableWorker: true,
      useWorkerFetch: false,
      isEvalSupported: false,
    });
    
    const pdfDoc = await loadingTask.promise;
    let extractedText = "";

    // Iteratively extract and stitch plain-text contents page by page
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        // @ts-ignore
        .map((item) => item.str)
        .join(" ");
      
      extractedText += pageText + "\n";
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json({ error: "The uploaded PDF contains no processable text context." }, { status: 400 });
    }

    // Forward raw context stream straight into your database chunking infrastructure
    console.log(`📦 Forwarding text stream to ingestion pipeline...`);
    const documentId = await ingestDocument({
      title: file.name.replace(/\.[^/.]+$/, ""), // Strip file extension
      rawText: extractedText,
    });

    return NextResponse.json({
      success: true,
      message: "Document successfully indexed into vector database.",
      documentId,
    });

  } catch (error: any) {
    console.error("❌ Critical API Ingestion Endpoint Failure:", error);
    return NextResponse.json(
      { error: error.message || "Internal server infrastructure processing error." },
      { status: 500 }
    );
  }
}
