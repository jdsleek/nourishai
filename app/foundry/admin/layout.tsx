import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Foundry — Admin",
  robots: { index: false, follow: false },
};

export default function FoundryAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
