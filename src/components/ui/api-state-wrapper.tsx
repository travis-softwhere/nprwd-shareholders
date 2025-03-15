import React from 'react';
import { AppError } from '@/utils/errorHandler';
import { ErrorAlert } from './error-alert';
import { Button } from './button';

interface ApiStateWrapperProps {
  children: React.ReactNode;
  isLoading?: boolean;
  error?: AppError | Error | string | null;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode | ((error: any, retry: () => void) => React.ReactNode);
  onRetry?: () => void;
  className?: string;
  showDefaultErrorUi?: boolean;
  showRetryButton?: boolean;
}

/**
 * Component that wraps content and shows loading/error states based on API operations
 */
export function ApiStateWrapper({
  children,
  isLoading = false,
  error = null,
  loadingComponent,
  errorComponent,
  onRetry,
  className = '',
  showDefaultErrorUi = true,
  showRetryButton = true,
}: ApiStateWrapperProps) {
  // Function to handle retry
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
  };

  // Show loading state
  if (isLoading) {
    if (loadingComponent) {
      return <div className={className}>{loadingComponent}</div>;
    }
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 rounded-full border-4 border-gray-200 border-t-blue-500 animate-spin"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    // If a custom error component is provided, use it
    if (errorComponent) {
      if (typeof errorComponent === 'function') {
        return <div className={className}>{errorComponent(error, handleRetry)}</div>;
      }
      return <div className={className}>{errorComponent}</div>;
    }

    // Show default error UI if enabled
    if (showDefaultErrorUi) {
      return (
        <div className={`space-y-4 ${className}`}>
          <ErrorAlert error={error} />
          {showRetryButton && onRetry && (
            <div className="flex justify-end">
              <Button onClick={handleRetry} variant="outline">
                Try Again
              </Button>
            </div>
          )}
        </div>
      );
    }
  }

  // No loading or error, show children
  return <div className={className}>{children}</div>;
}

/**
 * Higher-order component that adds API state handling
 */
export function withApiState<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<ApiStateWrapperProps, 'children'> = {}
): React.FC<P & Omit<ApiStateWrapperProps, 'children'>> {
  const WithApiState = ({
    isLoading,
    error,
    loadingComponent,
    errorComponent,
    onRetry,
    className,
    showDefaultErrorUi,
    showRetryButton,
    ...props
  }: P & Omit<ApiStateWrapperProps, 'children'>) => {
    // Merge options with props
    const mergedOptions = {
      ...options,
      isLoading: isLoading ?? options.isLoading,
      error: error ?? options.error,
      loadingComponent: loadingComponent ?? options.loadingComponent,
      errorComponent: errorComponent ?? options.errorComponent,
      onRetry: onRetry ?? options.onRetry,
      className: className ?? options.className,
      showDefaultErrorUi: showDefaultErrorUi ?? options.showDefaultErrorUi,
      showRetryButton: showRetryButton ?? options.showRetryButton,
    };

    return (
      <ApiStateWrapper {...mergedOptions}>
        <Component {...(props as P)} />
      </ApiStateWrapper>
    );
  };

  WithApiState.displayName = `withApiState(${Component.displayName || Component.name || 'Component'})`;
  return WithApiState;
} 