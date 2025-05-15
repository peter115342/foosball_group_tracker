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
  metadataBase: new URL("https://foosballek.com"),
  openGraph: {
    title: "Foosballek - Track your foosball scores",
    description: "Track your foosball group scores and stats",
    url: "https://foosballek.com",
    siteName: "Foosballek",
    images: [
      {
        url: "https://foosballek.com/images/social-card.png",
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
    title: "Foosballek - Track your foosball scores",
    description: "Track your foosball group scores and stats",
    images: ["https://foosballek.com/images/social-card.png"],
    creator: "@foosballek",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Hardcoded meta tags as fallback */}
        <meta property="og:title" content="Foosballek - Track your foosball scores" />
        <meta property="og:description" content="Track your foosball group scores and stats" />
        <meta property="og:image" content="https://foosballek.com/images/social-card.png" />
        <meta property="og:url" content="https://foosballek.com" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Foosballek" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Foosballek - Track your foosball scores" />
        <meta name="twitter:description" content="Track your foosball group scores and stats" />
        <meta name="twitter:image" content="https://foosballek.com/images/social-card.png" />
      </head>
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
