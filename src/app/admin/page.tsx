"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Upload, Check, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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

export default function AdminPage() {
  const { data: session } = useSession();

  // Destructure the properties provided by the MeetingContext.
  const { selectedMeeting, setSelectedMeeting, meetings, setMeetings } = useMeeting();

  // Local state
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [isPrinting, setIsPrinting] = useState(false);

  // Refs to track ongoing upload
  const abortControllerRef = useRef<AbortController | null>(null);
  const uploadInProgressRef = useRef<boolean>(false);

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
      const allMeetings = await getMeetings();
      setMeetings(allMeetings);
    } catch (error) {
      console.error("Error fetching meetings:", error);
    }
  }, [setMeetings]);

  useEffect(() => {
    refreshMeetings();
  }, [refreshMeetings]);

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
        console.log("Upload already in progress");
        return;
      }

      setIsUploading(true);
      setUploadProgress(0);
      setUploadError(null);
      setCurrentStep("Preparing file for upload...");
      uploadInProgressRef.current = true;

      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Upload failed");
        }

        setCurrentStep("Upload completed successfully!");
        setUploadProgress(100);
        await refreshMeetings();

        // Reset state after a delay
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
          setCurrentStep("");
        }, 2000);
      } catch (error) {
        console.error("Upload failed:", error);
        setUploadError(error instanceof Error ? error.message : String(error));
        setCurrentStep("Upload failed");
      } finally {
        uploadInProgressRef.current = false;
      }
    },
    [refreshMeetings]
  );

  // Handle meeting deletion
  const handleDelete = async (meetingId: string) => {
    try {
      const formData = new FormData();
      formData.append("id", meetingId);

      const result = await deleteMeeting(formData);
      if (result.success) {
        setSelectedMeetingId(null);
        setMeetings((prev: any[]) => prev.filter((m) => m.id !== meetingId));
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Failed to delete meeting:", error);
      alert(error instanceof Error ? error.message : "Failed to delete meeting");
    }
  };

  // Handle Print Mailers – only run if a meeting is selected.
  const handlePrintMailers = async () => {
    if (!selectedMeeting) {
      console.error("No meeting selected.");
      return;
    }
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
      a.download = "shareholder-mailers.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating mailers:", error);
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

  // Redirect if not admin
  if (session?.user?.isAdmin !== true) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg text-gray-500">
          You do not have permission to access this page.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          {/* Upload data for selected meeting */}
          {showUploadComponent && (
            <Card>
              <CardHeader>
                <CardTitle>Data Management</CardTitle>
                <CardDescription>
                  Upload shareholder data for the selected meeting
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-center w-full">
                    <label
                      htmlFor="file-upload"
                      className={cn(
                        "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg transition-colors",
                        selectedMeeting && !isUploading
                          ? "cursor-pointer border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400"
                          : "cursor-not-allowed border-gray-200 bg-gray-100"
                      )}
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload
                          className={cn(
                            "w-8 h-8 mb-2",
                            isUploading ? "text-gray-400" : "text-gray-500"
                          )}
                        />
                        <p className="mb-2 text-sm text-gray-500">
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
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Print Mailers Button */}
          {showMailersButton && (
            <PrintMailersButton
                meetingId={selectedMeeting.id}
                onComplete={refreshMeetings}
                disabled={!selectedMeeting}
        />
        )}


          {/* Show Data Changes after mailers generated */}
          {showDataChanges && <DataChanges meetingId={selectedMeeting.id} />}
        </div>

        {/* Right column: List of meetings */}
        <Card>
          <CardHeader>
            <CardTitle>Shareholder Meetings</CardTitle>
            <CardDescription>Select a meeting to manage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Create a new meeting */}
            <CreateMeetingForm
              onSuccess={(meeting) => {
                setMeetings((prev: any[]) => [...prev, meeting]);
              }}
            />

            {/* List existing meetings */}
            <div className="space-y-4">
              {meetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className={cn(
                    "flex w-full items-center justify-between p-4 rounded-lg border transition-colors",
                    selectedMeetingId === meeting.id ? "border-blue-500 bg-blue-50" : "hover:border-gray-300"
                  )}
                >
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() => {
                      if (!isUploading) {
                        setSelectedMeetingId(meeting.id);
                      }
                    }}
                  >
                    <div>
                      <h3 className="font-semibold">
                        {meeting.year} Annual Meeting
                      </h3>
                      <p className="text-sm text-gray-500">
                        {new Date(meeting.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          {meeting.checkedIn} / {meeting.totalShareholders} Checked In
                        </p>
                      </div>
                      {selectedMeetingId === meeting.id && (
                        <Check className="h-5 w-5 text-blue-500" />
                      )}
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
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
