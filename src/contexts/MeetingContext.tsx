"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { getMeetings } from "@/actions/getMeetings";
import type { Meeting } from "@/types/meeting";

// Re-export the Meeting type so it can be imported from this module
export type { Meeting };

export interface MeetingContextType {
  meetings: Meeting[];
  selectedMeeting: Meeting | null;
  setSelectedMeeting: (meeting: Meeting | null) => void;
  refreshMeetings: (force?: boolean) => Promise<Meeting[] | undefined>;
  setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>;
  isLoading: boolean;
}

const MeetingContext = createContext<MeetingContextType | undefined>(undefined);

// Cache timeout in milliseconds (5 minutes)
const CACHE_TIMEOUT = 5 * 60 * 1000;

export function MeetingProvider({ children }: { children: ReactNode }) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start with loading state
  const lastRefreshTimeRef = useRef<number>(0);
  const initialLoadDoneRef = useRef<boolean>(false);

  // Function to refresh meetings data
  const refreshMeetings = async (force = false) => {
    // Skip if already loaded and not forcing refresh
    const now = Date.now();
    if (!force && now - lastRefreshTimeRef.current < 10000) {
      console.log("Skipping refresh - recently refreshed");
      return meetings;
    }

    console.log("MeetingContext: Refreshing meetings data...");
    setIsLoading(true);
    
    try {
      const data = await getMeetings();
      setMeetings(data);
      lastRefreshTimeRef.current = now;
      
      // If we have meetings but no meeting selected, select the first one
      if (data.length > 0 && !selectedMeeting) {
        console.log("MeetingContext: Auto-selecting first meeting");
        setSelectedMeeting(data[0]);
      }
      
      return data;
    } catch (error) {
      console.error("Failed to refresh meetings:", error);
      return undefined;
    } finally {
      setIsLoading(false);
    }
  };

  // Load meetings data on initial mount - ONLY ONCE
  useEffect(() => {
    if (!initialLoadDoneRef.current) {
      console.log("MeetingContext: Initial data loading");
      initialLoadDoneRef.current = true; // Set flag immediately to prevent double loading
      refreshMeetings(true).then(() => {
        console.log("MeetingContext: Initial load complete");
      });
    }
  }, []); // No dependencies to ensure it only runs once on mount

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
