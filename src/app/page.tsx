"use client";

import { useEffect } from "react";
import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { useSession } from "next-auth/react";
import { useMeeting } from "@/contexts/MeetingContext";

export default function Home() {
  const { data: session, status } = useSession();
  const { meetings, isLoading } = useMeeting();

  // Check authentication
  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }
  }, [status]);

  if (status === "loading" || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-t-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <Dashboard />
    </main>
  );
}