// src/parser.ts
import fs from "fs/promises";
import path from "path";
import { ingestDocument } from "./ingest.js";

// 1. Standard CommonJS bridge setup
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfModule = require("pdf-parse");

/**
 * Polyfill extractor that handles both legacy functional pdf-parse 
 * and modern class-based forks seamlessly, guaranteeing a string return.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  let rawResult: any = null;

  // Variant A: Modern Class-based structure (e.g., mehmet-kozan fork)
  const PDFParseClass = pdfModule.PDFParse || (pdfModule.default && pdfModule.default.PDFParse);
  if (PDFParseClass && typeof PDFParseClass === "function") {
    try {
      const parser = new PDFParseClass(buffer);
      rawResult = typeof parser.getText === "function" ? await parser.getText() : parser;
    } catch {
      const parser = new PDFParseClass({ data: buffer });
      rawResult = typeof parser.getText === "function" ? await parser.getText() : parser;
    }
  }

  // Variant B: Traditional functional style (Legacy pdf-parse)
  if (!rawResult) {
    const standardFn = typeof pdfModule === "function" 
      ? pdfModule 
      : (pdfModule && typeof pdfModule.default === "function" ? pdfModule.default : null);

    if (standardFn) {
      rawResult = await standardFn(buffer);
    }
  }

  if (!rawResult) {
    throw new Error("Unable to locate a matching pdf-parse function or constructor format.");
  }

  // Pure Defensive Extraction Layer: Guarantee a primitive string output
  if (typeof rawResult === "string") {
    return rawResult;
  }
  
  if (rawResult && typeof rawResult === "object") {
    if (typeof rawResult.text === "string") return rawResult.text;
    if (rawResult.text) return String(rawResult.text);
  }

  return String(rawResult);
}

interface ParseDirectoryOptions {
  dirPath: string;
}

/**
 * Reads Markdown, Text, and PDF files from a folder and runs hierarchical ingestion
 */
export async function parseAndIngestDirectory({ dirPath }: ParseDirectoryOptions): Promise<void> {
  try {
    const resolvedPath = path.resolve(dirPath);
    const files = await fs.readdir(resolvedPath);
    
    const targetFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ext === ".md" || ext === ".txt" || ext === ".pdf";
    });

    console.log(`📂 Found ${targetFiles.length} valid documents in [${dirPath}]`);

    if (targetFiles.length === 0) {
      console.log("⚠️ No documents to process. Exiting parser.");
      return;
    }

    for (const filename of targetFiles) {
      const fullPath = path.join(resolvedPath, filename);
      const ext = path.extname(filename).toLowerCase();
      console.log(`\n📄 Processing file: ${filename} (${ext.toUpperCase()})`);

      let rawText = "";

      if (ext === ".pdf") {
        const pdfBuffer = await fs.readFile(fullPath);
        rawText = await extractPdfText(pdfBuffer);
      } else {
        rawText = await fs.readFile(fullPath, "utf-8");
      }

      // Safe now: rawText is guaranteed to be a pure string primitive
      const normalizedContent = rawText.replace(/\r\n/g, "\n").trim();

      const title = path.basename(filename, path.extname(filename))
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, char => char.toUpperCase());

      await ingestDocument({
        title,
        sourceUrl: `file://${fullPath}`,
        rawText: normalizedContent
      });
    }

    console.log("\n🎯 Directory batch ingestion completed successfully!");

  } catch (error) {
    console.error("❌ Directory parsing loop failed:", error);
    throw error;
  }
}