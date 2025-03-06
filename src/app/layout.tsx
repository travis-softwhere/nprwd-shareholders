import type { ReactNode } from "react"
import { Toaster } from "@/components/ui/toaster"
import Providers from "@/components/Providers"
import "@/app/globals.css"


export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  )
}
