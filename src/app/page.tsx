"use client";

import { useEffect } from "react";
import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { useSession } from "next-auth/react";
import { useMeeting } from "@/contexts/MeetingContext";
import { LoadingScreen } from "@/components/ui/loading-screen";

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
    return <LoadingScreen message="Loading dashboard..." />;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <Dashboard />
    </main>
  );
}