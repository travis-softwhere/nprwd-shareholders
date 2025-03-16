"use client"

import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"

interface UploadProgressProps {
    isUploading: boolean
    progress: number
    currentStep: string
    error: string | null
    onComplete: () => void
}

export function UploadProgress({
    isUploading,
    progress,
    currentStep,
    error,
    onComplete,
}: UploadProgressProps) {
    const isComplete = progress === 100 && !error
    const showDialog = isUploading || isComplete

    return (
        <Dialog open={showDialog} onOpenChange={() => isComplete && onComplete()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {error ? "Upload Failed" : isComplete ? "Upload Complete" : "Uploading File..."}
                    </DialogTitle>
                </DialogHeader>
                
                <div className="py-6 space-y-4">
                    {!error && (
                        <Progress 
                            value={progress} 
                            className="w-full h-2 transition-all duration-300"
                        />
                    )}
                    
                    <p className="text-center text-sm text-muted-foreground">
                        {error ? (
                            <span className="text-destructive">{error}</span>
                        ) : (
                            <>
                                {isComplete ? (
                                    "File uploaded successfully!"
                                ) : (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        {currentStep}
                                    </span>
                                )}
                            </>
                        )}
                    </p>
                </div>

                {(isComplete || error) && (
                    <DialogFooter>
                        <Button onClick={onComplete}>
                            {error ? "Try Again" : "OK"}
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    )
}