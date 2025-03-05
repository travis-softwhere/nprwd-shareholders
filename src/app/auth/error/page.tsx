"use client"

import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export default function ErrorPage() {
    const searchParams = useSearchParams()
    const error = searchParams?.get("error")

    let errorMessage = "An error occurred during authentication."

    if (error === "Configuration") {
        errorMessage = "There is a problem with the server configuration."
    } else if (error === "AccessDenied") {
        errorMessage = "Access denied. You do not have permission to view this page."
    } else if (error === "Verification") {
        errorMessage = "The sign in link is no longer valid. It may have been used already or it may have expired."
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100">
            <Card className="w-[400px]">
                <CardHeader>
                    <CardTitle>Authentication Error</CardTitle>
                    <CardDescription>There was a problem signing you in</CardDescription>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{errorMessage}</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        </div>
    )
}