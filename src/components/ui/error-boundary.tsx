import React, { Component, ErrorInfo, ReactNode } from 'react';
import { formatError, ErrorType } from '@/utils/errorHandler';
import { Button } from './button';
import { Card } from './card';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, resetError: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component that catches JavaScript errors in its child component tree.
 * Displays a fallback UI instead of the component tree that crashed.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render shows the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Format and log the error
    const formattedError = formatError(error, ErrorType.UNEXPECTED);
    
    // Call the optional onError callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    const { children, fallback } = this.props;
    const { hasError, error } = this.state;

    if (hasError && error) {
      // If a custom fallback is provided, use it
      if (fallback) {
        if (typeof fallback === 'function') {
          return fallback(error, this.resetError);
        }
        return fallback;
      }

      // Default fallback UI
      return (
        <Card className="p-6 mx-auto my-8 max-w-lg">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-6">
              We've encountered an unexpected error. Please try again or contact support if the problem persists.
            </p>
            <div className="space-y-4">
              {process.env.NODE_ENV !== 'production' && (
                <div className="p-4 bg-gray-100 rounded text-left text-sm overflow-auto max-h-48">
                  <p className="font-semibold">{error.name}: {error.message}</p>
                  <pre className="mt-2 text-xs">{error.stack}</pre>
                </div>
              )}
              <div className="flex justify-center space-x-4">
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = '/'}
                >
                  Go to Home Page
                </Button>
                <Button onClick={this.resetError}>
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        </Card>
      );
    }

    return children;
  }
}

/**
 * A wrapper around ErrorBoundary for use with React hooks in functional components
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  const displayName = Component.displayName || Component.name || 'Component';
  
  const ComponentWithErrorBoundary = (props: P) => {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
  
  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;
  
  return ComponentWithErrorBoundary;
}

export default ErrorBoundary; 