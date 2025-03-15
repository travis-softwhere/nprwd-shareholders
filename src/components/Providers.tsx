"use client"

import { SessionProvider, useSession } from "next-auth/react"
import { MeetingProvider } from "@/contexts/MeetingContext"
import { ProgressProvider } from "@/contexts/ProgressContext"
import Navigation from "@/components/Navigation"
import ErrorBoundary from "@/components/ui/error-boundary"
import type { ReactNode } from "react"
import { formatError, ErrorType } from "@/utils/errorHandler"
import { Loader2 } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"

interface ProvidersProps {
    children: ReactNode
}

// Handle errors at the global level
const handleGlobalError = (error: Error) => {
    // Format the error
    const formattedError = formatError(error, ErrorType.UNEXPECTED, window.location.pathname);
    
    // In production, this could send the error to a logging service
    if (process.env.NODE_ENV !== 'production') {
        // Only log in development
        // Using a conditional to avoid console statements in production
    }
};

// AuthGate component handles auth state and UI
function AuthGate({ children }: { children: ReactNode }) {
    const { status, data: session } = useSession();
    const pathname = usePathname();
    const router = useRouter();
    
    // Skip auth checks for auth pages and API routes
    const isAuthPage = pathname.startsWith('/auth') || 
                       pathname.startsWith('/reset-password') || 
                       pathname.startsWith('/api');
    
    // Add explicit redirect for unauthenticated users
    useEffect(() => {
        if (!isAuthPage && status === "unauthenticated") {
            router.push('/auth/signin');
        }
    }, [status, isAuthPage, router]);
    
    // For auth pages, just render children without navigation
    if (isAuthPage) {
        return <>{children}</>;
    }
    
    // Show loading state while checking authentication
    if (status === "loading") {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-lg text-gray-600">Loading AquaShare...</p>
                </div>
            </div>
        );
    }
    
    // Prevent rendering protected content if not authenticated
    if (status !== "authenticated" || !session) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-lg text-gray-600">Redirecting to login...</p>
                </div>
            </div>
        );
    }
    
    // Render authenticated layout with navigation
    return (
        <div className="flex min-h-screen">
            <Navigation />
            <div className="flex-1">{children}</div>
        </div>
    );
}

export default function Providers({ children }: ProvidersProps) {
    return (
        <SessionProvider>
            <MeetingProvider>
                <ProgressProvider>
                    <ErrorBoundary onError={handleGlobalError}>
                        <AuthGate>
                            {children}
                        </AuthGate>
                    </ErrorBoundary>
                </ProgressProvider>
            </MeetingProvider>
        </SessionProvider>
    )
}