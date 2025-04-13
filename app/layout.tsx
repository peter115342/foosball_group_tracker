import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/authContext";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Foosball Group Tracker",
  description: "Track your foosball group scores and stats",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider> {/* Wrap the children */}
          {children}
          <Toaster richColors position="top-right" /> {/* Add sonner's Toaster */}
        </AuthProvider>
      </body>
    </html>
  );
}
