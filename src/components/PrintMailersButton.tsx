"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Printer, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface PrintMailersButtonProps {
  meetingId: string;
  onComplete: () => void;
  disabled: boolean;
}

export function PrintMailersButton({ meetingId, onComplete, disabled }: PrintMailersButtonProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handlePrintMailers = async () => {
    setIsPrinting(true);
    setProgress(10); // Start progress

    try {
      const payload = JSON.stringify({ meetingId });
      
      // Simulate progress during PDF generation
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

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

      clearInterval(progressInterval);

      if (!response.ok) throw new Error("Failed to generate mailers");

      setProgress(100);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "meeting-invitations.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      onComplete();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to generate mailers",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => {
        setIsPrinting(false);
        setProgress(0);
      }, 1000);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Meeting Invitations</CardTitle>
        <CardDescription>
          Create personalized invitations for all shareholders
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will generate a PDF containing personalized meeting invitations for all shareholders. 
            Each invitation includes the meeting details and a unique QR code for check-in.
          </p>
          
          {isPrinting && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                {progress < 100 ? 'Generating invitations...' : 'Download starting...'}
              </p>
            </div>
          )}

          <Button
            onClick={handlePrintMailers}
            disabled={disabled || isPrinting}
            className="w-full"
          >
            {isPrinting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating PDF...
              </>
            ) : (
              'Generate Invitations'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
