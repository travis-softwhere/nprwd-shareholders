"use client"

import { SessionProvider } from "next-auth/react"
import { MeetingProvider } from "@/contexts/MeetingContext"
import { ProgressProvider } from "@/contexts/ProgressContext"
import Navigation from "@/components/Navigation"
import ErrorBoundary from "@/components/ui/error-boundary"
import type { ReactNode } from "react"
import { formatError, ErrorType } from "@/utils/errorHandler"

interface ProvidersProps {
    children: ReactNode
}

// Handle errors at the global level
const handleGlobalError = (error: Error) => {
    // Format and log the error
    const formattedError = formatError(error, ErrorType.UNEXPECTED, window.location.pathname);
    console.error('Global error caught:', formattedError);
};

export default function Providers({ children }: ProvidersProps) {
    return (
        <SessionProvider>
            <MeetingProvider>
                <ProgressProvider>
                    <ErrorBoundary onError={handleGlobalError}>
                        <div className="flex min-h-screen">
                            <Navigation />
                            <div className="flex-1">{children}</div>
                        </div>
                    </ErrorBoundary>
                </ProgressProvider>
            </MeetingProvider>
        </SessionProvider>
    )
}