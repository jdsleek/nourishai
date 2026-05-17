import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Class hub — AI Foundry",
  description: "Learner slides, workbook, and submission portal.",
  robots: { index: false, follow: false },
};

export default function ClassLayout({ children }: { children: React.ReactNode }) {
  return children;
}
