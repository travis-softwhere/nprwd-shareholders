"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

interface SetDesigneeFormProps {
  shareholderId: string;
}

export default function SetDesigneeForm({ shareholderId }: SetDesigneeFormProps) {
  const router = useRouter();
  const [designee, setDesignee] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentDesignee, setCurrentDesignee] = useState<string | null>(null);

  const fetchCurrentDesignee = async () => {
    try {
      const response = await fetch(`/api/designee?shareholderId=${encodeURIComponent(shareholderId)}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch designated voter");
      }

      const data = await response.json();
      setCurrentDesignee(data.designee?.trim() || null);
    } catch (error) {
      console.error("Error fetching designated voter:", error);
    }
  };

  useEffect(() => {
    fetchCurrentDesignee();
  }, [shareholderId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/designee", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shareholderId,
          designee: designee.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to set designated voter",
        );
      }

      setDesignee("");
      await fetchCurrentDesignee();
      router.refresh();
      toast({ title: "Saved", description: "Designated voter updated." });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to set designated voter",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/designee", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shareholderId,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to clear designated voter",
        );
      }
      setDesignee("");
      await fetchCurrentDesignee();
      router.refresh();
      toast({ title: "Cleared", description: "Designated voter removed." });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to clear designated voter",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Designated voter:</span>
        {currentDesignee ? (
          <span className="font-medium text-foreground">{currentDesignee}</span>
        ) : (
          <span className="italic">Not set</span>
        )}
      </div>
      <Button
        className="w-fit"
        type="button"
        variant="outline"
        onClick={handleClear}
        disabled={isSubmitting || !currentDesignee}
      >
        Clear designated voter
      </Button>
      <div className="flex flex-row flex-wrap items-center gap-2">
        <Input
          type="text"
          value={designee}
          onChange={(e) => setDesignee(e.target.value)}
          placeholder="Enter designated voter name"
          disabled={isSubmitting}
          className="max-w-xs"
        />
        <Button type="submit" disabled={isSubmitting || !designee.trim()}>
          Set designated voter
        </Button>
      </div>
    </form>
  );
}
