import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trainer console",
  robots: { index: false, follow: false },
};

export default function FacilitatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
