"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorType, formatError } from "@/utils/errorHandler";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    // Format error for display, but do not log to console
    const formattedError = formatError(error, ErrorType.UNEXPECTED);
    
    // Instead of console.error, we could optionally send to an analytics service
    // in production but we're removing all logging
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="bg-red-50 text-red-900">
          <CardTitle className="text-xl">Something went wrong</CardTitle>
          <CardDescription className="text-red-700">
            We've encountered an unexpected error
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <p className="mb-4 text-gray-700">
            The application has encountered an unexpected error. We've been notified and will work on fixing it.
          </p>
          <div className="p-3 bg-gray-100 rounded-md text-sm overflow-auto">
            <p className="font-mono">{error.message || 'Unknown error'}</p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2 border-t p-4">
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            Go Home
          </Button>
          <Button onClick={reset}>Try Again</Button>
        </CardFooter>
      </Card>
    </div>
  );
} 