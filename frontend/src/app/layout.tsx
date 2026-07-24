import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { themeInitScript } from "@/lib/theme";
import { ToastProvider } from "@/components/ui/Toast";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NutriON",
  description:
    "Track calories, sugar, carbs and hydration. Nutrition tracking and educational insights — not medical advice.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "NutriON",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/small-icon.png",
    apple: "/small-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e14" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${fraunces.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full font-sans antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
