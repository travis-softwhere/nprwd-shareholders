"use client"

import { SessionProvider } from "next-auth/react"
import { MeetingProvider } from "@/contexts/MeetingContext"
import { ProgressProvider } from "@/contexts/ProgressContext"
import Navigation from "@/components/Navigation"
import type React from "react"

export function Providers({
    children,
    session,
}: {
    children: React.ReactNode
    session: any
}) {
    return (
        <SessionProvider session={session}>
            <MeetingProvider>
                <ProgressProvider>
                    <div className="flex h-screen">
                        <Navigation />
                        <main className="flex-1 overflow-y-auto bg-gray-50">{children}</main>
                    </div>
                </ProgressProvider>
            </MeetingProvider>
        </SessionProvider>
    )
}