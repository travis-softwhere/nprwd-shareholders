import { Progress } from "@/components/ui/progress"

interface ProgressBarProps {
    progress: number
    processedRecords: number
    totalRecords: number
}

export function ProgressBar({ progress, processedRecords, totalRecords }: ProgressBarProps) {
    return (
        <div className="w-full space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-center text-gray-500">
                Processed {processedRecords} of {totalRecords} records ({Math.round(progress)}%)
            </p>
        </div>
    )
}