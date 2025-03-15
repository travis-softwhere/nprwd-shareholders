# Error Handling Guide

This document provides a comprehensive overview of the error handling system implemented in the application. The system is designed to provide a consistent approach to handling errors, displaying user-friendly messages, and logging errors for debugging.

## Overview

Our error handling system consists of several components:

1. **Central Error Handling Utility** (`errorHandler.ts`)
2. **React Error Boundary Component** (`error-boundary.tsx`) 
3. **Error UI Components** (`error-alert.tsx`, `api-state-wrapper.tsx`)
4. **API Error Handling Hooks** (`useApi.ts`)
5. **Global Error Pages** (`error.tsx`, `not-found.tsx`)

## Quick Start

### 1. Using the API Hook

The simplest way to handle API calls with proper error handling is to use the `useApi` hook:

```jsx
import { useApi } from '@/hooks/useApi';

function UserProfile() {
  const { isLoading, error, data, get } = useApi();

  useEffect(() => {
    // Will automatically handle loading states and errors
    get('/api/users/profile');
  }, [get]);

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.userMessage}</p>;

  return <div>{data?.name}</div>;
}
```

### 2. Using the API State Wrapper

For components that need to show loading states and error messages:

```jsx
import { ApiStateWrapper } from '@/components/ui/api-state-wrapper';

function Content({ isLoading, error, data, refetch }) {
  return (
    <ApiStateWrapper 
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
    >
      {/* Your content here */}
      <div>{data?.map(item => <div key={item.id}>{item.name}</div>)}</div>
    </ApiStateWrapper>
  );
}
```

### 3. Displaying Inline Errors

For form validation or inline errors:

```jsx
import { ErrorAlert, ErrorList } from '@/components/ui/error-alert';

function ContactForm() {
  const [errors, setErrors] = useState({});

  return (
    <form>
      {/* Show individual error */}
      {errors.email && <ErrorAlert error={errors.email} />}
      
      {/* Or show all errors */}
      {Object.keys(errors).length > 0 && <ErrorList errors={errors} />}
      
      {/* Form fields */}
    </form>
  );
}
```

### 4. Manually Handling Errors with Error Formatting

For custom error handling:

```jsx
import { formatError, ErrorType } from '@/utils/errorHandler';

try {
  // Some operation that might fail
} catch (error) {
  // Format the error with a specific type
  const formattedError = formatError(error, ErrorType.VALIDATION);
  console.error(formattedError);
  
  // User-friendly message is available at:
  alert(formattedError.userMessage);
}
```

## Detailed Component Documentation

### Error Handler Utility

The `errorHandler.ts` utility provides several functions:

- `formatError`: Formats any kind of error into a standardized structure
- `getUserFriendlyMessage`: Gets a user-friendly message for an error code
- `handleApiError`: Handles API errors from fetch requests
- `fetchWithErrorHandling`: A wrapper around fetch that handles errors

### Error Boundary

The Error Boundary component catches JavaScript errors anywhere in its child component tree:

```jsx
import ErrorBoundary from '@/components/ui/error-boundary';

<ErrorBoundary onError={(error) => logError(error)}>
  <YourComponent />
</ErrorBoundary>
```

You can also use the HOC version:

```jsx
import { withErrorBoundary } from '@/components/ui/error-boundary';

const SafeComponent = withErrorBoundary(UnsafeComponent);
```

### API State Wrapper

The API State Wrapper component handles loading states and errors for API operations:

```jsx
<ApiStateWrapper
  isLoading={loading}
  error={error}
  loadingComponent={<CustomLoader />}  // Optional
  errorComponent={<CustomError />}     // Optional
  onRetry={retry}                     // Optional
>
  <YourComponent />
</ApiStateWrapper>
```

### Error Alert Components

Two components for displaying errors:

1. `ErrorAlert`: Displays a single error
2. `ErrorList`: Displays multiple errors, useful for form validation

### useApi Hook

A React hook for making API requests with built-in error handling:

```jsx
const { 
  isLoading,  // Boolean indicating if a request is in progress
  error,      // Error object if the request failed
  data,       // Response data if the request succeeded
  get,        // Function for GET requests
  post,       // Function for POST requests
  put,        // Function for PUT requests
  delete,     // Function for DELETE requests
  request,    // Generic request function
  reset       // Function to reset the state
} = useApi();
```

## Best Practices

1. **Use Error Boundaries for Component Errors**:
   Place Error Boundaries around components that might fail to prevent the whole app from crashing.

2. **Use ApiStateWrapper for API-dependent UI**:
   Wrap components that depend on API data with ApiStateWrapper to handle loading and error states.

3. **Use ErrorAlert for Form Validation**:
   Display validation errors using ErrorAlert or ErrorList components.

4. **Use the useApi Hook for API Calls**:
   Prefer the useApi hook over direct fetch calls to benefit from automatic error handling.

5. **Add Context to Errors**:
   When formatting errors manually, include relevant context like the component or operation name.

## Error Types

The system defines several error types for better categorization:

- `API`: Errors from API requests
- `VALIDATION`: Form validation errors
- `AUTHENTICATION`: Authentication-related errors
- `NETWORK`: Network connectivity issues
- `UNEXPECTED`: Unhandled exceptions
- `NOT_FOUND`: Resource not found errors
- `PERMISSION`: Permission/authorization errors

## Troubleshooting

### Common Issues

1. **Errors not being caught by Error Boundary**:
   Ensure the error is thrown during rendering. Errors in event handlers need to be caught manually.

2. **useApi hook not showing error messages**:
   Check if `showErrorToast` is set to true in the options.

3. **Custom error messages not displaying**:
   Ensure you're using the `formatError` function to create properly structured errors.

### Debugging in Development

In development mode, error components will show detailed error information including stack traces. This information is automatically hidden in production builds.

## Example Page

Visit `/error-handling-demo` in the application to see live examples of the error handling components and techniques. 