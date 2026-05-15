import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Qubators · NourishAI",
  description:
    "Class slides, workbook, and AI-powered nutrition tools — for educational use only.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
