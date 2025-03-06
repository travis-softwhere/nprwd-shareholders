"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useMeeting } from "@/contexts/MeetingContext";
import { PrintMailersButton } from "@/components/PrintMailersButton";

export default function MeetingPage() {
  const params = useParams();
  const { id } = params as { id: string };
  const { meetings, selectedMeeting, setSelectedMeeting } = useMeeting();

  useEffect(() => {
    if (meetings.length > 0 && !selectedMeeting) {
      // Find the meeting whose id matches the URL parameter
      const meeting = meetings.find((m) => m.id === id);
      if (meeting) {
        setSelectedMeeting(meeting);
      }
    }
  }, [meetings, selectedMeeting, id, setSelectedMeeting]);

  if (!selectedMeeting) {
    return <div>Loading meeting data...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <h1>Meeting on {selectedMeeting.date}</h1>
      <p>Total Shareholders: {selectedMeeting.totalShareholders}</p>
      {/* Pass the meeting id (from the Meeting object) to the PrintMailersButton */}
      <PrintMailersButton meetingId={selectedMeeting.id} />
    </div>
  );
}
