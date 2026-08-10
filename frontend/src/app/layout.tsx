import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Veil — Talk freely. Reveal selectively.",
  description:
    "Connect in anonymous spaces. Build trust. Reveal your identity only when you're ready.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
