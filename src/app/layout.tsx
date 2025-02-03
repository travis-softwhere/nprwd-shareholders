import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Navigation from "@/components/Navigation"
import { MeetingProvider } from "@/contexts/MeetingContext"
import { ProgressProvider } from "@/contexts/ProgressContext"
import type React from "react"
import { initDatabase } from "@/lib/db/init"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "AquaShare | NPRWD",
  description: "North Prairie Regional Water District Shareholder Management",
}

// Run the database initialization
initDatabase().catch(console.error)

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <MeetingProvider>
          <ProgressProvider>
            <div className="flex h-screen">
              <Navigation />
              <main className="flex-1 overflow-y-auto bg-gray-50">{children}</main>
            </div>
          </ProgressProvider>
        </MeetingProvider>
      </body>
    </html>
  )
}