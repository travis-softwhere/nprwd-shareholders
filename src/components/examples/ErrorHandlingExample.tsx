"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorAlert, ErrorList } from "@/components/ui/error-alert";
import { ApiStateWrapper } from "@/components/ui/api-state-wrapper";
import { useApi } from "@/hooks/useApi";
import { ErrorType, formatError } from "@/utils/errorHandler";

/**
 * Example component demonstrating error handling capabilities
 */
export function ErrorHandlingExample() {
  // State for manual error demonstration
  const [showError, setShowError] = useState(false);
  const [errorType, setErrorType] = useState<ErrorType>(ErrorType.UNEXPECTED);

  // Example API call using the useApi hook
  const { isLoading, error, get, reset } = useApi();

  // Function to trigger API error
  const triggerApiError = async () => {
    await get("/api/non-existent-endpoint");
  };

  // Function to manually show/hide errors for demonstration
  const toggleError = (type: ErrorType) => {
    setErrorType(type);
    setShowError(!showError || errorType !== type);
  };

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold mb-4">Error Handling Examples</h1>

      {/* Section 1: Error Alert Component */}
      <Card className="p-6">
        <h2 className="text-lg font-medium mb-4">Error Alert Component</h2>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => toggleError(ErrorType.VALIDATION)}
              variant={showError && errorType === ErrorType.VALIDATION ? "destructive" : "outline"}
            >
              Validation Error
            </Button>
            <Button 
              onClick={() => toggleError(ErrorType.AUTHENTICATION)}
              variant={showError && errorType === ErrorType.AUTHENTICATION ? "destructive" : "outline"}
            >
              Authentication Error
            </Button>
            <Button 
              onClick={() => toggleError(ErrorType.NETWORK)}
              variant={showError && errorType === ErrorType.NETWORK ? "destructive" : "outline"}
            >
              Network Error
            </Button>
          </div>

          {showError && (
            <ErrorAlert
              error={formatError(
                new Error(`This is an example ${errorType} message`),
                errorType
              )}
              showDetails={true}
              onDismiss={() => setShowError(false)}
            />
          )}
        </div>
      </Card>

      {/* Section 2: API State Wrapper */}
      <Card className="p-6">
        <h2 className="text-lg font-medium mb-4">API State Wrapper</h2>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={triggerApiError} variant="outline">
              Trigger API Error
            </Button>
            {error && (
              <Button onClick={reset} variant="outline">
                Reset Error
              </Button>
            )}
          </div>

          <ApiStateWrapper
            isLoading={isLoading}
            error={error}
            onRetry={triggerApiError}
          >
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-800">
                No errors here! The content is loading successfully.
              </p>
            </div>
          </ApiStateWrapper>
        </div>
      </Card>

      {/* Section 3: Error List Component */}
      <Card className="p-6">
        <h2 className="text-lg font-medium mb-4">Form Validation Error List</h2>
        <div className="space-y-4">
          <Button 
            onClick={() => setShowError(!showError)}
            variant={showError ? "destructive" : "outline"}
          >
            Toggle Form Errors
          </Button>

          {showError && (
            <ErrorList
              errors={{
                "Name": "Name is required",
                "Email": "Please enter a valid email address",
                "Password": "Password must be at least 8 characters long"
              }}
              onDismiss={() => setShowError(false)}
            />
          )}
        </div>
      </Card>
    </div>
  );
} 