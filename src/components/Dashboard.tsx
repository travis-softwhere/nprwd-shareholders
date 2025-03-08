"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, CheckCircle, XCircle, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useMeeting } from "@/contexts/MeetingContext";
import { useSession } from "next-auth/react";

interface DashboardProps {
  totalShareholders: number;
  checkedInCount: number;
  nextMeetingDate?: string;
  mailersStatus: boolean;
}

const COLORS = ["#22c55e", "#ef4444"]; // green-500 and red-500

const Dashboard: React.FC<DashboardProps> = ({
  totalShareholders,
  checkedInCount,
  nextMeetingDate = "2024-06-15",
  mailersStatus = false,
}) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { meetings, selectedMeeting } = useMeeting();
  const [barcodeInput, setBarcodeInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Local state to track attendance so that the pie chart updates dynamically.
  const [attendance, setAttendance] = useState({
    total: totalShareholders,
    checkedIn: checkedInCount,
  });

  // Redirect if unauthenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-lg text-gray-500">Loading...</p>
      </div>
    );
  }

  // Check if meetings have been loaded
  if (!meetings || meetings.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-lg text-gray-500">
          Please upload data in the Admin page first.
        </p>
      </div>
    );
  }

  // Calculate attendance stats
  const checkedInPercentage = Math.round((attendance.checkedIn / attendance.total) * 100);
  const notCheckedInCount = attendance.total - attendance.checkedIn;
  const pieData = [
    { name: "Checked In", value: attendance.checkedIn },
    { name: "Not Checked In", value: notCheckedInCount },
  ];

  const daysUntilMeeting = () => {
    const meetingDate = new Date(nextMeetingDate);
    if (isNaN(meetingDate.getTime())) {
      // Return a default string if nextMeetingDate is invalid
      return "N/A";
    }
    const today = new Date();
    const diffTime = meetingDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    // If diffDays is NaN for any reason, return a default value
    return isNaN(diffDays) ? "N/A" : diffDays.toString();
  };
  

  const handleBarcodeSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!barcodeInput) return;
    
    setLoading(true);
    setError("");
    
    try {
      console.log("Attempting check-in for shareholder:", barcodeInput);
      const response = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareholderId: barcodeInput }),
      });
      
      const data = await response.json();
      console.log("Check-in response:", data);
      
      if (!response.ok) {
        console.error("Check-in failed:", data.error);
        setError(data.error || "Check-in failed.");
        return;
      }

      // Update local attendance state with the returned meeting data
      if (data.meeting) {
        console.log("Updating attendance with:", data.meeting);
        setAttendance({
          total: data.meeting.total_shareholders || attendance.total,
          checkedIn: data.meeting.checked_in || attendance.checkedIn,
        });
      }

      // Navigate to the shareholder detail page
      router.push(`/shareholders/${barcodeInput}`);
      setBarcodeInput("");
    } catch (err) {
      console.error("Error during check-in", err);
      setError("An error occurred during check-in.");
    } finally {
      setLoading(false);
    }
  };

  // Updated handlePrintMailers that uses selectedMeeting from context
  const handlePrintMailers = async () => {
    if (!selectedMeeting) {
      console.error("No meeting selected.");
      return;
    }

    // Build payload using meeting id from selectedMeeting
    const payload = JSON.stringify({ meetingId: selectedMeeting.id });
    console.log("Dashboard payload being sent:", payload);

    try {
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

      if (!response.ok) throw new Error("Failed to generate mailers");

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
    } catch (error) {
      console.error("Error generating mailers:", error);
    }
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Attendance Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Shareholder Attendance</CardTitle>
            <CardDescription>Current check-in status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index]} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-center">
              <p className="text-2xl font-bold">{checkedInPercentage}%</p>
              <p className="text-sm text-gray-500">Checked In</p>
            </div>
          </CardContent>
        </Card>

        {/* Meeting Countdown */}
        <Card>
          <CardHeader>
            <CardTitle>Next Meeting</CardTitle>
            <CardDescription>Shareholder meeting countdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center space-x-4">
              <Calendar className="h-8 w-8 text-gray-500" />
              <div>
              <p className="text-2xl font-bold">{daysUntilMeeting()}</p>
                <p className="text-sm text-gray-500">Days Remaining</p>
              </div>
            </div>
            <p className="mt-4 text-center text-sm text-gray-500">
              Meeting Date: {new Date(nextMeetingDate).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>

        {/* Mailer Status */}
        <Card>
          <CardHeader>
            <CardTitle>Meeting Notifications</CardTitle>
            <CardDescription>Generate and print meeting invitations for shareholders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center space-y-4">
              <div className="text-center space-y-2">
                <p className="text-sm text-gray-500">
                  Generate personalized meeting invitations for all shareholders, including their unique check-in codes.
                </p>
              </div>
              <Button
                onClick={handlePrintMailers}
                className="w-full max-w-xs"
                disabled={loading}
              >
                {loading ? (
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
      </div>

      {/* Quick Check-In Card */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Check-In</CardTitle>
          <CardDescription>
            Scan shareholder barcode to check in and view details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleBarcodeSubmit}
            className="flex flex-col items-center space-y-4"
          >
            <Input
              type="text"
              placeholder="Scan barcode"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              className="w-full max-w-md text-center text-lg"
              autoFocus
            />
            <Button type="submit" className="w-full max-w-md" disabled={loading}>
              {loading ? "Checking In..." : "Submit"}
            </Button>
          </form>
          {error && (
            <p className="mt-2 text-red-600 text-center">{error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
