"use client"

import { useEffect, useState } from "react"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2 } from "lucide-react"

interface UploadProgressProps {
    isUploading: boolean
    progress: number
    currentStep: string
    error: string | null
}

export function UploadProgress({ isUploading, progress, currentStep, error }: UploadProgressProps) {
    const [elapsedTime, setElapsedTime] = useState(0)

    useEffect(() => {
        let intervalId: NodeJS.Timeout

        if (isUploading && !error) {
            intervalId = setInterval(() => {
                setElapsedTime((prev) => prev + 1)
            }, 1000)
        } else if (!isUploading) {
            setElapsedTime(0)
        }

        return () => {
            if (intervalId) {
                clearInterval(intervalId)
            }
        }
    }, [isUploading, error])

    if (!isUploading && !error && !currentStep) {
        return null
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, "0")}`
    }

    return (
        <div className="space-y-4 mt-4">
            {error ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Upload Failed</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : (
                <>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{currentStep}</span>
                        {isUploading && (
                            <span className="text-sm text-muted-foreground">Time elapsed: {formatTime(elapsedTime)}</span>
                        )}
                    </div>
                    <Progress value={progress} className="w-full" />
                    {progress === 100 && !isUploading && (
                        <Alert>
                            <CheckCircle2 className="h-4 w-4" />
                            <AlertTitle>Success</AlertTitle>
                            <AlertDescription>Upload completed successfully!</AlertDescription>
                        </Alert>
                    )}
                </>
            )}
        </div>
    )
}