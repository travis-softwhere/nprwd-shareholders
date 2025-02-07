"use client"

import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import Link from "next/link"

export default function AuthError() {
    const searchParams = useSearchParams()
    const error = searchParams.get("error")

    const getErrorMessage = (error: string | null) => {
        switch (error) {
            case "Configuration":
                return "There is a problem with the server configuration. Please contact support."
            case "AccessDenied":
                return "You do not have permission to sign in."
            case "Verification":
                return "The sign in link is no longer valid. It may have been used already or it may have expired."
            case "OAuthSignin":
                return "Could not connect to the authentication server. Please try again."
            case "OAuthCallback":
                return "Could not verify your credentials. Please try again."
            case "OAuthCreateAccount":
                return "Could not create your account. Please contact support."
            case "EmailCreateAccount":
                return "Could not create your account. Please contact support."
            case "Callback":
                return "Could not verify your credentials. Please try again."
            case "OAuthAccountNotLinked":
                return "To confirm your identity, sign in with the same account you used originally."
            case "EmailSignin":
                return "The sign in link is no longer valid. It may have been used already or it may have expired."
            case "CredentialsSignin":
                return "Invalid username or password. Please check your credentials and try again."
            default:
                return "An unexpected error occurred. Please try again."
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100">
            <Card className="w-[400px]">
                <CardHeader className="text-destructive">
                    <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        Authentication Error
                    </CardTitle>
                    <CardDescription className="text-destructive">{getErrorMessage(error)}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-4">
                        <Button asChild>
                            <Link href="/auth/signin">Try Again</Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href="/">Return Home</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}