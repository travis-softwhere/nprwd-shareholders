"use client";

import { createContext, useContext, useState, useEffect, useRef } from "react";
import { getMeetings } from "@/actions/getMeetings";
import type { Meeting } from "@/types/meeting";

// Re-export the Meeting type so it can be imported from this module
export type { Meeting };

export interface MeetingContextType {
  meetings: Meeting[];
  selectedMeeting: Meeting | null;
  setSelectedMeeting: (meeting: Meeting | null) => void;
  refreshMeetings: () => Promise<void>;
  setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>;
  isLoading: boolean;
}

const MeetingContext = createContext<MeetingContextType | undefined>(undefined);

export function MeetingProvider({ children }: { children: React.ReactNode }) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Reference to track if data has been initially loaded
  const initialLoadDoneRef = useRef<boolean>(false);

  const refreshMeetings = async () => {
    // Skip fetching if we already have data, unless explicitly forced by a UI action
    if (meetings.length > 0 && initialLoadDoneRef.current) {
      return;
    }
    
    try {
      console.log("MeetingContext: Fetching fresh meeting data");
      setIsLoading(true);
      const data = await getMeetings();
      setMeetings(data);
      initialLoadDoneRef.current = true;
      
      // Optionally, set the first meeting as selected if none is selected
      if (data.length > 0 && !selectedMeeting) {
        setSelectedMeeting(data[0]);
      }
    } catch (error) {
      // Silent error handling - context refreshes might be triggered by automatic processes
      // If a UI component needs to show an error, it should handle it itself
      console.error("Error fetching meetings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!initialLoadDoneRef.current) {
      refreshMeetings();
    }
  }, []);

  return (
    <MeetingContext.Provider
      value={{
        meetings,
        setMeetings,
        selectedMeeting,
        setSelectedMeeting,
        refreshMeetings,
        isLoading,
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
