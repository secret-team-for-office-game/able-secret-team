import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "THE ABLE SECRET TEAM", description: "เกมจับทีมลับ" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="th"><body className="font-sans text-ink min-h-screen">{children}</body></html>);
}
