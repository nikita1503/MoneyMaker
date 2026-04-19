import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MoneyMaker",
  description: "Find companies that need websites, build them, sell them.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
