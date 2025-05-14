import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/authContext";
import { Toaster } from "sonner";
import Navbar from "@/components/layout/Navbar";
import AppFooter from "@/components/layout/AppFooter";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Foosballek",
  description: "Track your foosball group scores and stats",
  openGraph: {
    title: "Foosballek",
    description: "Track your foosball group scores and stats",
    images: [
      {
        url: "/images/social-card.png",
        width: 1200,
        height: 630,
        alt: "Foosballek - Track your foosball group scores and stats",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Foosballek",
    description: "Track your foosball group scores and stats",
    images: ["/images/social-card.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <Navbar />
          <main className="md:pb-14">
            {children}
          </main>
          <AppFooter />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
