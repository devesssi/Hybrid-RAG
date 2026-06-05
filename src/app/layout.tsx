// src/app/layout.tsx
import React from "react";

export const metadata = {
  title: "Hybrid RAG Engine Dashboard",
  description: "Stateful Hybrid RAG Verification Loop",
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