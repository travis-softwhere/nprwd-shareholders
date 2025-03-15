import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AppError, ErrorType } from '@/utils/errorHandler';
import { XCircle } from 'lucide-react';

interface ErrorAlertProps {
  error: Error | AppError | string;
  title?: string;
  variant?: 'default' | 'destructive';
  className?: string;
  showDetails?: boolean;
  onDismiss?: () => void;
}

/**
 * Component for displaying errors in an alert format
 * Useful for form validations and inline errors
 */
export function ErrorAlert({ 
  error, 
  title, 
  variant = 'destructive', 
  className = '',
  showDetails = false,
  onDismiss 
}: ErrorAlertProps) {
  // Convert the error to a message string
  let errorMessage = '';
  let errorTitle = title || 'Error';
  let errorDetails = '';
  
  if (typeof error === 'string') {
    errorMessage = error;
  } else if ('userMessage' in error) {
    errorMessage = error.userMessage;
    errorTitle = title || getErrorTypeTitle(error.type);
    errorDetails = error.message;
  } else if (error instanceof Error) {
    errorMessage = error.message;
    errorDetails = error.stack || '';
  } else {
    errorMessage = 'An unknown error occurred';
  }

  // Skip rendering if there's no message
  if (!errorMessage) return null;

  return (
    <Alert variant={variant} className={`${className} relative`}>
      {onDismiss && (
        <button 
          onClick={onDismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
          aria-label="Dismiss error"
        >
          <XCircle className="h-4 w-4" />
        </button>
      )}
      <XCircle className="h-4 w-4" />
      <AlertTitle>{errorTitle}</AlertTitle>
      <AlertDescription>
        {errorMessage}
        {showDetails && errorDetails && process.env.NODE_ENV !== 'production' && (
          <div className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
            <pre>{errorDetails}</pre>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Component for displaying a list of errors
 */
export function ErrorList({ 
  errors, 
  title = 'Please fix the following errors:', 
  variant = 'destructive',
  className = '',
  onDismiss
}: {
  errors: string[] | Record<string, string>;
  title?: string;
  variant?: 'default' | 'destructive';
  className?: string;
  onDismiss?: () => void;
}) {
  // Convert errors object to array
  const errorArray = Array.isArray(errors) 
    ? errors 
    : Object.entries(errors).map(([field, msg]) => `${field}: ${msg}`);
  
  // Skip rendering if there are no errors
  if (errorArray.length === 0) return null;

  return (
    <Alert variant={variant} className={`${className} relative`}>
      {onDismiss && (
        <button 
          onClick={onDismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
          aria-label="Dismiss errors"
        >
          <XCircle className="h-4 w-4" />
        </button>
      )}
      <XCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          {errorArray.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Generate a user-friendly title based on error type
 */
function getErrorTypeTitle(type?: ErrorType): string {
  switch (type) {
    case ErrorType.VALIDATION:
      return 'Validation Error';
    case ErrorType.AUTHENTICATION:
      return 'Authentication Error';
    case ErrorType.NETWORK:
      return 'Connection Error';
    case ErrorType.NOT_FOUND:
      return 'Not Found';
    case ErrorType.PERMISSION:
      return 'Permission Denied';
    case ErrorType.API:
      return 'Server Error';
    case ErrorType.UNEXPECTED:
    default:
      return 'Unexpected Error';
  }
} 