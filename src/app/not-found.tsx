import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="p-8 max-w-md w-full bg-white rounded-lg shadow-md text-center">
        <div className="mb-6">
          <h1 className="text-6xl font-bold text-red-500 mb-2">404</h1>
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Page Not Found</h2>
          <p className="text-gray-500 mb-6">
            The page you are looking for doesn't exist or has been moved.
          </p>
        </div>
        
        <div className="flex flex-col space-y-2">
          <Button asChild>
            <Link href="/">
              Return to Dashboard
            </Link>
          </Button>
          
          <Button variant="outline" asChild>
            <Link href="/login">
              Sign In
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
} 