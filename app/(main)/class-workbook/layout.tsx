import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Class workbook — NourishAI",
  description:
    "In-class notes and live class assistant (Groq) for students on the NourishAI site.",
};

export default function ClassWorkbookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
