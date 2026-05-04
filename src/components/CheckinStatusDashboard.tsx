"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useMeeting } from "@/contexts/MeetingContext";
import { useToast } from "@/components/ui/use-toast";
import { getMeetingStats } from "@/actions/getMeetingStats";
import { Calendar, CheckCircle, Download, Loader2, RefreshCw, Computer } from "lucide-react";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { GeneratedPDFsList } from "@/components/GeneratedPDFsList"
import { AttendanceCard } from "@/components/AttendanceCard";

// --- CheckinStatusDashboard Component --- 
const COLORS = ["#22c55e", "#ef4444"];
const BATCH_SIZE = 50;

function extractZipCode(cityStateZip: string | undefined): string {
  if (!cityStateZip) return '';
  const match = cityStateZip.match(/\d{5}(?:-\d{4})?$/);
  return match ? match[0] : '';
}

export function CheckinStatusDashboard() {
  const { data: session } = useSession();
  const { meetings, selectedMeeting, setSelectedMeeting } = useMeeting();
  const { toast } = useToast();

  // Attendance state
  const [stats, setStats] = useState({ total: 0, checkedIn: 0 });
  const [loadingStats, setLoadingStats] = useState(false);

  /** Large figure + short label for time until the selected meeting (from Meeting context). */
  const [timeUntilMeeting, setTimeUntilMeeting] = useState({ main: "—", sub: "NO MEETING SELECTED" });

  // PDF mailer state
  const [isGenerating, setIsGenerating] = useState(false);
  const [mailerProgress, setMailerProgress] = useState(0);
  const [showMailerDialog, setShowMailerDialog] = useState(false);
  const [currentBatchNumber, setCurrentBatchNumber] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [currentBatchStatus, setCurrentBatchStatus] = useState("");
  const [currentBatchShareholderCount, setCurrentBatchShareholderCount] = useState(0);
  const [isLocalMode, setIsLocalMode] = useState(false);

  // Auto-select first meeting if none
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

  // Fetch attendance stats
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

  // Handlers
  useEffect(() => {
    updateTimeUntilMeeting();
    fetchStats();
    const timer = setInterval(updateTimeUntilMeeting, 60_000);
    return () => clearInterval(timer);
  }, [updateTimeUntilMeeting, fetchStats]);

  // Add effect to detect local mode
  useEffect(() => {
    setIsLocalMode(process.env.NODE_ENV === 'development');
  }, []);

  const handleGenerateMailers = async () => {
    if (!selectedMeeting) return;
    setIsGenerating(true);
    setShowMailerDialog(true);
    setMailerProgress(0);
    setCurrentBatchNumber(0);
    setTotalBatches(0);
    setCurrentBatchStatus('');
    setCurrentBatchShareholderCount(0);
    let batches: any[] = [];
    let errorOccurred = false;

    try {
      // Clear all existing PDFs for this meeting first
      const clearEndpoint = isLocalMode ? "/api/generate-local-pdfs" : "/api/generated-pdfs";
      await fetch(clearEndpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: selectedMeeting.id })
      });

      // Fetch all shareholders for this meeting
      const shareholdersRes = await fetch(`/api/shareholders?meetingId=${selectedMeeting.id}`);
      if (!shareholdersRes.ok) throw new Error("Failed to fetch shareholders");
      const shareholdersData = await shareholdersRes.json();
      const allShareholders = shareholdersData.shareholders;
      if (!Array.isArray(allShareholders) || allShareholders.length === 0) throw new Error("No shareholders found");

      // Sort allShareholders by ZIP code before batching
      allShareholders.sort((a, b) => {
        const zipA = extractZipCode(a.ownerCityStateZip || a.cityStateZip || '');
        const zipB = extractZipCode(b.ownerCityStateZip || b.cityStateZip || '');
        return zipA.localeCompare(zipB);
      });

      // Split into batches
      const totalBatchesCalc = Math.ceil(allShareholders.length / BATCH_SIZE);
      setTotalBatches(totalBatchesCalc);
      for (let i = 0; i < allShareholders.length; i += BATCH_SIZE) {
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        setCurrentBatchNumber(batchNumber);
        const rawBatch = allShareholders.slice(i, i + BATCH_SIZE);
        setCurrentBatchShareholderCount(rawBatch.length);
        setCurrentBatchStatus('Generating PDF...');
        setMailerProgress(Math.round((batchNumber - 1) / totalBatchesCalc * 95));

        // Ensure each shareholder has ownerMailingAddress and ownerCityStateZip from properties[0]
        const batch = rawBatch.map(sh => ({
          ...sh,
          ownerMailingAddress: sh.ownerMailingAddress || '',
          ownerCityStateZip: sh.ownerCityStateZip || '',
        }));

        // POST to appropriate endpoint based on mode
        const endpoint = isLocalMode ? "/api/generate-local-pdfs" : "/api/print-mailers";
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meetingId: selectedMeeting.id, batchNumber, batch })
        });
        setCurrentBatchStatus('Uploading PDF...');
        if (!res.ok) {
          errorOccurred = true;
          setCurrentBatchStatus('Error');
          throw new Error(`Failed to generate PDF for batch ${batchNumber}`);
        }
        setCurrentBatchStatus('Completed');
        const data = await res.json();
        batches.push(data);
        // Optionally, add a small delay for UI smoothness
        await new Promise(r => setTimeout(r, 300));
      }
      setMailerProgress(100);
      setCurrentBatchStatus('All batches completed');
      toast({ 
        title: "Success", 
        description: `All ${batches.length} mailer batches generated successfully${isLocalMode ? ' (Local Mode)' : ''}`, 
        variant: "default" 
      });
    } catch (err: any) {
      errorOccurred = true;
      setCurrentBatchStatus('Error');
      toast({ title: "Error", description: err.message || "Failed to generate mailers", variant: "destructive" });
      setMailerProgress(0);
    } finally {
      setIsGenerating(false);
      if (!errorOccurred) setShowMailerDialog(false);
    }
  };

  if (session?.user?.isAdmin !== true) {
    // Don't render anything if not admin, let AdminPage handle denial
    return null;
  }

  const pieData = [
    { name: "Checked In", value: stats.checkedIn },
    { name: "Remaining", value: stats.total - stats.checkedIn }
  ];

  return (
    <>
      <div className="grid md:grid-cols-3 gap-6 mb-6"> {/* Added mb-6 for spacing */}
        {/* Attendance Card */}
        <AttendanceCard
          checkedIn={stats.checkedIn}
          total={stats.total}
          loading={loadingStats}
          onRefresh={fetchStats}
        />

        {/* Countdown Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0"> {/* Adjusted layout */}
            <div className="flex items-center gap-2">
               <Calendar className="h-5 w-5 text-amber-600" /> {/* Sized icon */}
               <CardTitle className="text-sm font-medium">Time til current meeting</CardTitle>
            </div>
             {/* Optional: Add refresh button if date can change */}
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

        {/* PDF Mailer Card
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-sm font-medium">Invitations</CardTitle>
            </div>
            {isLocalMode && (
              <div className="flex items-center gap-1 text-xs text-amber-600">
                <Computer className="h-3 w-3" />
                Local Mode
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-4">
            <p className="mb-3 text-xs text-gray-600">
              {isLocalMode 
                ? "Generate PDF invitations locally (Development Mode)"
                : "Generate PDF invitations with unique check-in codes"}
            </p>
            <Button className="w-full" size="sm" onClick={handleGenerateMailers} disabled={isGenerating}>
              {isGenerating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Generating...</>
              ) : (
                <><Download className="mr-2 h-4 w-4"/>Generate Invitations</>
              )}
            </Button>
          </CardContent>

          <CardContent>
            <GeneratedPDFsList />
          </CardContent>
        </Card> */}
      </div>

      {/* Mailer Progress Dialog */}
      <Dialog open={showMailerDialog} onOpenChange={setShowMailerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mailerProgress === 100 ? "Invitations Ready!" : "Generating Invitations..."}
            </DialogTitle>
            {mailerProgress < 100 && (
              <DialogDescription>
                Batch {currentBatchNumber} of {totalBatches} ({totalBatches - currentBatchNumber + 1} remaining)
                <br />
                {currentBatchStatus} ({currentBatchShareholderCount} shareholders)
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="py-4">
            <Progress value={mailerProgress} className="w-full" />
            {mailerProgress < 100 && (
              <p className="text-center text-sm text-muted-foreground mt-2">{mailerProgress}% complete</p>
            )}
            {mailerProgress === 100 && (
              <p className="text-center text-sm text-green-600 mt-2">Your download should start automatically.</p>
            )}
          </div>
          {mailerProgress === 100 && (
            <DialogFooter>
              <Button onClick={() => setShowMailerDialog(false)}>Close</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
// --- End CheckinStatusDashboard --- 