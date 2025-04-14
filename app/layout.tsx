import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/authContext";
import { Toaster } from "sonner";
import Navbar from "@/components/layout/Navbar"; // Import the Navbar

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
        <AuthProvider> {/* AuthProvider wraps everything */}
          <Navbar /> {/* Add the Navbar here */}
          <main>{children}</main> {/* Wrap page content in main */}
          <Toaster richColors position="top-right" /> {/* Toaster remains */}
        </AuthProvider>
      </body>
    </html>
  );
}
