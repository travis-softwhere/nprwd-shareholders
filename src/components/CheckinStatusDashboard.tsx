"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useMeeting } from "@/contexts/MeetingContext";
import { useToast } from "@/components/ui/use-toast";
import { getMeetingStats } from "@/actions/getMeetingStats";
import { Calendar } from "lucide-react";
import {
  Card, CardHeader, CardTitle, CardContent
} from "@/components/ui/card";
import { AttendanceCard } from "@/components/AttendanceCard";

export function CheckinStatusDashboard() {
  const { data: session } = useSession();
  const { meetings, selectedMeeting, setSelectedMeeting } = useMeeting();
  const { toast } = useToast();

  const [stats, setStats] = useState({ total: 0, checkedIn: 0 });
  const [loadingStats, setLoadingStats] = useState(false);

  const [timeUntilMeeting, setTimeUntilMeeting] = useState({ main: "—", sub: "NO MEETING SELECTED" });

  useEffect(() => {
    if (meetings.length > 0 && !selectedMeeting) {
      setSelectedMeeting(meetings[0]);
    }
  }, [meetings, selectedMeeting, setSelectedMeeting]);

  const updateTimeUntilMeeting = useCallback(() => {
    if (!selectedMeeting?.date) {
      setTimeUntilMeeting({ main: "—", sub: "NO MEETING SELECTED" });
      return;
    }
    const target = new Date(selectedMeeting.date);
    if (Number.isNaN(target.getTime())) {
      setTimeUntilMeeting({ main: "—", sub: "INVALID MEETING DATE" });
      return;
    }
    const now = Date.now();
    if (target.getTime() <= now) {
      setTimeUntilMeeting({
        main: "Already past",
        sub: "THE SELECTED MEETING DATE HAS PASSED",
      });
      return;
    }
    const diffMs = target.getTime() - now;
    const days = Math.floor(diffMs / 86400000);
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor(diffMs / 60000);
    if (days >= 1) {
      setTimeUntilMeeting({
        main: String(days),
        sub: days === 1 ? "DAY UNTIL THIS MEETING" : "DAYS UNTIL THIS MEETING",
      });
      return;
    }
    if (hours >= 1) {
      setTimeUntilMeeting({
        main: String(hours),
        sub: hours === 1 ? "HOUR UNTIL THIS MEETING" : "HOURS UNTIL THIS MEETING",
      });
      return;
    }
    setTimeUntilMeeting({
      main: String(Math.max(1, minutes)),
      sub: minutes <= 1 ? "MINUTE UNTIL THIS MEETING" : "MINUTES UNTIL THIS MEETING",
    });
  }, [selectedMeeting]);

  const fetchStats = useCallback(async () => {
    if (!selectedMeeting) return;
    setLoadingStats(true);
    try {
      const { totalShareholders, checkedInCount } = await getMeetingStats(selectedMeeting.id);
      setStats({ total: totalShareholders, checkedIn: checkedInCount });
    } catch {
      toast({ title: "Error", description: "Failed to load attendance stats", variant: "destructive" });
    } finally {
      setLoadingStats(false);
    }
  }, [selectedMeeting, toast]);

  useEffect(() => {
    updateTimeUntilMeeting();
    fetchStats();
    const timer = setInterval(updateTimeUntilMeeting, 60_000);
    return () => clearInterval(timer);
  }, [updateTimeUntilMeeting, fetchStats]);

  if (session?.user?.isAdmin !== true) {
    return null;
  }

  return (
    <div className="grid md:grid-cols-2 gap-6 mb-6">
      <AttendanceCard
        checkedIn={stats.checkedIn}
        total={stats.total}
        loading={loadingStats}
        onRefresh={fetchStats}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-sm font-medium">Time til current meeting</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-center pt-4">
          <p
            className={
              timeUntilMeeting.main === "Already past"
                ? "text-2xl font-bold leading-tight"
                : "text-4xl font-bold"
            }
          >
            {timeUntilMeeting.main}
          </p>
          <p className="text-xs text-amber-600 uppercase tracking-wider mt-1">{timeUntilMeeting.sub}</p>
        </CardContent>
      </Card>
    </div>
  );
}
