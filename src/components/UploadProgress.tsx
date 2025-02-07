import { ProgressBar } from "./ProgressBar"
import { Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

interface UploadProgressProps {
    isUploading: boolean
    progress: number
    currentStep: string
    error: string | null
}

export function UploadProgress({ isUploading, progress, currentStep, error }: UploadProgressProps) {
    if (!isUploading && !error) return null

    return (
        <div className="w-full space-y-4 rounded-lg border border-gray-200 p-4 bg-gray-50">
            {error ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : (
                <>
                    <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <p className="text-sm font-medium">{currentStep}</p>
                    </div>

                    <div className="space-y-2">
                        <ProgressBar progress={progress} />
                        <p className="text-xs text-gray-500">Progress: {progress.toFixed(2)}%</p>
                    </div>
                </>
            )}
        </div>
    )
}