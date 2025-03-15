"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatError, ErrorType } from "@/utils/errorHandler";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to our logging system
    const formattedError = formatError(error, ErrorType.UNEXPECTED);
    console.error("Unhandled application error:", formattedError);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
          <Card className="p-8 max-w-md w-full">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-600 mb-4">
                Something went wrong
              </h1>
              <div className="mb-6">
                <p className="text-gray-600">
                  We're sorry, but there was an unexpected error.
                </p>
                <p className="text-gray-600 mt-2">
                  Our team has been notified and is working on a fix.
                </p>
              </div>

              {process.env.NODE_ENV !== 'production' && (
                <div className="mb-6 p-4 bg-gray-100 rounded text-left">
                  <p className="font-semibold text-red-600">{error.name}: {error.message}</p>
                  {error.stack && (
                    <pre className="mt-2 text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                      {error.stack}
                    </pre>
                  )}
                  {error.digest && (
                    <p className="mt-2 text-xs text-gray-500">Error ID: {error.digest}</p>
                  )}
                </div>
              )}

              <div className="flex flex-col space-y-3">
                <Button onClick={reset}>Try Again</Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = '/'}
                >
                  Return to Home
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </body>
    </html>
  );
} 