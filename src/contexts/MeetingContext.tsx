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
  refreshMeetings: (force?: boolean) => Promise<void>;
  setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>;
  isLoading: boolean;
}

const MeetingContext = createContext<MeetingContextType | undefined>(undefined);

// Cache timeout in milliseconds (5 minutes)
const CACHE_TIMEOUT = 5 * 60 * 1000;

export function MeetingProvider({ children }: { children: React.ReactNode }) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Reference to track if data has been initially loaded
  const initialLoadDoneRef = useRef<boolean>(false);
  // Track the last time data was fetched
  const lastFetchTimeRef = useRef<number>(0);
  // Track if we're currently fetching data
  const isFetchingRef = useRef<boolean>(false);

  const refreshMeetings = async (force = false) => {
    // Skip if we're already fetching data
    if (isFetchingRef.current) {
      console.log("MeetingContext: Already fetching, skipping redundant request");
      return;
    }
    
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    
    // Skip fetching if we already have data, not forced, and fetched recently
    if (meetings.length > 0 && 
        initialLoadDoneRef.current && 
        !force && 
        timeSinceLastFetch < CACHE_TIMEOUT) {
      console.log(`MeetingContext: Using cached data (${Math.round(timeSinceLastFetch/1000)}s old)`);
      return;
    }
    
    try {
      console.log("MeetingContext: Fetching fresh meeting data");
      isFetchingRef.current = true;
      setIsLoading(true);
      
      const data = await getMeetings();
      setMeetings(data);
      initialLoadDoneRef.current = true;
      lastFetchTimeRef.current = Date.now();
      
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
      isFetchingRef.current = false;
    }
  };

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
