"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, CheckCircle, XCircle } from "lucide-react";
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
  const checkedInPercentage = Math.round((checkedInCount / totalShareholders) * 100);
  const notCheckedInCount = totalShareholders - checkedInCount;
  const pieData = [
    { name: "Checked In", value: checkedInCount },
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
  

  const handleBarcodeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (barcodeInput) {
      router.push(`/shareholders/${barcodeInput}`);
      setBarcodeInput("");
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
            <CardTitle>Mailer Status</CardTitle>
            <CardDescription>Meeting notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center space-y-4">
              <div className="flex items-center space-x-2">
                {mailersStatus ? (
                  <CheckCircle className="h-8 w-8 text-green-500" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-500" />
                )}
                <span className="text-lg">
                  {mailersStatus ? "Mailers Sent" : "Mailers Not Sent"}
                </span>
              </div>
              <Button
                onClick={handlePrintMailers}
                variant={mailersStatus ? "outline" : "default"}
              >
                {mailersStatus ? "Reprint Mailers" : "Print Mailers"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barcode Scanner Input */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Check-In</CardTitle>
          <CardDescription>Scan shareholder barcode to view details</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (barcodeInput) {
                router.push(`/shareholders/${barcodeInput}`);
                setBarcodeInput("");
              }
            }}
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
            <Button type="submit" className="w-full max-w-md">
              Submit
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
