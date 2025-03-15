import { logToFile, LogLevel } from "./logger";

// Define error types for better categorization
export enum ErrorType {
  API = "API Error",
  VALIDATION = "Validation Error",
  AUTHENTICATION = "Authentication Error",
  NETWORK = "Network Error",
  UNEXPECTED = "Unexpected Error",
  NOT_FOUND = "Not Found Error",
  PERMISSION = "Permission Error",
}

// Interface for structured errors
export interface AppError {
  type: ErrorType;
  message: string;
  userMessage: string;
  code?: number | string;
  details?: any;
  timestamp: string;
  path?: string;
}

// Error codes to user-friendly messages mapping
const errorMessages: Record<string, string> = {
  "401": "You need to log in to access this feature",
  "403": "You don't have permission to access this feature",
  "404": "The requested resource could not be found",
  "500": "We're experiencing technical difficulties",
  "network_error": "Unable to connect to the server",
  "timeout": "The request timed out",
  "unknown": "Something went wrong, please try again later",
};

/**
 * Formats an error into a standardized structure
 */
export function formatError(
  error: Error | any,
  type: ErrorType = ErrorType.UNEXPECTED,
  path?: string
): AppError {
  const timestamp = new Date().toISOString();
  let code = "unknown";
  let message = error?.message || "An unknown error occurred";
  let details = undefined;
  
  // Handle different error types
  if (error instanceof Response || (error && 'status' in error)) {
    code = String(error.status || 500);
    message = `HTTP Error: ${code}`;
    details = error.statusText;
  } else if (error instanceof Error) {
    message = error.message;
    details = error.stack;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object') {
    message = error.message || JSON.stringify(error);
    details = error;
  }
  
  // Get user-friendly message
  const userMessage = getUserFriendlyMessage(code);
  
  // Log the error
  logClientError({ type, code, message, details, path });
  
  return {
    type,
    message,
    userMessage,
    code,
    details,
    timestamp,
    path,
  };
}

/**
 * Transforms error codes/types to user-friendly messages
 */
export function getUserFriendlyMessage(code: string | number): string {
  return errorMessages[String(code)] || errorMessages.unknown;
}

/**
 * Logs client-side errors
 */
function logClientError({
  type,
  code,
  message,
  details,
  path,
}: {
  type: ErrorType;
  code?: string | number;
  message: string;
  details?: any;
  path?: string;
}) {
  // No logging in any environment
  return;
}

/**
 * Sanitize error details to avoid logging sensitive information
 */
function sanitizeErrorDetails(details: any): any {
  if (!details) return undefined;
  
  // If it's a string, check for sensitive data patterns
  if (typeof details === 'string') {
    // Redact potential tokens
    return details.replace(/Bearer\s+[a-zA-Z0-9._-]+/g, 'Bearer [REDACTED]')
      // Redact potential email addresses
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
      // Redact potential passwords in JSON strings
      .replace(/"password"\s*:\s*"[^"]*"/g, '"password":"[REDACTED]"');
  }
  
  // If it's an object, create a sanitized copy
  if (typeof details === 'object' && details !== null) {
    const sanitized = { ...details };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'authorization', 'credential'];
    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }
  
  return details;
}

/**
 * API error handler that formats errors from fetch requests
 */
export async function handleApiError(response: Response, path: string): Promise<never> {
  let errorData: any;
  let errorType = ErrorType.API;

  try {
    // Try to parse response as JSON
    errorData = await response.json();
  } catch {
    // If parsing fails, create a basic error object
    errorData = {
      message: response.statusText || 'Unknown error',
    };
  }

  // Determine more specific error type based on status code
  if (response.status === 401 || response.status === 403) {
    errorType = ErrorType.AUTHENTICATION;
  } else if (response.status === 404) {
    errorType = ErrorType.NOT_FOUND;
  }

  // Create a structured error
  const error = formatError(
    { 
      status: response.status, 
      message: errorData.message || response.statusText, 
      ...errorData 
    },
    errorType,
    path
  );

  // Throw the formatted error
  throw error;
}

/**
 * Helper for safe API calls
 */
export async function fetchWithErrorHandling<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      await handleApiError(response, url);
    }

    // For successful responses with no content
    if (response.status === 204) {
      return {} as T;
    }

    return await response.json();
  } catch (error) {
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw formatError(error, ErrorType.NETWORK, url);
    }
    
    // Re-throw if already handled
    if ((error as any).type) {
      throw error;
    }
    
    // Handle unexpected errors
    throw formatError(error, ErrorType.UNEXPECTED, url);
  }
}

/**
 * Log errors to server - now a no-op function
 */
export async function logErrorToServer(
  _type: 'client' | 'server',
  _message: string,
  _details?: Record<string, any>,
  _level: LogLevel = LogLevel.ERROR,
): Promise<void> {
  // No-op function
  return;
}

/**
 * Global error handler - now a no-op function
 */
export function handleGlobalError(_error: Error, _errorInfo?: React.ErrorInfo): void {
  // No-op function
  return;
} 