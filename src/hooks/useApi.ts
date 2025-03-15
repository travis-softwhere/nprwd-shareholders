import { useState, useCallback } from 'react';
import { fetchWithErrorHandling, ErrorType, formatError, AppError } from '@/utils/errorHandler';
import { useToast } from '@/components/ui/use-toast';

interface UseApiOptions {
  showErrorToast?: boolean;
  successMessage?: string;
}

interface UseApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: AppError | null;
}

/**
 * Custom hook for making API requests with automatic error handling
 */
export function useApi<T = any>(defaultOptions: UseApiOptions = {}) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    isLoading: false,
    error: null,
  });
  
  const { toast } = useToast();

  /**
   * Helper to reset the state
   */
  const reset = useCallback(() => {
    setState({
      data: null,
      isLoading: false,
      error: null,
    });
  }, []);

  /**
   * Main request function
   */
  const request = useCallback(
    async <R = T>(
      url: string, 
      options?: RequestInit, 
      apiOptions: UseApiOptions = {}
    ): Promise<R | null> => {
      // Merge default options with per-request options
      const mergedOptions = {
        showErrorToast: true,
        ...defaultOptions,
        ...apiOptions,
      };

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetchWithErrorHandling<R>(url, options);
        
        setState({
          data: response as any,
          isLoading: false,
          error: null,
        });

        // Show success toast if specified
        if (mergedOptions.successMessage) {
          toast({
            title: "Success",
            description: mergedOptions.successMessage,
          });
        }

        return response;
      } catch (error) {
        const formattedError = error as AppError || 
          formatError(error, ErrorType.API, url);

        setState({
          data: null,
          isLoading: false,
          error: formattedError,
        });

        // Show error toast if enabled
        if (mergedOptions.showErrorToast) {
          toast({
            variant: "destructive",
            title: getErrorTitle(formattedError.type),
            description: formattedError.userMessage,
          });
        }

        return null;
      }
    },
    [defaultOptions, toast]
  );

  /**
   * Helper for GET requests
   */
  const get = useCallback(
    <R = T>(url: string, options?: UseApiOptions) => {
      return request<R>(url, { method: 'GET' }, options);
    },
    [request]
  );

  /**
   * Helper for POST requests
   */
  const post = useCallback(
    <R = T>(url: string, data?: any, options?: UseApiOptions) => {
      return request<R>(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: data ? JSON.stringify(data) : undefined,
        },
        options
      );
    },
    [request]
  );

  /**
   * Helper for PUT requests
   */
  const put = useCallback(
    <R = T>(url: string, data?: any, options?: UseApiOptions) => {
      return request<R>(
        url,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: data ? JSON.stringify(data) : undefined,
        },
        options
      );
    },
    [request]
  );

  /**
   * Helper for DELETE requests
   */
  const del = useCallback(
    <R = T>(url: string, options?: UseApiOptions) => {
      return request<R>(
        url,
        {
          method: 'DELETE',
        },
        options
      );
    },
    [request]
  );

  return {
    ...state,
    request,
    get,
    post,
    put,
    delete: del,
    reset,
  };
}

/**
 * Get a user-friendly error title based on error type
 */
function getErrorTitle(type: ErrorType): string {
  switch (type) {
    case ErrorType.VALIDATION:
      return 'Validation Error';
    case ErrorType.AUTHENTICATION:
      return 'Authentication Required';
    case ErrorType.PERMISSION:
      return 'Permission Denied';
    case ErrorType.NETWORK:
      return 'Network Error';
    case ErrorType.NOT_FOUND:
      return 'Not Found';
    case ErrorType.API:
      return 'Server Error';
    default:
      return 'Error';
  }
} 