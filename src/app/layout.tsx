// src/app/layout.tsx
import React from "react";
import "./globals.css";

export const metadata = {
  title: "VerbaMind | Grounded document intelligence",
  description: "Upload a document, ask questions, and inspect the sources behind every answer.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, backgroundColor: "#0a0a0a", color: "#fff" }}>
        {children}
      </body>
    </html>
  );
}
