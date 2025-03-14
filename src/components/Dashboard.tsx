"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, CheckCircle, XCircle, Loader2, Search } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
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
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-lg text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Check if meetings have been loaded
  if (!meetings || meetings.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="max-w-md w-full text-center bg-white p-8 rounded-xl shadow-md">
          <Calendar className="h-16 w-16 text-blue-500 mx-auto mb-4 opacity-70" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No Meetings Found</h2>
          <p className="text-gray-600 mb-6">
            Please upload data in the Admin page first to get started with managing your shareholder meetings.
          </p>
          <Button onClick={() => router.push('/admin')} className="w-full">
            Go to Admin
          </Button>
        </div>
      </div>
    );
  }

  // Calculate attendance stats
  const checkedInPercentage = Math.round((attendance.checkedIn / attendance.total) * 100) || 0;
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
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Not set";
    
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
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

    setLoading(true);

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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto bg-white px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 mb-16 md:mb-6 shadow-sm rounded-lg">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 md:mb-4">Dashboard</h1>
        
        {/* Statistics Grid */}
        <div className="grid gap-3 sm:gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {/* Attendance Stats */}
          <Card className="overflow-hidden transition-all hover:shadow-md">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-white pb-2 px-3 sm:px-6">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                Shareholder Attendance
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Current check-in status</CardDescription>
            </CardHeader>
            <CardContent className="pt-3 sm:pt-4 px-3 sm:px-6">
              <div className="h-[140px] sm:h-[180px] md:h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={window?.innerWidth < 640 ? 35 : 50}
                      outerRadius={window?.innerWidth < 640 ? 55 : 70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value} shareholders`, name]} />
                    <Legend wrapperStyle={{ fontSize: window?.innerWidth < 640 ? '10px' : '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center items-center mt-2 gap-4 sm:gap-6">
                <div className="text-center">
                  <p className="text-2xl sm:text-3xl font-bold text-green-500">{checkedInPercentage}%</p>
                  <p className="text-xs text-gray-500">Checked In</p>
                </div>
                <div className="text-center">
                  <p className="text-base sm:text-lg font-medium">{attendance.checkedIn} / {attendance.total}</p>
                  <p className="text-xs text-gray-500">Shareholders</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Meeting Countdown */}
          <Card className="overflow-hidden transition-all hover:shadow-md">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-white pb-2 px-3 sm:px-6">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
                Next Meeting
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Shareholder meeting countdown</CardDescription>
            </CardHeader>
            <CardContent className="pt-3 sm:pt-6 px-3 sm:px-6">
              <div className="flex items-center justify-center space-x-4 sm:space-x-6">
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-amber-500 mb-1">{daysUntilMeeting()}</div>
                  <p className="text-xs sm:text-sm text-gray-500">Days Remaining</p>
                </div>
              </div>
              <div className="mt-4 sm:mt-6 text-center">
                <div className="text-xs sm:text-sm font-medium text-gray-700">Meeting Date</div>
                <p className="text-sm sm:text-base text-gray-600">{formatDate(nextMeetingDate)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Mailer Status */}
          <Card className="overflow-hidden transition-all hover:shadow-md">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-white pb-2 px-3 sm:px-6">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
                Meeting Notifications
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Generate invitations for shareholders</CardDescription>
            </CardHeader>
            <CardContent className="pt-3 sm:pt-4 px-3 sm:px-6">
              <div className="flex flex-col items-center space-y-4">
                <div className="text-center space-y-2">
                  <p className="text-xs sm:text-sm text-gray-600">
                    Generate personalized meeting invitations with unique check-in codes for all shareholders.
                  </p>
                </div>
                <Button
                  onClick={handlePrintMailers}
                  className="w-full bg-purple-600 hover:bg-purple-700 transition-colors text-sm sm:text-base py-1.5 sm:py-2"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
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
        <Card className="mt-4 sm:mt-6 overflow-hidden transition-all hover:shadow-md">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-white pb-2 px-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Search className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              Quick Check-In
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Scan shareholder barcode or enter ID manually
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-3 sm:pt-6 px-3 sm:px-6">
            <form
              onSubmit={handleBarcodeSubmit}
              className="flex flex-col items-center space-y-3 sm:space-y-4"
            >
              <div className="relative w-full max-w-md">
                <Input
                  type="text"
                  placeholder="Enter ID or scan barcode"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="w-full pl-8 sm:pl-10 pr-4 py-2 sm:py-3 text-center text-sm sm:text-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg transition-all"
                  autoFocus
                />
                <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
              </div>
              <Button 
                type="submit" 
                className="w-full max-w-md bg-blue-600 hover:bg-blue-700 transition-colors text-sm sm:text-base py-1.5 sm:py-2" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                    Checking In...
                  </>
                ) : (
                  'Check In Shareholder'
                )}
              </Button>
            </form>
            {error && (
              <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-red-50 text-red-700 rounded-md text-center text-xs sm:text-sm">
                {error}
              </div>
            )}
          </CardContent>
          <CardFooter className="bg-gray-50 px-3 sm:px-6 py-2 sm:py-3">
            <p className="w-full text-xs text-gray-500 text-center">
              After check-in, you will be redirected to the shareholder's details page
            </p>
          </CardFooter>
        </Card>
        
        {/* Mobile spacing for bottom nav - increased slightly */}
        <div className="h-20 md:hidden"></div>
      </div>
    </div>
  );
};

export default Dashboard;
