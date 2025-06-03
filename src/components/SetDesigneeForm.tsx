"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSession } from 'next-auth/react';

interface SetDesigneeFormProps {
  shareholderId: string;
}

export default function SetDesigneeForm({ shareholderId }: SetDesigneeFormProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin === true;
  const [designee, setDesignee] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentDesignee, setCurrentDesignee] = useState<string | null>(null);

  // Fetch current designee on component mount
  const fetchCurrentDesignee = async () => {
    try {
      const response = await fetch(`/api/designee?shareholderId=${shareholderId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        }
      });

      if (!response.ok) {
        throw new Error("Failed to fetch designee");
      }

      const data = await response.json();
      setCurrentDesignee(data.designee);
    } catch (error) {
      console.error("Error fetching designee:", error);
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
          designee,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to set designee");
      }

      setDesignee("");
      await fetchCurrentDesignee();
    } catch (error) {
      console.error("Error setting designee:", error);
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
          designee: null,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to clear designee");
      }
      setDesignee("");
      await fetchCurrentDesignee();
    } catch (error) {
      console.error("Error clearing designee:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 mt-2">
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <span>Current Designee:</span>
        {currentDesignee && (
          <span className="font-medium">{currentDesignee}</span>
        )}
      </div>
      {isAdmin && (
        <Button className="w-fit" type="button" onClick={handleClear} disabled={isSubmitting || !currentDesignee}>Clear Designee</Button>
      )}
      <div className="flex flex-row gap-2 items-center">
        {isAdmin && (
          <>
            <Input
              type="text"
              value={designee}
              onChange={(e) => setDesignee(e.target.value)}
              placeholder="Enter designee name"
              disabled={isSubmitting}
            />
            <Button type="submit" disabled={isSubmitting || !designee.trim()}>
              Set Designee
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
