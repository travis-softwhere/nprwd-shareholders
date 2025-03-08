// app/meeting/[id]/page.tsx
"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useMeeting } from "@/contexts/MeetingContext"; // adjust path if needed
import { PrintMailersButton } from "@/components/PrintMailersButton";

export default function MeetingPage() {
  const params = useParams();
  const { id } = params as { id: string };
  const { meetings, selectedMeeting, setSelectedMeeting } = useMeeting();

  // Log meeting data from context
  console.log("MeetingPage: meetings from context:", meetings);
  console.log("MeetingPage: URL id:", id);

  useEffect(() => {
    if (meetings.length > 0 && !selectedMeeting) {
      const meeting = meetings.find((m) => m.id === id);
      console.log("MeetingPage: Found meeting:", meeting);
      if (meeting) {
        setSelectedMeeting(meeting);
      }
    }
  }, [meetings, selectedMeeting, id, setSelectedMeeting]);

  if (!selectedMeeting) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg text-gray-500">Loading...</p>
      </div>
    );
  }

  console.log("MeetingPage: Selected meeting:", selectedMeeting);

  return (
    <div className="container mx-auto p-6">
      <h1>Meeting on {selectedMeeting.date}</h1>
      <p>Total Shareholders: {selectedMeeting.totalShareholders}</p>
      <PrintMailersButton 
        meetingId={selectedMeeting.id} 
        onComplete={() => {}} 
        disabled={false}
      />
    </div>
  );
}
