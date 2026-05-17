import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Class hub — Qubators AI Foundry",
  description: "Student links for slides, submission portal, and class workbook.",
  robots: { index: false, follow: false },
};

export default function ClassHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
