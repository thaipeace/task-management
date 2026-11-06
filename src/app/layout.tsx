import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/toaster";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "vietnamese"] });

export const metadata: Metadata = {
  title: { default: "Task Board", template: "%s · Task Board" },
  description: "Quản lý backlog kỹ thuật kiểu Jira",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 text-slate-900">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
