"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Mail, AlertCircle, CheckCircle2, FileDown } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface MailerGeneratorProps {
    meetingId: string
    onComplete: () => void
    disabled?: boolean
}

export function MailerGenerator({ meetingId, onComplete, disabled }: MailerGeneratorProps) {
    const [isGenerating, setIsGenerating] = useState(false)
    const [progress, setProgress] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)

    const generateMailers = async () => {
        setIsGenerating(true)
        setError(null)
        setPdfUrl(null)
        setProgress(0)

        try {
            const response = await fetch("/api/print-mailers", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ meetingId }),
            })

            if (!response.ok) {
                throw new Error("Failed to generate mailers")
            }

            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            setPdfUrl(url)
            setProgress(100)
            onComplete()
        } catch (error) {
            setError(error instanceof Error ? error.message : "Failed to generate mailers")
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Generate Mailer Documents</CardTitle>
                <CardDescription>
                    Generate PDF documents for all shareholders. This will also create a snapshot of the current data.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {error ? (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : pdfUrl ? (
                    <Alert>
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertTitle>Success</AlertTitle>
                        <AlertDescription className="flex items-center justify-between">
                            <span>Mailer documents generated successfully!</span>
                            <Button variant="outline" size="sm" onClick={() => window.open(pdfUrl, "_blank")} className="ml-2">
                                <FileDown className="h-4 w-4 mr-2" />
                                Download PDF
                            </Button>
                        </AlertDescription>
                    </Alert>
                ) : null}

                {isGenerating && (
                    <div className="space-y-2">
                        <Progress value={progress} className="w-full" />
                        <p className="text-sm text-muted-foreground text-center">Generating mailer documents...</p>
                    </div>
                )}

                <Button onClick={generateMailers} disabled={disabled || isGenerating} className="w-full">
                    <Mail className="h-4 w-4 mr-2" />
                    {isGenerating ? "Generating..." : "Generate Mailer Documents"}
                </Button>
            </CardContent>
        </Card>
    )
}