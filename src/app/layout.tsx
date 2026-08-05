import type { Metadata } from "next";
import { Baloo_2, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

const baloo = Baloo_2({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-baloo",
});
const thai = IBM_Plex_Sans_Thai({
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-thai",
});

export const metadata: Metadata = {
  title: "THE ABLE SECRET TEAM",
  description: "เกมจับทีมลับสำหรับพนักงาน — 3 ทีมลับ ใครคือศัตรูตัวจริง?",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${baloo.variable} ${thai.variable}`}>
      <body className="font-sans text-ink min-h-screen">{children}</body>
    </html>
  );
}
