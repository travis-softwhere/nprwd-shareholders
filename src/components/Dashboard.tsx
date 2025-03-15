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
  const { data: session } = useSession();
  const router = useRouter();
  const { meetings, selectedMeeting } = useMeeting();
  const [barcodeInput, setBarcodeInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Track window dimensions to trigger re-renders on resize
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });
  
  // Local state to track attendance so that the pie chart updates dynamically.
  const [attendance, setAttendance] = useState({
    total: totalShareholders,
    checkedIn: checkedInCount,
  });

  // Handle window resize events to update responsive chart elements
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Call handler right away to ensure initial state matches window size
    handleResize();
    
    // Remove event listener on cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update attendance when meetings or selectedMeeting changes
  useEffect(() => {
    if (meetings && meetings.length > 0) {
      const latestMeeting = selectedMeeting || meetings[0];
      setAttendance({
        total: latestMeeting.totalShareholders || totalShareholders,
        checkedIn: latestMeeting.checkedIn || checkedInCount,
      });
    }
  }, [meetings, selectedMeeting, totalShareholders, checkedInCount]);

  // Show loading skeleton during data fetch, rather than for auth state
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
    // Use selected meeting date from context if available
    const dateToUse = selectedMeeting ? selectedMeeting.date : nextMeetingDate;
    const meetingDate = new Date(dateToUse);
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
    // Use selected meeting date from context if available and no dateString provided
    const dateToFormat = selectedMeeting && !dateString ? selectedMeeting.date : dateString;
    const date = new Date(dateToFormat);
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
    // Fetch available meetings if we don't have a selected one
    if (!selectedMeeting) {
      // Instead of showing an error, check if we have any available meetings
      if (meetings && meetings.length > 0) {
        // Use the most recent meeting by default
        const latestMeeting = meetings[meetings.length - 1];
        
        try {
          setLoading(true);
          const payload = JSON.stringify({ meetingId: latestMeeting.id });
         

          const response = await fetch("/api/print-mailers", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/pdf",
            },
            body: payload,
          });

          console.log("Response received:", {
            status: response.status,
            statusText: response.statusText,
          });

          if (!response.ok) {
            throw new Error(`Failed to generate mailers: ${response.status} ${response.statusText}`);
          }

          const blob = await response.blob();
         
          const url = window.URL.createObjectURL(blob);
         
          
          // Create an invisible anchor to trigger download
          const a = document.createElement("a");
          a.style.display = "none";
          a.href = url;
          a.download = `${latestMeeting.year}-invitations.pdf`;
          document.body.appendChild(a);
          a.click();
          
          // Clean up
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          setLoading(false);
        } catch (error) {
          setError(error instanceof Error ? error.message : "Failed to generate mailers");
          setLoading(false);
        }
        return;
      } else {
        setError("No meetings are available. Please upload meeting data first.");
        return;
      }
    }

    // Continue with selected meeting if available
    setLoading(true);

    try {
      const payload = JSON.stringify({ meetingId: selectedMeeting.id });
      console.log("Dashboard payload being sent:", payload);

      const response = await fetch("/api/print-mailers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/pdf",
        },
        body: payload,
      });

      console.log("Response received:", {
        status: response.status,
        statusText: response.statusText,
      });

      if (!response.ok) {
        throw new Error(`Failed to generate mailers: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      console.log("PDF blob received, size:", blob.size);
      const url = window.URL.createObjectURL(blob);
      console.log("PDF URL created:", url);
      
      // Create an invisible anchor to trigger download
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `${selectedMeeting.year}-invitations.pdf`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setLoading(false);
    } catch (error) {
      console.error("Error generating mailers:", error);
      setError(error instanceof Error ? error.message : "Failed to generate mailers");
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
              <div className="h-[130px] xs:h-[140px] sm:h-[180px] md:h-[220px] lg:h-[240px] xl:h-[260px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={windowSize.width < 380 ? 30 : 
                                   windowSize.width < 640 ? 35 : 
                                   windowSize.width < 768 ? 45 :
                                   windowSize.width < 835 ? 42 : // iPad Mini specific
                                   windowSize.width < 1024 ? 50 : 
                                   windowSize.width < 1280 ? 60 : 70}
                      outerRadius={windowSize.width < 380 ? 45 : 
                                   windowSize.width < 640 ? 55 : 
                                   windowSize.width < 768 ? 65 :
                                   windowSize.width < 835 ? 62 : // iPad Mini specific
                                   windowSize.width < 1024 ? 75 : 
                                   windowSize.width < 1280 ? 90 : 100}
                      paddingAngle={windowSize.width >= 768 && windowSize.width < 835 ? 5 : 4} // Slightly more separation for iPad Mini
                      dataKey="value"
                      label={windowSize.width < 480 ? false : 
                             (windowSize.width >= 768 && windowSize.width < 835) ? false : // Remove labels on iPad Mini
                             {
                               fill: '#666',
                               fontSize: windowSize.width < 1024 ? 10 : 12,
                               offset: 10
                             }}
                      labelLine={windowSize.width < 480 ? false : 
                                (windowSize.width >= 768 && windowSize.width < 835) ? false : // Remove label lines on iPad Mini
                                {
                                  stroke: '#999',
                                  strokeWidth: 1
                                }}
                      stroke="#fff"
                      strokeWidth={windowSize.width >= 768 && windowSize.width < 835 ? 3 : 2} // Thicker stroke on iPad Mini
                    >
                      {pieData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[index]} 
                          style={{ filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.1))' }}
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any, name: string) => [
                        `${value} shareholders (${Math.round((Number(value) / attendance.total) * 100)}%)`, 
                        name
                      ]}
                      contentStyle={{ 
                        fontSize: windowSize.width < 640 ? '10px' : (windowSize.width >= 768 && windowSize.width < 835) ? '11px' : '12px',
                        padding: windowSize.width < 1024 ? (windowSize.width >= 768 && windowSize.width < 835 ? '6px 10px' : '4px 8px') : '8px 12px',
                        borderRadius: '6px',
                        boxShadow: '0 3px 10px rgba(0,0,0,0.15)',
                        border: 'none'
                      }}
                      itemStyle={{ 
                        padding: windowSize.width < 1024 ? '2px 0' : '3px 0' 
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ 
                        fontSize: windowSize.width < 380 ? '9px' : 
                                  windowSize.width < 640 ? '10px' : 
                                  (windowSize.width >= 768 && windowSize.width < 835) ? '11px' : // iPad Mini specific
                                  windowSize.width < 1024 ? '12px' : '13px',
                        paddingTop: windowSize.width < 480 ? 5 : 
                                    (windowSize.width >= 768 && windowSize.width < 835) ? 0 : 10, // Adjust padding for iPad Mini
                        bottom: windowSize.width < 480 ? 0 : 
                                (windowSize.width >= 768 && windowSize.width < 835) ? 5 : 10 // Adjust bottom for iPad Mini
                      }}
                      iconSize={windowSize.width < 480 ? 8 : 
                                (windowSize.width >= 768 && windowSize.width < 835) ? 12 : // Larger icons on iPad Mini
                                windowSize.width < 1024 ? 10 : 14}
                      iconType="circle"
                      layout={windowSize.width < 380 ? "horizontal" : 
                              (windowSize.width >= 768 && windowSize.width < 835) ? "horizontal" : // Horizontal layout on iPad Mini
                              windowSize.width < 1024 ? "vertical" : "horizontal"}
                      verticalAlign={windowSize.width < 1024 && !(windowSize.width >= 768 && windowSize.width < 835) ? "middle" : "bottom"}
                      align={windowSize.width < 380 ? "center" : 
                             (windowSize.width >= 768 && windowSize.width < 835) ? "center" : // Center align on iPad Mini
                             windowSize.width < 1024 ? "right" : "center"}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center items-center mt-1 xs:mt-2 sm:mt-3 md:mt-4 gap-3 sm:gap-6 md:gap-10">
                <div className={`text-center bg-green-50 px-2 py-1 xs:py-1.5 md:px-4 md:py-2 rounded-lg shadow-sm hover:shadow-md transition-shadow ${windowSize.width >= 768 && windowSize.width < 835 ? 'px-3 py-2' : ''}`}>
                  <p className={`text-xl xs:text-2xl sm:text-3xl md:text-4xl font-bold text-green-500 ${windowSize.width >= 768 && windowSize.width < 835 ? 'text-3xl' : ''}`}>{checkedInPercentage}%</p>
                  <p className={`text-[10px] xs:text-xs md:text-sm text-gray-600 ${windowSize.width >= 768 && windowSize.width < 835 ? 'text-xs' : ''}`}>Checked In</p>
                </div>
                <div className={`text-center bg-gray-50 px-2 py-1 xs:py-1.5 md:px-4 md:py-2 rounded-lg shadow-sm hover:shadow-md transition-shadow ${windowSize.width >= 768 && windowSize.width < 835 ? 'px-3 py-2' : ''}`}>
                  <p className={`text-sm xs:text-base sm:text-lg md:text-xl font-medium ${windowSize.width >= 768 && windowSize.width < 835 ? 'text-lg' : ''}`}>{attendance.checkedIn} / {attendance.total}</p>
                  <p className={`text-[10px] xs:text-xs md:text-sm text-gray-600 ${windowSize.width >= 768 && windowSize.width < 835 ? 'text-xs' : ''}`}>Shareholders</p>
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
