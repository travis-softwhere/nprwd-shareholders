"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Printer, Loader2 } from "lucide-react";

interface PrintMailersButtonProps {
  meetingId: string;
  onComplete: () => Promise<void> | void;
  disabled?: boolean;
  isPrinting?: boolean;
  className?: string;
}

export function PrintMailersButton({
  meetingId,
  onComplete,
  disabled,
  className,
}: PrintMailersButtonProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const { toast } = useToast();

  console.log("PrintMailersButton rendered with meetingId:", meetingId);

  const handlePrintMailers = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    console.log("Button clicked - meetingId:", meetingId);
    if (!meetingId) {
      toast({
        title: "Error",
        description: "Meeting ID is required",
        variant: "destructive",
      });
      return;
    }

    setIsPrinting(true);

    try {
      const payload = JSON.stringify({ meetingId });
      console.log("Payload being sent:", payload);

      const response = await fetch("/api/print-mailers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/pdf",
        },
        body: payload,
        cache: "no-cache",
        credentials: "same-origin",
      });

      console.log("Response received:", {
        status: response.status,
        contentType: response.headers.get("content-type"),
      });

      if (!response.ok) {
        let errorMessage = "Failed to generate mailers";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {}
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/pdf")) {
        throw new Error("Invalid response format");
      }

      const blob = await response.blob();
      console.log("PDF blob received, size:", blob.size);
      const url = window.URL.createObjectURL(blob);
      console.log("PDF URL created:", url);

      const a = document.createElement("a");
      a.href = url;
      a.download = "shareholder-mailers.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Mailers generated successfully",
      });

      if (onComplete) {
        await onComplete();
      }
    } catch (error) {
      console.error("Print mailers error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to generate mailers",
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Button
      onClick={handlePrintMailers}
      disabled={disabled || isPrinting}
      className={className}
      variant="default"
      type="button"
    >
      {isPrinting ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Printer className="h-4 w-4 mr-2" />
      )}
      {isPrinting ? "Generating..." : "Print Mailers"}
    </Button>
  );
}
