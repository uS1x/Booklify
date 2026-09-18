import type { Metadata, Viewport } from "next";
import { Caveat, Fraunces, Inter } from "next/font/google";

import { Providers } from "@/components/providers";
import { ServiceWorkerRegistrar } from "@/components/service-worker";
import { themeInitScript } from "@/components/theme-provider";

import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK"],
});

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const caveat = Caveat({ subsets: ["latin"], display: "swap", variable: "--font-caveat" });

export const metadata: Metadata = {
  title: {
    default: "Bücherregal – dein digitales Leseleben",
    template: "%s · Bücherregal",
  },
  description:
    "Dein digitales Bücherregal: Lesefortschritt, Buch-Tagebuch, Moodboards, Statistiken – und eine private Bibliothek, die du mit Freunden teilen und verleihen kannst.",
  applicationName: "Bücherregal",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Bücherregal" },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf7f1" },
    { media: "(prefers-color-scheme: dark)", color: "#17130f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.variable} ${fraunces.variable} ${caveat.variable} antialiased`}>
        <Providers>{children}</Providers>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
