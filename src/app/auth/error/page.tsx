"use client";

import React, { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

function ErrorPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams?.get("error");

  let errorMessage = "An error occurred during authentication.";
  let errorDetails = "Please try again or contact an administrator for assistance.";

  if (error === "Configuration") {
    errorMessage = "Server Configuration Error";
    errorDetails = "There is a problem with the server configuration. Please contact an administrator.";
  } else if (error === "AccessDenied") {
    errorMessage = "Access Denied";
    errorDetails = "You do not have permission to view this page. Please sign in with the appropriate credentials.";
  } else if (error === "Verification") {
    errorMessage = "Invalid or Expired Link";
    errorDetails = "The sign in link is no longer valid. It may have been used already or it may have expired.";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center justify-center space-y-2 text-center">
          <div className="relative h-28 w-28 overflow-hidden mb-2">
            <Image 
              src="/logo.png" 
              alt="AquaShare Logo" 
              width={128}
              height={128}
              className="transition-all duration-300 hover:scale-105 object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Authentication Error
          </h1>
        </div>

        <Card className="overflow-hidden border-gray-200 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-red-50 to-white pb-4">
            <CardTitle className="flex items-center gap-2 text-xl text-gray-900">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              {errorMessage}
            </CardTitle>
            <CardDescription>
              There was a problem with your authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-800">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorDetails}</AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex flex-col justify-center border-t bg-gray-50 p-4">
            <Button 
              onClick={() => router.push("/auth/signin")}
              className="bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to Sign In
            </Button>
            <p className="mt-3 text-xs text-gray-500 text-center">© {new Date().getFullYear()} AquaShare - All Rights Reserved</p>
            <p className="mt-1 text-xs text-gray-500 text-center">Powered by Soft-Where, LLC</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="text-center">
          <div className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-blue-400 border-r-transparent align-middle">
            <span className="sr-only">Loading...</span>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-gray-700">
            Loading
          </h2>
        </div>
      </div>
    }>
      <ErrorPageContent />
    </Suspense>
  );
}
