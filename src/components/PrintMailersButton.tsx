"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Printer, Loader2 } from "lucide-react"

interface PrintMailersButtonProps {
    meetingId: string
    onComplete?: () => Promise<void> | void
    disabled?: boolean
    className?: string
}

export function PrintMailersButton({ meetingId, onComplete, disabled, className }: PrintMailersButtonProps) {
    const [isPrinting, setIsPrinting] = useState(false)
    const { toast } = useToast()

    const handlePrintMailers = async (e: React.MouseEvent<HTMLButtonElement>) => {
        // Prevent default button behavior
        e.preventDefault()

        console.log("Print mailers clicked", { meetingId }) // Debug log

        if (!meetingId) {
            toast({
                title: "Error",
                description: "Meeting ID is required",
                variant: "destructive",
            })
            return
        }

        setIsPrinting(true)

        try {
            console.log("Sending request with meetingId:", meetingId) // Debug log

            console.log("Sending request:", {
                method: "POST",
                url: "/api/print-mailers",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/pdf",
                },
                body: JSON.stringify({ meetingId }),
            })

            const body = JSON.stringify({ meetingId })

            console.log("Sending fetch request with body:", body)

            const response = await fetch("/api/print-mailers", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/pdf",
                },
                body: body, // Ensure body is passed correctly
                cache: "no-cache",
                credentials: "same-origin",
            })


            console.log("Response received:", {
                status: response.status,
                contentType: response.headers.get("content-type"),
            }) // Debug log

            if (!response.ok) {
                let errorMessage = "Failed to generate mailers"
                try {
                    const errorData = await response.json()
                    errorMessage = errorData.error || errorMessage
                } catch {
                    // If JSON parsing fails, use default error message
                }
                throw new Error(errorMessage)
            }

            // Check content type to determine if it's a PDF
            const contentType = response.headers.get("content-type")
            if (!contentType?.includes("application/pdf")) {
                throw new Error("Invalid response format")
            }

            // Handle PDF download
            const blob = await response.blob()
            const url = URL.createObjectURL(blob)

            // Create and click a temporary download link
            const a = document.createElement("a")
            a.href = url
            a.download = "shareholder-mailers.pdf"
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            toast({
                title: "Success",
                description: "Mailers generated successfully",
            })

            if (onComplete) {
                await onComplete()
            }
        } catch (error) {
            console.error("Print mailers error:", error)
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to generate mailers",
                variant: "destructive",
            })
        } finally {
            setIsPrinting(false)
        }
    }

    return (
        <Button
            onClick={handlePrintMailers}
            disabled={disabled || isPrinting}
            className={className}
            variant="default"
            type="button" // Explicitly set button type
        >
            {isPrinting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
            {isPrinting ? "Generating..." : "Print Mailers"}
        </Button>
    )
}