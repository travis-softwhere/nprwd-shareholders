"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { getMeetings } from "@/actions/getMeetings";
import type { Meeting } from "@/types/meeting";

interface MeetingContextType {
  meetings: Meeting[];
  selectedMeeting: Meeting | null;
  setSelectedMeeting: (meeting: Meeting | null) => void;
  refreshMeetings: () => Promise<void>;
}

const MeetingContext = createContext<MeetingContextType | undefined>(undefined);

export function MeetingProvider({ children }: { children: React.ReactNode }) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  const refreshMeetings = async () => {
    try {
      const data = await getMeetings();
      setMeetings(data);
      // Optionally set the first meeting as selected
      if (data.length > 0 && !selectedMeeting) {
        setSelectedMeeting(data[0]);
      }
    } catch (error) {
      console.error("Error refreshing meetings:", error);
    }
  };

  useEffect(() => {
    refreshMeetings();
  }, []);

  return (
    <MeetingContext.Provider
      value={{
        meetings,
        selectedMeeting,
        setSelectedMeeting,
        refreshMeetings,
      }}
    >
      {children}
    </MeetingContext.Provider>
  );
}

export function useMeeting() {
  const context = useContext(MeetingContext);
  if (context === undefined) {
    throw new Error("useMeeting must be used within a MeetingProvider");
  }
  return context;
}
