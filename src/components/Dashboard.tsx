"use client";

import { useState, useEffect, FormEvent, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Calendar, CheckCircle, Loader2, Search, RefreshCw } from "lucide-react";
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
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { useMeeting } from "@/contexts/MeetingContext";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { getMeetingStats } from "@/actions/getMeetingStats";

interface DashboardProps {
  totalShareholders?: number;
  checkedInCount?: number;
  nextMeetingDate?: string;
  mailersStatus?: boolean;
}

const COLORS = ["#22c55e", "#ef4444"];
const DASHBOARD_RETURN_KEY = "dashboard_return_from_shareholder";

// Keep track of property counts
interface PropertyCounts {
  totalProperties: number;
  checkedInProperties: number;
}

const Dashboard: React.FC<DashboardProps> = ({
  totalShareholders,
  checkedInCount,
  nextMeetingDate = "2024-06-15",
  mailersStatus = false,
}) => {
  const { data: session } = useSession();
  const router = useRouter();
  const { meetings, selectedMeeting, refreshMeetings, isLoading: meetingsLoading, setSelectedMeeting } = useMeeting();

  // Initial loading state
  const [initialLoading, setInitialLoading] = useState(true);

  // UI states
  const [barcodeInput, setBarcodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Mailer states
  const [isGeneratingMailers, setIsGeneratingMailers] = useState(false);
  const [mailerProgress, setMailerProgress] = useState(0);
  const [mailerStep, setMailerStep] = useState("");
  const [showMailerDialog, setShowMailerDialog] = useState(false);

  // Attendance data state based on properties
  const [propertyStats, setPropertyStats] = useState<PropertyCounts>({
    totalProperties: Number(totalShareholders) || 1, // Initially use the props
    checkedInProperties: Number(checkedInCount) || 0,
  });

  // Window size for responsive chart
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  });

  // Fetch property stats only when explicitly called
  const fetchPropertyStats = useCallback(async () => {
    if (attendanceLoading) return; // Prevent multiple simultaneous fetches
    
    setAttendanceLoading(true);
    
    try {
      const stats = await getMeetingStats();
      
      setPropertyStats({
        totalProperties: Number(stats.totalShareholders) || Number(totalShareholders) || 0,
        checkedInProperties: Number(stats.checkedInCount) || Number(checkedInCount) || 0,
      });
    } catch (error) {
      // Error handled silently
    } finally {
      setAttendanceLoading(false);
      setInitialLoading(false); // Initial loading complete
    }
  }, [attendanceLoading, totalShareholders, checkedInCount]);

  // Manual refresh only - no automatic refresh
  const refreshDashboard = useCallback(async () => {
    // Prevent multiple simultaneous refreshes
    if (attendanceLoading) {
      return;
    }
    
    // Declare interval variable outside try-catch block
    let loadingInterval: NodeJS.Timeout | undefined;
    
    try {
      setAttendanceLoading(true);
      setLoadingProgress(0);
      
      // Set up a smooth loading animation like the PDF mailer
      let animationProgress = 0;
      loadingInterval = setInterval(() => {
        // Smooth progress animation
        if (animationProgress < 25) {
          animationProgress += 0.5;
        } else if (animationProgress < 60) {
          animationProgress += 0.4;
        } else if (animationProgress < 85) {
          animationProgress += 0.3;
        } else if (animationProgress < 95) {
          animationProgress += 0.1;
        }
        
        // Cap at 95% until we're actually done
        if (animationProgress > 95) {
          animationProgress = 95;
        }
        
        // Update loading progress
        setLoadingProgress(animationProgress);
      }, 100);
      
      // Refresh meetings first - with force flag to ensure refresh
      await refreshMeetings(true);
      // Then get property stats
      await fetchPropertyStats();
      
      // Clear loading interval and set to 100%
      if (loadingInterval) clearInterval(loadingInterval);
      setLoadingProgress(100);
      
      // Short delay before hiding loading indicator
      setTimeout(() => {
        setAttendanceLoading(false);
      }, 500);
    } catch (error) {
      // Error handled silently
      if (loadingInterval) clearInterval(loadingInterval);
      setLoadingProgress(0);
      setAttendanceLoading(false);
    } finally {
      setInitialLoading(false);
    }
  }, [refreshMeetings, fetchPropertyStats, attendanceLoading]);

  // Effect to ensure that the meeting is always selected when meetings are available
  useEffect(() => {
    if (meetings?.length > 0 && !selectedMeeting) {
      // If we have meetings but no meeting is selected, select the first one
      if (setSelectedMeeting) {
        setSelectedMeeting(meetings[0]);
      }
    }
  }, [meetings, selectedMeeting, setSelectedMeeting]);

  // No automatic data loading - only manual refresh
  useEffect(() => {
    // One-time setup to check if returning from shareholder
    const checkForReturnFlag = () => {
      const returnFromShareholder = localStorage.getItem(DASHBOARD_RETURN_KEY);
      if (returnFromShareholder) {
        localStorage.removeItem(DASHBOARD_RETURN_KEY);
      }
    };
    
    checkForReturnFlag();
    setInitialLoading(false); // Mark initial loading as complete without fetching
  }, []);

  // Handle window resize for responsive chart
  useEffect(() => {
    const handleResize = () => setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight
    });
    
    window.addEventListener("resize", handleResize);
    handleResize(); // Call once initially to set correct size
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Improve the chart sizing and responsiveness for different screen sizes
  const getPieChartDimensions = useCallback(() => {
    const width = windowSize.width;
    
    if (width >= 1280) { // xl screens
      return { 
        innerRadius: 80, 
        outerRadius: 130,
        height: 300
      };
    } else if (width >= 1024) { // lg screens
      return { 
        innerRadius: 70, 
        outerRadius: 115,
        height: 280
      };
    } else if (width >= 768) { // md screens
      return { 
        innerRadius: 60, 
        outerRadius: 100,
        height: 260
      };
    } else if (width >= 640) { // sm screens
      return { 
        innerRadius: 50, 
        outerRadius: 85,
        height: 240
      };
    } else { // xs screens
      return { 
        innerRadius: 40, 
        outerRadius: 70,
        height: 220
      };
    }
  }, [windowSize.width]);

  const { innerRadius, outerRadius, height } = getPieChartDimensions();
  
  // Calculate property attendance stats
  const checkedInPercentage = propertyStats.totalProperties > 0 
    ? (propertyStats.checkedInProperties > 0 
        ? Math.max(1, Math.round((propertyStats.checkedInProperties / propertyStats.totalProperties) * 100))
        : 0)
    : 0;
    
  // Calculate remaining properties - ensure this decrements properly
  const notCheckedInProperties = Math.max(0, propertyStats.totalProperties - propertyStats.checkedInProperties);
  const notCheckedInPercentage = propertyStats.totalProperties > 0
    ? (notCheckedInProperties > 0
        ? Math.min(99, Math.round((notCheckedInProperties / propertyStats.totalProperties) * 100))
        : 0)
    : 0;
  
  // Ensure percentages add up to 100%
  const adjustedCheckedInPercentage = checkedInPercentage;
  const adjustedNotCheckedInPercentage = checkedInPercentage > 0 ? 100 - checkedInPercentage : 100;
  
  const pieData = [
    { name: "Checked In", value: propertyStats.checkedInProperties, percentage: adjustedCheckedInPercentage },
    { name: "Remaining", value: notCheckedInProperties, percentage: adjustedNotCheckedInPercentage },
  ];

  // Format date helper functions
  const daysUntilMeeting = () => {
    const dateStr = selectedMeeting ? selectedMeeting.date : nextMeetingDate;
    const meetingDate = new Date(dateStr);
    if (isNaN(meetingDate.getTime())) return "N/A";
    const diffDays = Math.ceil((meetingDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return isNaN(diffDays) ? "N/A" : diffDays.toString();
  };

  const formatDate = (dateStr: string) => {
    const dateToFormat = selectedMeeting && !dateStr ? selectedMeeting.date : dateStr;
    const date = new Date(dateToFormat);
    return isNaN(date.getTime())
      ? "Not set"
      : new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }).format(date);
  };

  // Handle barcode submission
  const handleBarcodeSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!barcodeInput) return;
    setLoading(true);
    setError("");

    try {
    
      
      const response = await fetch("/api/checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache"
        },
        body: JSON.stringify({
          shareholderId: barcodeInput,
          meetingId: selectedMeeting?.id,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || "Check-in failed.");
        return;
      }

      // Set the flag for when we return to this page
      localStorage.setItem(DASHBOARD_RETURN_KEY, "true");
      
      toast({
        title: "Success",
        description: "Property checked in successfully",
      });
      
      router.push(`/shareholders/${barcodeInput}`);
      setBarcodeInput("");
    } catch (err) {
      setError("An error occurred during check-in.");
      toast({
        title: "Error",
        description: "Failed to check in property",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle print mailers functionality
  const handlePrintMailers = async () => {
    const currentMeeting = selectedMeeting || (meetings && meetings.length > 0 ? meetings[0] : null);
    if (!currentMeeting) {
      toast({
        title: "Error",
        description: "No meetings available. Please upload meeting data first.",
        variant: "destructive",
      });
      return;
    }
    
    // Declare interval variable outside try-catch block
    let progressInterval: NodeJS.Timeout | undefined;
    
    try {
      setIsGeneratingMailers(true);
      setShowMailerDialog(true);
      setMailerProgress(0);
      setMailerStep("Preparing data...");

      // Set up a continuous progress animation
      let animationProgress = 0;
      progressInterval = setInterval(() => {
        // Increment the progress smoothly but slow down as we get closer to key milestones
        if (animationProgress < 25) {
          animationProgress += 0.5;
        } else if (animationProgress < 60) {
          animationProgress += 0.4;
        } else if (animationProgress < 85) {
          animationProgress += 0.3;
        } else if (animationProgress < 95) {
          animationProgress += 0.1;
        }
        
        // Cap at 95% until we're actually done
        if (animationProgress > 95) {
          animationProgress = 95;
        }
        
        setMailerProgress(animationProgress);
      }, 100);

      // Start actual API call
      setMailerStep("Generating PDFs...");
      const payload = JSON.stringify({ meetingId: currentMeeting.id });
      
      const response = await fetch("/api/print-mailers", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/pdf",
          "Cache-Control": "no-cache"
        },
        body: payload,
      });
      
      if (!response.ok) throw new Error("Failed to generate mailers");

      setMailerStep("Processing files...");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      setMailerStep("Preparing download...");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentMeeting.year}-invitations.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Clear the interval and set to 100% when complete
      clearInterval(progressInterval);
      setMailerProgress(100);
      setMailerStep("Download complete!");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate mailers",
        variant: "destructive",
      });
      // Reset progress and clean up interval
      clearInterval(progressInterval);
      setMailerProgress(0);
      setIsGeneratingMailers(false);
    }
  };

  const handleMailerComplete = () => {
    setIsGeneratingMailers(false);
    setShowMailerDialog(false);
    setMailerProgress(0);
    setMailerStep("");
  };

  // Ensure that we have initial property stats with context values - but only fetch once
  useEffect(() => {
    // Only fetch if not already loading and we don't have meaningful data yet
    if (!initialLoading && !attendanceLoading && propertyStats.totalProperties <= 1 && meetings?.length > 0) {
      fetchPropertyStats();
    }
  }, [initialLoading, attendanceLoading, propertyStats.totalProperties, fetchPropertyStats, meetings?.length]);

  // Show loading screen until initial data is loaded
  if (initialLoading) {
    return <LoadingScreen message="Loading..." />;
  }

  if (!meetings || meetings.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Card className="max-w-md w-full text-center bg-white p-8 rounded-xl shadow-md">
          <Calendar className="h-16 w-16 text-blue-500 mx-auto mb-4 opacity-70" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No Meetings Found</h2>
          <p className="text-gray-600 mb-6">
            Please upload meeting data in the Admin page to get started.
          </p>
          <Button onClick={() => router.push("/admin")} className="w-full">
            Go to Admin
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="max-w-7xl mx-auto bg-white px-4 sm:px-6 lg:px-8 py-6 space-y-6 mb-8 shadow-md rounded-lg">
        <div className="flex justify-between items-center border-b pb-4">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          {(attendanceLoading || meetingsLoading) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Refreshing...</span>
            </div>
          )}
        </div>
        
        {/* Main content - grid layout that adapts to screen sizes */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-6">
          {/* Property Check-In Card - wider on large screens */}
          <Card className="transition-shadow hover:shadow-md xl:col-span-6">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 pb-3">
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-blue-600" />
                Quick Property Check-In
              </CardTitle>
              <CardDescription>Scan barcode or enter ID manually</CardDescription>
            </CardHeader>
            <CardContent className="pt-5 flex items-center justify-center min-h-[220px]">
              <form onSubmit={handleBarcodeSubmit} className="flex flex-col items-center space-y-6 w-full max-w-md mx-auto">
                <div className="relative w-full">
                  <Input
                    type="text"
                    placeholder="Enter ID or scan barcode"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="w-full pl-10 text-center h-12 text-lg"
                    autoFocus
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                </div>
                <Button type="submit" className="w-full h-12" disabled={loading || isGeneratingMailers || !barcodeInput}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Checking In...
                    </>
                  ) : (
                    "Check In Property"
                  )}
                </Button>
                {error && <p className="mt-2 text-center text-sm text-red-700">{error}</p>}
              </form>
            </CardContent>
            <CardFooter className="bg-gray-50 px-4 py-3 text-center">
              <p className="text-xs text-gray-500">
                You will be redirected to the shareholder's details page after check-in.
              </p>
            </CardFooter>
          </Card>
          
          {/* Attendance Stats Card */}
          <Card className="transition-shadow hover:shadow-md xl:col-span-6">
            <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 pb-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="bg-green-100 p-2 rounded-full">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle>Property Attendance</CardTitle>
                    <CardDescription>Current check-in status</CardDescription>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={refreshDashboard}
                  disabled={attendanceLoading}
                  className="h-9 w-9 rounded-full"
                  title="Refresh data"
                >
                  <RefreshCw className={`h-4 w-4 ${attendanceLoading ? 'animate-spin text-blue-500' : 'text-gray-500'}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 py-5">
              {attendanceLoading ? (
                <div className="h-48 md:h-64 lg:h-72 flex items-center justify-center">
                  <div className="text-center space-y-4 w-64">
                    <Loader2 className="h-10 w-10 animate-spin text-green-500 mx-auto" />
                    <Progress value={loadingProgress} className="w-full h-2" />
                    <p className="text-sm text-gray-500">
                      {loadingProgress >= 95 ? "Finalizing..." : "Updating attendance data..."}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ height: `${height}px` }} className="flex flex-col items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={innerRadius}
                          outerRadius={outerRadius}
                          paddingAngle={4}
                          dataKey="value"
                          stroke="#fff"
                          strokeWidth={2}
                          animationBegin={0}
                          animationDuration={1200}
                          animationEasing="ease-out"
                          label={({ name, cx, cy, midAngle, innerRadius, outerRadius, index }) => {
                            // Use the pre-calculated percentages
                            const pct = pieData[index].percentage;
                            return windowSize.width >= 768 ? `${name}: ${pct}%` : '';
                          }}
                          labelLine={windowSize.width >= 768 ? { stroke: "#9ca3af", strokeWidth: 0.5 } : false}
                        >
                          {pieData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={COLORS[index]} 
                              style={{ 
                                filter: "drop-shadow(0px 3px 5px rgba(0,0,0,0.15))"
                              }} 
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any, name: any, entry: any) => {
                            const index = name === "Checked In" ? 0 : 1;
                            return [`${value} properties (${pieData[index].percentage}%)`, name];
                          }}
                          contentStyle={{ 
                            fontSize: "13px", 
                            padding: "10px 14px", 
                            borderRadius: "8px", 
                            border: "none",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                            backgroundColor: "rgba(255,255,255,0.97)"
                          }}
                          itemStyle={{ padding: "4px 0" }}
                        />
                        {windowSize.width < 768 && (
                          <Legend 
                            iconSize={16} 
                            layout="vertical" 
                            verticalAlign="middle" 
                            align="right"
                            wrapperStyle={{ paddingTop: "10px" }}
                            formatter={(value, entry) => (
                              <span style={{ color: "#374151", fontSize: "13px", fontWeight: 500 }}>
                                {value}
                              </span>
                            )}
                          />
                        )}
                        {windowSize.width >= 768 && (
                          <text
                            x="50%"
                            y="50%"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            style={{ 
                              fontSize: windowSize.width >= 1024 ? "2.5rem" : "2rem", 
                              fontWeight: "bold", 
                              fill: checkedInPercentage > 0 ? "#10b981" : "#ef4444"
                            }}
                          >
                            {checkedInPercentage}%
                          </text>
                        )}
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-around mt-4 pt-3 border-t border-gray-100">
                    <div className="text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <p className="text-3xl font-bold text-green-600">{checkedInPercentage}%</p>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">Checked In</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-medium">
                        {propertyStats.checkedInProperties} / {propertyStats.totalProperties}
                      </p>
                      <p className="text-xs text-gray-600">Properties</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          
          {/* Meeting Countdown - full width on small screens, smaller on large screens */}
          <Card className="transition-shadow hover:shadow-md xl:col-span-6">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-amber-100 pb-3">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-600" />
                Next Meeting
              </CardTitle>
              <CardDescription>Meeting countdown</CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row items-center justify-around gap-4">
                <div className="text-center bg-amber-50 px-6 py-4 rounded-lg">
                  <p className="text-4xl font-bold text-amber-600">{daysUntilMeeting()}</p>
                  <p className="text-sm text-amber-700 mt-1">Days Remaining</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">Meeting Date</p>
                  <p className="text-base text-gray-600">{formatDate(nextMeetingDate)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Mailer Card - full width on small screens, smaller on large screens */}
          <Card className="transition-shadow hover:shadow-md xl:col-span-6">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100 pb-3">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-600" />
                Meeting Notifications
              </CardTitle>
              <CardDescription>Generate invitation mailers</CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <div className="flex flex-col items-center gap-4">
                <p className="text-sm text-gray-600 text-center">
                  Generate personalized invitations with unique check-in codes for all shareholders.
                </p>
                <Button 
                  onClick={handlePrintMailers} 
                  className="w-full max-w-md bg-purple-600 hover:bg-purple-700" 
                  disabled={isGeneratingMailers}
                >
                  {isGeneratingMailers ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Mailers...
                    </>
                  ) : (
                    "Generate Invitations"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Mailer Progress Dialog */}
      <Dialog open={showMailerDialog} onOpenChange={(open) => !open && handleMailerComplete()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mailerProgress === 100 ? "Generation Complete" : "Generating Invitations..."}
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <Progress value={mailerProgress} className="w-full h-2" />
            <p className="text-center text-sm text-muted-foreground">
              {mailerProgress === 100
                ? "Invitations have been generated and downloaded!"
                : (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {mailerStep}
                  </span>
                )}
            </p>
          </div>
          {mailerProgress === 100 && (
            <DialogFooter>
              <Button onClick={handleMailerComplete}>OK</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
