import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import BackToTopButton from "@/components/BackToTopButton";
import { ThemeProvider } from "@/components/ThemeProvider";
import { BranchProvider } from "@/contexts/BranchContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "دعوة الحق",
  description: "دعوة الحق - نظام إدارة العمل الخيري",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="ar" dir="rtl" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <BranchProvider>
              <Navbar />
              <main className="min-h-screen">
                {children}
              </main>
              <BackToTopButton />
            </BranchProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
