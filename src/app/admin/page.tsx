"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Upload, Check, Trash2, Settings, UserPlus, Calendar, ChevronRight, FileSpreadsheet, Download, RefreshCw } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMeeting } from "@/contexts/MeetingContext";
import { cn } from "@/lib/utils";
import { UploadProgress } from "@/components/UploadProgress";
import { PrintMailersButton } from "@/components/PrintMailersButton";
import { DataChanges } from "@/components/DataChanges";
import { getMeetings } from "@/actions/getMeetings";
import { deleteMeeting } from "@/actions/manageMeetings";
import { CreateMeetingForm } from "@/components/CreateMeetingForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSession } from "next-auth/react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import { EmployeeList } from "@/components/EmployeeList";
import { Loader2 } from "lucide-react";
import { LoadingScreen } from "@/components/ui/loading-screen";

export default function AdminPage() {
  const { data: session } = useSession();
  const { toast } = useToast();

  // Destructure the properties provided by the MeetingContext.
  const { selectedMeeting, setSelectedMeeting, meetings, setMeetings } = useMeeting();

  // Local state
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [isPrinting, setIsPrinting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [employeeRefreshTrigger, setEmployeeRefreshTrigger] = useState(0);

  // Refs to track ongoing upload
  const abortControllerRef = useRef<AbortController | null>(null);
  const uploadInProgressRef = useRef<boolean>(false);

  // Add Employee state
  const [newEmployee, setNewEmployee] = useState({
    fullName: "",
    email: "",
  });
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);

  // Cleanup function for uploads
  const cleanupUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    uploadInProgressRef.current = false;
    setIsUploading(false);
    setUploadProgress(0);
    setCurrentStep("");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupUpload();
    };
  }, [cleanupUpload]);

  // Fetch and refresh meetings
  const refreshMeetings = useCallback(async () => {
    try {
      setIsLoading(true);
      const allMeetings = await getMeetings();
      setMeetings(allMeetings);
    } catch (error) {
      console.error("Error fetching meetings:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch meetings"
      });
    } finally {
      setIsLoading(false);
    }
  }, [setMeetings, toast]);

  // Add back controlled one-time data loading
  useEffect(() => {
    // Use a local variable to prevent multiple fetches
    let isMounted = true;
    let hasLoaded = false;
    
    // Load data only once when component mounts
    const loadInitialData = async () => {
      if (!isMounted || hasLoaded || meetings.length > 0) return;
      
      console.log("Admin: Loading initial data (one-time only)");
      hasLoaded = true;
      await refreshMeetings();
    };
    
    loadInitialData();
    
    // Cleanup
    return () => {
      isMounted = false;
    };
  }, [refreshMeetings, meetings.length]);

  // Update selected meeting if selectedMeetingId changes
  useEffect(() => {
    if (selectedMeetingId) {
      const meeting = meetings.find((m) => m.id === selectedMeetingId);
      if (meeting) {
        setSelectedMeeting(meeting);
      }
    } else {
      setSelectedMeeting(null);
    }
  }, [selectedMeetingId, meetings, setSelectedMeeting]);

  // Handle CSV upload
  const handleUpload = useCallback(
    async (formData: FormData) => {
      if (uploadInProgressRef.current) {
        return;
      }

      // Declare interval variable outside try-catch block
      let progressInterval: NodeJS.Timeout | undefined;

      setIsUploading(true);
      setUploadProgress(0);
      setUploadError(null);
      setCurrentStep("Preparing file for upload...");
      uploadInProgressRef.current = true;

      try {
        // Set up a smooth loading animation
        let animationProgress = 0;
        progressInterval = setInterval(() => {
          // Smooth progress animation with varying speeds
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
          setUploadProgress(animationProgress);
        }, 100);

        // Update step
        setCurrentStep("Validating file contents...");

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        // Update progress message during different stages
        setCurrentStep("Processing data...");

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Upload failed");
        }

        // Show completion
        setCurrentStep("Finalizing...");
        
        // Clear animation interval and set to 100%
        if (progressInterval) clearInterval(progressInterval);
        setUploadProgress(100);
        
        await refreshMeetings();
      } catch (error) {
        // Clear the interval if there's an error
        if (progressInterval) clearInterval(progressInterval);
        setUploadError(error instanceof Error ? error.message : String(error));
        setCurrentStep("Upload failed");
      }
    },
    [refreshMeetings]
  );

  const handleUploadComplete = useCallback(() => {
    setIsUploading(false);
    setUploadProgress(0);
    setCurrentStep("");
    uploadInProgressRef.current = false;
  }, []);

  // Handle meeting deletion
  const handleDelete = async (meetingId: string) => {
    try {
      const formData = new FormData();
      formData.append("id", meetingId);

      const result = await deleteMeeting(formData);
      if (result.success) {
        setSelectedMeetingId(null);
        setMeetings((prev: any[]) => prev.filter((m) => m.id !== meetingId));
        
        toast({
          title: "Success",
          description: "Meeting deleted successfully"
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Failed to delete meeting:", error);
      
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete meeting"
      });
    }
  };

  // Handle Print Mailers – will try to use the latest meeting if no meeting is selected
  const handlePrintMailers = async () => {
    if (!selectedMeeting) {
      // Instead of showing an error, check if we have any available meetings
      if (meetings && meetings.length > 0) {
        // Use the most recent meeting by default
        const latestMeeting = meetings[meetings.length - 1];
        
        setIsPrinting(true);
        try {
          const payload = JSON.stringify({ meetingId: latestMeeting.id });
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
          if (!response.ok) throw new Error("Failed to generate mailers");

          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${latestMeeting.year}-invitations.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        } catch (error) {
          toast({
            variant: "destructive",
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to generate mailers"
          });
        } finally {
          setIsPrinting(false);
        }
        return;
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No meetings are available. Please upload meeting data first."
        });
        return;
      }
    }

    // Continue with selected meeting if available
    setIsPrinting(true);
    try {
      const payload = JSON.stringify({ meetingId: selectedMeeting.id });
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
      if (!response.ok) throw new Error("Failed to generate mailers");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedMeeting.year}-invitations.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Mailers generated successfully"
      });
    } catch (error) {
      console.error("Error generating mailers:", error);
      
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate mailers"
      });
    } finally {
      setIsPrinting(false);
    }
  };

  // Show/hide certain components based on meeting state
  const showUploadComponent =
    selectedMeeting &&
    !selectedMeeting.hasInitialData &&
    selectedMeeting.dataSource === "excel";

  const showMailersButton =
    selectedMeeting &&
    selectedMeeting.hasInitialData &&
    !selectedMeeting.mailersGenerated;

  const showDataChanges =
    selectedMeeting && selectedMeeting.mailersGenerated;

  // Handle employee creation
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingEmployee(true);

    try {
      const response = await fetch("/api/create-employee", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newEmployee),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create employee");
      }

      toast({
        title: "Success",
        description: "Employee created successfully"
      });

      // Reset form
      setNewEmployee({
        fullName: "",
        email: "",
      });
      
      // Trigger employee list refresh
      setEmployeeRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Error creating employee:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create employee"
      });
    } finally {
      setIsCreatingEmployee(false);
    }
  };

  // Redirect if not admin
  if (session?.user?.isAdmin !== true) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4 p-8 max-w-md bg-white rounded-xl shadow-md">
          <Settings className="h-16 w-16 text-gray-400 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-800">Access Denied</h2>
          <p className="text-gray-600">
            You don't have permission to access the admin dashboard.
          </p>
          <Button 
            onClick={() => window.location.href = "/"} 
            className="mt-4"
          >
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <LoadingScreen message="Loading admin dashboard..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 mb-20 md:mb-6">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-blue-500" />
          Admin Dashboard
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-auto flex items-center gap-1" 
            onClick={() => refreshMeetings()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Loading...' : 'Refresh'}
          </Button>
        </h1>
        <p className="text-gray-600">
          Manage employees, meetings, and system settings
        </p>
      </div>
      <Separator className="my-6" />
      
      {/* Employee Section */}
      <div className="space-y-6">
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
          <EmployeeList refreshTrigger={employeeRefreshTrigger} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        {/* Add Employee Card */}
        <Card className="overflow-hidden hover:shadow-md transition-all">
          <CardHeader className="bg-gradient-to-r from-green-50 to-white pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="h-5 w-5 text-green-600" />
              Add Employee
            </CardTitle>
            <CardDescription>Create a new employee account</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleCreateEmployee} className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    placeholder="Enter employee's full name"
                    value={newEmployee.fullName}
                    onChange={(e) => setNewEmployee(prev => ({ ...prev, fullName: e.target.value }))}
                    required
                    className="border-gray-300 focus:border-green-500 focus:ring-green-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter employee's email"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee(prev => ({ ...prev, email: e.target.value }))}
                    required
                    className="border-gray-300 focus:border-green-500 focus:ring-green-500"
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full bg-green-600 hover:bg-green-700 transition-colors" 
                disabled={isCreatingEmployee}
              >
                {isCreatingEmployee ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>Add Employee</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Shareholder Meetings Card */}
        <Card className="overflow-hidden hover:shadow-md transition-all">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-white pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-blue-600" />
              Shareholder Meetings
            </CardTitle>
            <CardDescription>Select or create a meeting to manage</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {/* Create a new meeting */}
            <CreateMeetingForm
              onSuccess={(meeting) => {
                setMeetings((prev: any[]) => [...prev, meeting]);
                toast({
                  title: "Success",
                  description: "Meeting created successfully"
                });
              }}
            />

            {/* List existing meetings */}
            <div className="space-y-3 mt-4">
              <h3 className="text-sm font-medium text-gray-700">Existing Meetings</h3>
              {meetings.length === 0 ? (
                <div className="p-4 rounded-lg bg-gray-50 text-center text-gray-500 text-sm">
                  No meetings found. Create your first meeting above.
                </div>
              ) : (
                meetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className={cn(
                      "flex w-full items-center justify-between p-4 rounded-lg border transition-all",
                      selectedMeetingId === meeting.id 
                        ? "border-blue-500 bg-blue-50 shadow-sm" 
                        : "hover:border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    <button
                      type="button"
                      className="flex-1 text-left"
                      onClick={() => {
                        if (!isUploading) {
                          setSelectedMeetingId(selectedMeetingId === meeting.id ? null : meeting.id);
                        }
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {meeting.year} Annual Meeting
                          </h3>
                          <p className="text-sm text-gray-500">
                            {new Date(meeting.date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">{meeting.checkedIn}</span> / {meeting.totalShareholders} Checked In
                            </p>
                          </div>
                          {selectedMeetingId === meeting.id && (
                            <Check className="h-5 w-5 text-blue-500" />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Delete Meeting */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="ml-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this meeting? This action cannot be undone. All associated shareholder data will be permanently deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600"
                            onClick={() => handleDelete(meeting.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Management Cards - Only Show When Relevant */}
      {(showUploadComponent || showMailersButton || showDataChanges) && (
        <div className="mt-6 space-y-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-500" />
            Data Management
          </h2>
          <Separator />
          
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            {/* Upload Data Card */}
            {showUploadComponent && (
              <Card className="overflow-hidden hover:shadow-md transition-all">
                <CardHeader className="bg-gradient-to-r from-amber-50 to-white pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Upload className="h-5 w-5 text-amber-600" />
                    Upload Shareholder Data
                  </CardTitle>
                  <CardDescription>
                    Upload CSV file with shareholders for {selectedMeeting?.year} meeting
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-center w-full">
                      <label
                        htmlFor="file-upload"
                        className={cn(
                          "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg transition-colors",
                          selectedMeeting && !isUploading
                            ? "cursor-pointer border-amber-300 bg-amber-50 hover:bg-amber-100 hover:border-amber-400"
                            : "cursor-not-allowed border-gray-200 bg-gray-100"
                        )}
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload
                            className={cn(
                              "w-8 h-8 mb-2",
                              isUploading ? "text-gray-400" : "text-amber-500"
                            )}
                          />
                          <p className="mb-2 text-sm text-gray-700">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-gray-500">CSV file only</p>
                        </div>
                        <input
                          id="file-upload"
                          name="file"
                          type="file"
                          className="hidden"
                          accept=".csv"
                          disabled={!selectedMeeting || isUploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && selectedMeeting) {
                              const formData = new FormData();
                              formData.append("file", file);
                              formData.append("meetingId", selectedMeeting.id);
                              handleUpload(formData);
                            }
                          }}
                        />
                      </label>
                    </div>

                    <UploadProgress
                      isUploading={isUploading}
                      progress={uploadProgress}
                      currentStep={currentStep}
                      error={uploadError}
                      onComplete={handleUploadComplete}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Print Mailers Button */}
            {showMailersButton && (
              <Card className="overflow-hidden hover:shadow-md transition-all">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-white pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Download className="h-5 w-5 text-purple-600" />
                    Generate Invitations
                  </CardTitle>
                  <CardDescription>
                    Create PDF invitations for {selectedMeeting?.year} meeting
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Generate personalized meeting invitations with unique check-in codes for all shareholders.
                    </p>
                    <Button
                      onClick={handlePrintMailers}
                      className="w-full bg-purple-600 hover:bg-purple-700 transition-colors"
                      disabled={isPrinting || !selectedMeeting}
                    >
                      {isPrinting ? (
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
            )}

            {/* Show Data Changes after mailers generated */}
            {showDataChanges && (
              <Card className="overflow-hidden hover:shadow-md transition-all">
                <CardHeader className="bg-gradient-to-r from-green-50 to-white pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                    Data Changes
                  </CardTitle>
                  <CardDescription>
                    Track changes to shareholder data since mailers were generated
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <DataChanges meetingId={selectedMeeting.id} />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
      
      {/* Mobile spacing for bottom nav */}
      <div className="h-16 md:hidden"></div>
    </div>
  );
}
