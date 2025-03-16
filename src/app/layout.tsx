import type { ReactNode } from "react"
import { Toaster } from "@/components/ui/toaster"
import Providers from "@/components/Providers"
import { Metadata, Viewport } from "next"
import "@/app/globals.css"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: "AquaShare",
  description: "NPRWD shareholder meeting management portal",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/logo.png", sizes: "32x32", type: "image/png" },
      { url: "/logo.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/logo.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: { url: "/favicon.png" },
  },
  manifest: "/manifest.json",
  applicationName: "AquaShare",
  keywords: ["NPRWD", "shareholders", "meetings", "water district", "utility"],
  authors: [{ name: "NPRWD", url: "https://nprwd.com" }],
  creator: "NPRWD",
  publisher: "NPRWD",
  other: {
    "msapplication-TileColor": "#3498db",
    "msapplication-TileImage": "/logo.png",
    "theme-color": "#3498db",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "AquaShare",
  }
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
      </head>
      <body>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  )
}
