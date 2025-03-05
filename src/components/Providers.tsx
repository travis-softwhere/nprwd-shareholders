"use client"

import { SessionProvider } from "next-auth/react"
import { MeetingProvider } from "@/contexts/MeetingContext"
import { ProgressProvider } from "@/contexts/ProgressContext"
import Navigation from "@/components/Navigation"
import type { ReactNode } from "react"

interface ProvidersProps {
    children: ReactNode
}

export default function Providers({ children }: ProvidersProps) {
    return (
        <SessionProvider>
            <MeetingProvider>
                <ProgressProvider>
                    <div className="flex min-h-screen">
                        <Navigation />
                        <div className="flex-1">{children}</div>
                    </div>
                </ProgressProvider>
            </MeetingProvider>
        </SessionProvider>
    )
}