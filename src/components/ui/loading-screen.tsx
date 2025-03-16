import { Loader2 } from "lucide-react"

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-4" />
        <p className="text-lg text-gray-600">{message}</p>
      </div>
    </div>
  );
} 