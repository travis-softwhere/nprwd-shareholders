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
    // Format and log the error
    const formattedError = formatError(error, ErrorType.UNEXPECTED, window.location.pathname);
    console.error('Global error caught:', formattedError);
};

// AuthGate component to handle auth protection
function AuthGate({ children }: { children: ReactNode }) {
    const { status, data: session } = useSession();
    const pathname = usePathname();
    const router = useRouter();
    
    // Skip auth check for auth pages and public routes
    const isAuthPage = pathname.startsWith('/auth') || 
                       pathname.startsWith('/reset-password') || 
                       pathname.startsWith('/api');
    
    useEffect(() => {
        // If on auth page and authenticated, go to dashboard
        if (isAuthPage && status === "authenticated") {
            router.push('/');
            return;
        }
        
        // If not on auth page and not authenticated, redirect to signin
        if (!isAuthPage && status === "unauthenticated") {
            router.push('/auth/signin');
            return;
        }
    }, [status, isAuthPage, router]);
    
    if (isAuthPage) {
        return <>{children}</>;
    }
    
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
    
    // Don't render protected content if not authenticated
    if (status !== "authenticated") {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-lg text-gray-600">Redirecting to login...</p>
                </div>
            </div>
        );
    }
    
    // Render children if authenticated
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