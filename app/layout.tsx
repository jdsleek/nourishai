import type { Metadata } from "next";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "NourishAI — Food, calories & AI nutrition coach",
  description:
    "Personalized calorie targets, meal plans, food tracking, and an AI nutrition coach for weight loss or weight gain.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <Nav />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mt-16 border-t border-stone-200/70 py-8 text-center text-sm text-stone-500 dark:border-stone-800 dark:text-stone-500">
          NourishAI — for educational use only. Not medical advice.
        </footer>
      </body>
    </html>
  );
}
