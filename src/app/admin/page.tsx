"use client";

import { useState, useEffect, useCallback, useRef, useMemo, type ChangeEvent } from "react";
import { Upload, Check, Trash2, Settings, UserPlus, Calendar, ChevronRight, ChevronDown, FileSpreadsheet, Download, RefreshCw, Home, Search, Plus, ArrowRightLeft, Edit, X, FileText, ExternalLink, Pencil, Mail } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { useMeeting } from "@/contexts/MeetingContext";
import { cn } from "@/lib/utils";
import { UploadProgress } from "@/components/UploadProgress";
import { DataChanges } from "@/components/DataChanges";
import { getMeetings } from "@/actions/getMeetings";
import {
  clearStoredActiveMeetingId,
  setStoredActiveMeetingId,
} from "@/actions/activeMeetingSettings";
import type { Meeting } from "@/types/meeting";
import { deleteMeeting, markMeetingMailersGenerated } from "@/actions/manageMeetings";
import { CreateMeetingForm } from "@/components/CreateMeetingForm";
import { EditMeetingDialog } from "@/components/EditMeetingDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSession } from "next-auth/react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeList } from "@/components/EmployeeList";
import { Loader2 } from "lucide-react";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { formatMeetingLabel } from "@/lib/meetingDisplay";
import { getLatestMeeting } from "@/lib/meetingSelection";
import { displayShareholderId } from "@/lib/meetingScopedShareholderId";
import { Progress } from "@/components/ui/progress";
import { generateMeetingMailers } from "@/lib/generateMeetingMailersClient";
import type { MailerDiskPreflightResult } from "@/lib/mailerDiskSpacePreflight";
import { makeMeetingScopedShareholderId } from "@/lib/meetingScopedShareholderId";
import { downloadAllMeetingMailerPdfs } from "@/lib/meetingMailerBlobDownloads";
import { triggerBenefitUnitOwnerCsvTemplateDownload } from "@/lib/benefitUnitOwnerCsvTemplate";
import { validateBenefitUnitOwnerCsvFile } from "@/lib/benefitUnitOwnerCsvClientValidate";
import { CheckinStatusDashboard } from '@/components/CheckinStatusDashboard';
import ShareholdersList from "@/components/ShareholderList"
import jsPDF from 'jspdf';

// Define Property interface
interface Property {
  id: number;
  account: string;
  ownerName: string;
  ownerMailingAddress: string;
  ownerCityStateZip: string;
  customerName: string;
  customerMailingAddress: string;
  cityStateZip: string;
  serviceAddress: string;
  residentName?: string;
  residentMailingAddress?: string;
  residentCityStateZip?: string;
  checkedIn: boolean;
  shareholderId?: string;
}

interface ShareholderData {
  name: string;
  serviceAddress: string;
  ownerName: string;
  customerName: string;
  ownerMailingAddress: string;
  ownerCityStateZip: string;
  customerMailingAddress: string;
  cityStateZip: string;
  residentName: string;
  residentMailingAddress: string;
  residentCityStateZip: string;
}

/** GET /api/properties returns `{ properties: Property[] }`; older callers may expect a raw array. */
function propertiesFromApiPayload(data: unknown): Property[] {
  if (Array.isArray(data)) {
    return data as Property[];
  }
  if (
    data &&
    typeof data === "object" &&
    "properties" in data &&
    Array.isArray((data as { properties: unknown }).properties)
  ) {
    return (data as { properties: Property[] }).properties;
  }
  return [];
}

export default function AdminPage() {
  const { data: session } = useSession();
  const { toast } = useToast();

  // Destructure the properties provided by the MeetingContext.
  const {
    selectedMeeting,
    setSelectedMeeting,
    meetings,
    setMeetings,
    refreshMeetings: reloadMeetingsFromDb,
  } = useMeeting();

  // Local state
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [meetingToEdit, setMeetingToEdit] = useState<Meeting | null>(null);
  const [shareholdersShowAllMeetings, setShareholdersShowAllMeetings] = useState(false);
  const [shareholderAdminRefresh, setShareholderAdminRefresh] = useState(0);
  /** Set while `clear-for-meeting` is running (per meeting row). */
  const [wipingMeetingId, setWipingMeetingId] = useState<string | null>(null);
  const [wipeConfirmMeeting, setWipeConfirmMeeting] = useState<Meeting | null>(null);
  const [wipeConfirmOpen, setWipeConfirmOpen] = useState(false);
  const [wipePreviewCounts, setWipePreviewCounts] = useState<{
    shareholders: number;
    properties: number;
  } | null>(null);
  const [wipePreviewLoading, setWipePreviewLoading] = useState(false);
  const [wipePreviewError, setWipePreviewError] = useState<string | null>(null);
  const [uncheckMeetingDialog, setUncheckMeetingDialog] = useState<Meeting | null>(null);
  const [uncheckInProgress, setUncheckInProgress] = useState(false);
  const [deleteMeetingDialog, setDeleteMeetingDialog] = useState<Meeting | null>(null);
  const [exportingMeetingId, setExportingMeetingId] = useState<string | null>(null);
  const [exportingSignatureListMeetingId, setExportingSignatureListMeetingId] = useState<
    string | null
  >(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  /** CSV chosen and validated locally; user must click Save to POST `/api/upload`. */
  const [pendingCsvFile, setPendingCsvFile] = useState<File | null>(null);
  const [pendingCsvRowCount, setPendingCsvRowCount] = useState<number | null>(null);
  const [isValidatingCsv, setIsValidatingCsv] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [mailerDialogOpen, setMailerDialogOpen] = useState(false);
  /** Second step: confirm stopping PDF generation (progress dialog has no X / no backdrop dismiss). */
  const [mailerGenerationCancelConfirmOpen, setMailerGenerationCancelConfirmOpen] = useState(false);
  const [mailerGeneratingMeetingId, setMailerGeneratingMeetingId] = useState<string | null>(null);
  const [mailerProgress, setMailerProgress] = useState(0);
  const [mailerProgressIndeterminate, setMailerProgressIndeterminate] = useState(false);
  const [mailerStatus, setMailerStatus] = useState("");
  const [mailerBatchShareholderCount, setMailerBatchShareholderCount] = useState(0);
  const [isMailerLocalMode, setIsMailerLocalMode] = useState(false);
  const [downloadingSavedMailersMeetingId, setDownloadingSavedMailersMeetingId] = useState<string | null>(null);
  /** Prevents double-launch; menu item is not disabled during download to avoid “stuck” pointer-events. */
  const mailerDownloadInFlightRef = useRef(false);
  /** Abort mailer PDF generation when the progress dialog is closed (X or dismiss). */
  const mailerAbortControllerRef = useRef<AbortController | null>(null);
  const [mailerDiskCheckLoadingId, setMailerDiskCheckLoadingId] = useState<string | null>(null);
  const [mailerDiskPreflightOpen, setMailerDiskPreflightOpen] = useState(false);
  const [mailerDiskPreflightPayload, setMailerDiskPreflightPayload] = useState<{
    meeting: Meeting;
    data: MailerDiskPreflightResult;
  } | null>(null);
  /** Dev-only: opens when Actions → Generate invitation PDFs + optional test mailer */
  const [mailerInviteSetupOpen, setMailerInviteSetupOpen] = useState(false);
  const [mailerInviteSetupMeeting, setMailerInviteSetupMeeting] = useState<Meeting | null>(null);
  const [testMailerDownloading, setTestMailerDownloading] = useState(false);
  /** When set, CSV import modal targets this meeting (Meetings tab). */
  const [csvImportMeeting, setCsvImportMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [employeeRefreshTrigger, setEmployeeRefreshTrigger] = useState(0);
  const [newShareholderIds, setNewShareholderIds] = useState<Set<string>>(new Set());

  // Property Management states
  const [searchQuery, setSearchQuery] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showCreatePropertyDialog, setShowCreatePropertyDialog] = useState(false);
  const [showOwnerSelectionDialog, setShowOwnerSelectionDialog] = useState(false);
  const [propertyOwnerType, setPropertyOwnerType] = useState<"new" | "existing">("new");
  const [newPropertyData, setNewPropertyData] = useState({
    serviceAddress: "",
    ownerName: "",
    ownerMailingAddress: "",
    ownerCityStateZip: "",
    account: "",
    shareholderId: "",
    cityStateZip: "",
  });
  const [acquisitionType, setAcquisitionType] = useState<"new" | "existing">("new");
  const [newShareholderData, setNewShareholderData] = useState<ShareholderData>({
    name: "",
    serviceAddress: "",
    ownerName: "",
    customerName: "",
    ownerMailingAddress: "",
    ownerCityStateZip: "",
    customerMailingAddress: "",
    cityStateZip: "",
    residentName: "",
    residentMailingAddress: "",
    residentCityStateZip: "",
  });
  const [selectedExistingProperty, setSelectedExistingProperty] = useState<Property | null>(null);
  const [existingPropertySearchQuery, setExistingPropertySearchQuery] = useState("");
  const [transferType, setTransferType] = useState<"new" | "existing">("new");
  const [transferData, setTransferData] = useState({
    shareholderName: "",
    email: "",
    phone: ""
  });
  const [selectedExistingShareholder, setSelectedExistingShareholder] = useState<any>(null);
  const [shareholderSearchQuery, setShareholderSearchQuery] = useState("");
  const [shareholders, setShareholders] = useState<any[]>([]);
  
  // Add state for name copying
  const [useShareholderForOwner, setUseShareholderForOwner] = useState(false)
  const [useShareholderForCustomer, setUseShareholderForCustomer] = useState(false)
  const [useShareholderForResident, setUseShareholderForResident] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  /** Same id the rest of the app uses for “active meeting” (Meetings tab + context). */
  const systemSelectedMeetingId = useMemo(
    () => String(selectedMeetingId ?? selectedMeeting?.id ?? ""),
    [selectedMeetingId, selectedMeeting?.id],
  );

  /** Always scope properties API to the meeting chosen on the Meetings tab (not only context). */
  const meetingScopeQuery = systemSelectedMeetingId
    ? `&meetingId=${encodeURIComponent(systemSelectedMeetingId)}`
    : "";

  const meetingForPropertyScope = useMemo(
    () => meetings.find((m) => String(m.id) === String(systemSelectedMeetingId)) ?? null,
    [meetings, systemSelectedMeetingId],
  );

  useEffect(() => {
    setIsMailerLocalMode(process.env.NODE_ENV === "development");
  }, []);

  const isDevEnvironment = process.env.NODE_ENV === "development";

  // Reset to page 1 when search or scoped meeting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, systemSelectedMeetingId]);

  // Add refreshProperties function to reuse in multiple places
  const refreshProperties = async () => {
    try {
      // Clear the search query to ensure all properties are shown after refresh
      setSearchQuery("");
      
      // Fetch the latest properties
      const propertiesResponse = await fetch(`/api/properties?limit=5000${meetingScopeQuery}`);
      if (propertiesResponse.ok) {
        const responseText = await propertiesResponse.text();
        if (responseText) {
          const propertiesData = propertiesFromApiPayload(JSON.parse(responseText));
          setProperties(propertiesData);

          // Directly update filteredProperties as well to ensure
          // immediate display of new properties (since search is empty)
          setFilteredProperties(propertiesData);
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh properties",
        variant: "destructive",
      });
    }
  };
  
  // Fetch properties for the meeting selected on the Meetings tab (systemSelectedMeetingId)
  useEffect(() => {
    if (!systemSelectedMeetingId) {
      setProperties([]);
      setFilteredProperties([]);
      return;
    }
    const fetchProperties = async () => {
      try {
        setIsLoading(true);
        const q = `&meetingId=${encodeURIComponent(systemSelectedMeetingId)}`;
        const response = await fetch(`/api/properties?limit=5000${q}`);
        if (!response.ok) throw new Error("Failed to fetch properties");
        const data = propertiesFromApiPayload(await response.json());
        setProperties(data);
        setFilteredProperties(data);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load properties",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchProperties();
  }, [toast, systemSelectedMeetingId]);

  // Filter properties based on search
  useEffect(() => {
    if (!properties.length) {
      setFilteredProperties([]);
      return;
    }
    if (!searchQuery) {
      setFilteredProperties(properties);
    } else {
      const filtered = properties.filter(property => {
        const query = searchQuery.toLowerCase();
        return (
          property.account?.toLowerCase().includes(query) ||
          property.ownerName?.toLowerCase().includes(query) ||
          property.customerName?.toLowerCase().includes(query) ||
          property.serviceAddress?.toLowerCase().includes(query)
        );
      });
      setFilteredProperties(filtered);
    }
  }, [properties, searchQuery]);

  // Pagination logic
  const totalPages = Math.ceil(filteredProperties.length / itemsPerPage);
  const paginatedProperties = filteredProperties.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Fetch shareholders for the selected meeting (aligned with Meetings tab)
  useEffect(() => {
    if (!systemSelectedMeetingId) {
      setShareholders([]);
      return;
    }
    const fetchShareholders = async () => {
      try {
        const response = await fetch(
          `/api/shareholders?meetingId=${encodeURIComponent(systemSelectedMeetingId)}`
        );
        if (!response.ok) throw new Error("Failed to fetch shareholders");
        const data = await response.json();
        setShareholders(data.shareholders || []);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load shareholders",
          variant: "destructive",
        });
      }
    };

    fetchShareholders();
  }, [toast, systemSelectedMeetingId]);

  // Refs to track ongoing upload and initialization
  const abortControllerRef = useRef<AbortController | null>(null);
  const uploadInProgressRef = useRef<boolean>(false);
  const initialLoadCompleteRef = useRef<boolean>(false);
  const csvInputMeetingModalRef = useRef<HTMLInputElement>(null);

  // Add Employee state
  const [newEmployee, setNewEmployee] = useState({
    fullName: "",
    email: "",
  });
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);
  const [showAddEmployeeForm, setShowAddEmployeeForm] = useState(false);

  // Add state for address copying
  const [useServiceForCustomer, setUseServiceForCustomer] = useState(false)
  const [useServiceForOwner, setUseServiceForOwner] = useState(false)
  const [useServiceForResident, setUseServiceForResident] = useState(false)

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

  /** Refresh meetings list and re-apply active meeting from DB (`app_settings`). */
  const refreshMeetings = useCallback(async (): Promise<Meeting[] | undefined> => {
    try {
      setIsLoading(true);
      const data = await reloadMeetingsFromDb(true);
      return data;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch meetings",
      });
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, [reloadMeetingsFromDb, toast]);

  // Add back controlled one-time data loading
  useEffect(() => {
    // Only load data on mount if we haven't already
    if (!initialLoadCompleteRef.current && meetings.length === 0) {
      // Don't use full page loading state, let components show their own loading indicators
    const loadInitialData = async () => {
        try {
          const allMeetings = await getMeetings();
          setMeetings(allMeetings);
          
          // Mark initial load as complete so we don't fetch again
          initialLoadCompleteRef.current = true;
        } catch (error) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to load dashboard data"
          });
        } finally {
          setInitialLoading(false);
        }
    };
    
    loadInitialData();
    }
  }, [meetings.length, toast, setMeetings]);

  /**
   * Admin row highlight follows MeetingContext — context loads `selectedMeeting` from `app_settings` on refresh.
   * Do not push local state into context here (that previously overwrote the saved meeting with “first in list”).
   */
  useEffect(() => {
    if (!meetings.length) {
      setSelectedMeetingId(null);
      return;
    }
    if (selectedMeeting) {
      setSelectedMeetingId(String(selectedMeeting.id));
    } else {
      setSelectedMeetingId(null);
    }
  }, [meetings, selectedMeeting]);

  /** Persist org-wide active meeting (Meetings tab + Shareholders filter); all users pick this up on refresh. */
  const persistSystemActiveMeeting = useCallback(
    async (meeting: Meeting) => {
      const r = await setStoredActiveMeetingId(meeting.id);
      if (!r.success) {
        toast({
          title: "Could not save active meeting",
          description: r.error ?? "Try again.",
          variant: "destructive",
        });
        return;
      }
      setSelectedMeeting(meeting);
      await reloadMeetingsFromDb(true);
    },
    [toast, reloadMeetingsFromDb, setSelectedMeeting],
  );

  const clearPendingCsvImport = useCallback(() => {
    setPendingCsvFile(null);
    setPendingCsvRowCount(null);
    if (csvInputMeetingModalRef.current) csvInputMeetingModalRef.current.value = "";
  }, []);

  const handlePendingCsvFileChosen = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const meetingIdForCsv = csvImportMeeting?.id ?? systemSelectedMeetingId;
      if (!meetingIdForCsv) {
        toast({
          title: "Choose a meeting",
          description: "Open Import from a meeting row on the Meetings tab, or set the active meeting first.",
          variant: "destructive",
        });
        e.target.value = "";
        return;
      }
      if (file.size > 12 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Use a CSV under 12 MB.",
          variant: "destructive",
        });
        e.target.value = "";
        return;
      }
      setIsValidatingCsv(true);
      try {
        const result = await validateBenefitUnitOwnerCsvFile(file);
        if (!result.ok) {
          toast({
            title: "Invalid CSV",
            description: result.error,
            variant: "destructive",
          });
          e.target.value = "";
          setPendingCsvFile(null);
          setPendingCsvRowCount(null);
          return;
        }
        setPendingCsvFile(file);
        setPendingCsvRowCount(result.filteredRowCount);
        toast({
          title: "CSV validated",
          description: `${result.filteredRowCount} data row(s) ready. Click Save to import.`,
        });
      } catch (err) {
        toast({
          title: "Could not read file",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
        e.target.value = "";
        setPendingCsvFile(null);
        setPendingCsvRowCount(null);
      } finally {
        setIsValidatingCsv(false);
      }
    },
    [csvImportMeeting, systemSelectedMeetingId, toast],
  );

  // Handle CSV upload
  const handleUpload = useCallback(
    async (formData: FormData): Promise<boolean> => {
      if (uploadInProgressRef.current) {
        return false;
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

        setCurrentStep("Uploading and importing…");

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
        setShareholderAdminRefresh((k) => k + 1);
        setPendingCsvFile(null);
        setPendingCsvRowCount(null);
        if (csvInputMeetingModalRef.current) csvInputMeetingModalRef.current.value = "";
        toast({
          title: "Import complete",
          description: "Benefit unit owner data was loaded. The list below will refresh.",
        });
        return true;
      } catch (error) {
        // Clear the interval if there's an error
        if (progressInterval) clearInterval(progressInterval);
        setUploadError(error instanceof Error ? error.message : String(error));
        setCurrentStep("Upload failed");
        return false;
      }
    },
    [refreshMeetings, toast]
  );

  const handleSavePendingCsvImport = useCallback(async () => {
    const meetingIdForCsv = csvImportMeeting?.id ?? systemSelectedMeetingId;
    if (!pendingCsvFile || !meetingIdForCsv) {
      toast({
        title: "Nothing to save",
        description: "Choose a CSV file and wait for validation first.",
        variant: "destructive",
      });
      return;
    }
    setCsvImportMeeting(null);
    const formData = new FormData();
    formData.append("file", pendingCsvFile);
    formData.append("meetingId", meetingIdForCsv);
    await handleUpload(formData);
  }, [csvImportMeeting, pendingCsvFile, systemSelectedMeetingId, handleUpload, toast]);

  const handleUploadComplete = useCallback(() => {
    setIsUploading(false);
    setUploadProgress(0);
    setCurrentStep("");
    uploadInProgressRef.current = false;
  }, []);

  const resetWipeConfirmDialog = useCallback(() => {
    setWipeConfirmOpen(false);
    setWipeConfirmMeeting(null);
    setWipePreviewCounts(null);
    setWipePreviewError(null);
    setWipePreviewLoading(false);
  }, []);

  const openWipeConfirmDialog = useCallback(async (meeting: Meeting) => {
    setWipeConfirmMeeting(meeting);
    setWipeConfirmOpen(true);
    setWipePreviewCounts(null);
    setWipePreviewError(null);
    setWipePreviewLoading(true);
    try {
      const res = await fetch(
        `/api/shareholders/clear-for-meeting?meetingId=${encodeURIComponent(meeting.id)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not load counts");
      }
      setWipePreviewCounts({
        shareholders: Number(data.shareholderCount ?? 0),
        properties: Number(data.propertyCount ?? 0),
      });
    } catch (error) {
      setWipePreviewError(
        error instanceof Error ? error.message : "Failed to load shareholder and property counts",
      );
    } finally {
      setWipePreviewLoading(false);
    }
  }, []);

  const handleExportMeetingCsv = useCallback(async (meeting: Meeting) => {
    setExportingMeetingId(meeting.id);
    try {
      const res = await fetch(`/api/admin/meetings/${encodeURIComponent(meeting.id)}/export-csv`);
      const disposition = res.headers.get("Content-Disposition");
      let filename = `benefit-unit-owners-meeting-${meeting.year}-${meeting.id}.csv`;
      const match = disposition?.match(/filename="([^"]+)"/);
      if (match?.[1]) filename = match[1];
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === "string" ? err.error : "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Export ready",
        description: `Downloaded CSV for ${meeting.year} Annual Meeting (ID ${meeting.id}).`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export failed",
        description: error instanceof Error ? error.message : "Could not export CSV",
      });
    } finally {
      setExportingMeetingId(null);
    }
  }, [toast]);

  const handleExportSignatureList = useCallback(
    async (meeting: Meeting) => {
      setExportingSignatureListMeetingId(meeting.id);
      try {
        const res = await fetch(
          `/api/admin/meetings/${encodeURIComponent(meeting.id)}/export-signature-list`,
        );
        const disposition = res.headers.get("Content-Disposition");
        let filename = `signature-list-meeting-${meeting.year}-${meeting.id}.pdf`;
        const match = disposition?.match(/filename="([^"]+)"/);
        if (match?.[1]) filename = match[1];
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(typeof err.error === "string" ? err.error : "Export failed");
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({
          title: "Signature list ready",
          description: `Downloaded signature list PDF — ${meeting.year} Annual Meeting (ID ${meeting.id}).`,
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Export failed",
          description:
            error instanceof Error ? error.message : "Could not export signature list",
        });
      } finally {
        setExportingSignatureListMeetingId(null);
      }
    },
    [toast],
  );

  const runBulkUncheckInForMeeting = useCallback(async () => {
    if (!uncheckMeetingDialog) return;
    setUncheckInProgress(true);
    try {
      const response = await fetch("/api/properties/bulk-uncheckin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: uncheckMeetingDialog.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to uncheck-in properties for this meeting");
      }
      toast({
        title: "Unchecked",
        description: `Unchecked ${data.updatedCount ?? 0} propert${(data.updatedCount ?? 0) === 1 ? "y" : "ies"}; cleared check-in for ${data.shareholdersCleared ?? 0} benefit unit owner${(data.shareholdersCleared ?? 0) === 1 ? "" : "s"}.`,
      });
      setUncheckMeetingDialog(null);
      setShareholderAdminRefresh((k) => k + 1);
      await refreshMeetings();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to uncheck-in",
      });
    } finally {
      setUncheckInProgress(false);
    }
  }, [uncheckMeetingDialog, refreshMeetings, toast]);

  /** Remove all benefit unit owners and properties for one meeting; keeps the meeting row and snapshots. */
  const handleWipeMeetingShareholdersAndProperties = useCallback(
    async (meetingId: string) => {
      setWipingMeetingId(meetingId);
      try {
        const res = await fetch("/api/shareholders/clear-for-meeting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meetingId }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to remove data for this meeting");
        }
        toast({
          title: "Shareholders and properties removed",
          description: `Removed ${data.deletedShareholders ?? 0} benefit unit owner(s) and ${data.deletedProperties ?? 0} propert${(data.deletedProperties ?? 0) === 1 ? "y" : "ies"}. The meeting record is unchanged; snapshots are still stored.`,
        });
        resetWipeConfirmDialog();
        setShareholderAdminRefresh((k) => k + 1);
        await refreshMeetings();
        if (String(selectedMeeting?.id ?? "") === String(meetingId)) {
          await refreshProperties();
          try {
            const response = await fetch(
              `/api/shareholders?meetingId=${encodeURIComponent(meetingId)}`,
            );
            if (response.ok) {
              const sh = await response.json();
              setShareholders(sh.shareholders || []);
            }
          } catch {
            /* list will refresh on next navigation */
          }
        }
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Could not remove meeting data",
          variant: "destructive",
        });
      } finally {
        setWipingMeetingId(null);
      }
    },
    [refreshMeetings, refreshProperties, resetWipeConfirmDialog, selectedMeeting?.id, toast],
  );

  // Handle meeting deletion (server removes shareholders, properties, snapshots, then the meeting row)
  const handleDelete = async (meetingId: string): Promise<boolean> => {
    try {
      const formData = new FormData();
      formData.append("id", meetingId);
      
      const result = await deleteMeeting(formData);
      
      if (result.success) {
        const allMeetings = await refreshMeetings();
        const deleted = String(meetingId);
        const wasActive =
          String(selectedMeetingId ?? "") === deleted || String(selectedMeeting?.id ?? "") === deleted;
        if (wasActive && allMeetings) {
          const nextActive = getLatestMeeting(allMeetings);
          if (nextActive) {
            setSelectedMeetingId(nextActive.id);
            setSelectedMeeting(nextActive);
            void persistSystemActiveMeeting(nextActive);
          } else {
            setSelectedMeetingId(null);
            setSelectedMeeting(null);
            void clearStoredActiveMeetingId();
          }
        }
        toast({
          title: "Meeting deleted",
          description:
            "This meeting and all of its benefit unit owners, properties, and history snapshots were removed.",
          variant: "default",
        });
        return true;
      }
        toast({
          title: "Error",
          description: result.error || "Failed to delete meeting",
          variant: "destructive",
        });
      return false;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete meeting",
        variant: "destructive",
      });
      return false;
    }
  };

  const runMailerGeneration = useCallback(
    async (meeting: Meeting) => {
      const abortController = new AbortController();
      mailerAbortControllerRef.current = abortController;
      setMailerGeneratingMeetingId(meeting.id);
      setMailerDialogOpen(true);
      setMailerGenerationCancelConfirmOpen(false);
      setMailerProgress(0);
      setMailerProgressIndeterminate(false);
      setMailerStatus("Starting…");
      setMailerBatchShareholderCount(0);
      try {
        const mailerResult = await generateMeetingMailers(meeting.id, {
          isLocalMode: isMailerLocalMode,
          signal: abortController.signal,
          onProgress: (p) => {
            if (p.mailerProgress !== undefined) setMailerProgress(p.mailerProgress);
            if (p.mailerProgressIndeterminate !== undefined) {
              setMailerProgressIndeterminate(p.mailerProgressIndeterminate);
            }
            if (p.currentBatchStatus !== undefined) setMailerStatus(p.currentBatchStatus);
            if (p.currentBatchShareholderCount !== undefined) {
              setMailerBatchShareholderCount(p.currentBatchShareholderCount);
            }
          },
        });
        await markMeetingMailersGenerated(meeting.id);
        toast({
          title: "Success",
          description:
            mailerResult.lastLocalPath != null && mailerResult.lastLocalPath !== ""
              ? `Invitation PDFs saved under ${mailerResult.lastLocalPath} (mailers-001.pdf, mailers-002.pdf, … sized to ~2.5 GiB per file so each stays under 3 GB).`
              : `Invitation PDFs generated for ${meeting.year} Annual Meeting.`,
        });
        await reloadMeetingsFromDb(true);
        setMailerDialogOpen(false);
      } catch (e) {
        const aborted =
          e instanceof DOMException
            ? e.name === "AbortError"
            : e instanceof Error && e.name === "AbortError";
        if (aborted) {
          toast({
            title: "Cancelled",
            description: "Mailer generation was stopped.",
          });
          setMailerDialogOpen(false);
        } else {
          toast({
            title: "Error",
            description: e instanceof Error ? e.message : "Failed to generate mailers",
            variant: "destructive",
          });
          setMailerDialogOpen(false);
        }
      } finally {
        mailerAbortControllerRef.current = null;
        setMailerGeneratingMeetingId(null);
      }
    },
    [isMailerLocalMode, toast, reloadMeetingsFromDb],
  );

  const confirmAbortMailerGeneration = useCallback(() => {
    mailerAbortControllerRef.current?.abort();
    setMailerGenerationCancelConfirmOpen(false);
    setMailerDialogOpen(false);
  }, []);

  const handleOpenMailerInviteSetup = useCallback((meeting: Meeting) => {
    setMailerInviteSetupMeeting(meeting);
    setMailerInviteSetupOpen(true);
  }, []);

  const handleGenerateMeetingMailers = useCallback(
    async (meeting: Meeting) => {
      if (isMailerLocalMode) {
        setMailerDiskCheckLoadingId(meeting.id);
        try {
          const preflightParams = new URLSearchParams({
            meetingId: meeting.id,
          });
          const res = await fetch(`/api/mailer-disk-preflight?${preflightParams.toString()}`, {
            credentials: "include",
          });
          if (!res.ok) {
            let msg = `Request failed (${res.status})`;
            try {
              const j = (await res.json()) as { error?: string };
              if (j.error) msg = j.error;
            } catch {
              /* ignore */
            }
            throw new Error(msg);
          }
          const data = (await res.json()) as MailerDiskPreflightResult;
          setMailerDiskPreflightPayload({ meeting, data });
          setMailerDiskPreflightOpen(true);
        } catch (e) {
          toast({
            title: "Disk check failed",
            description: e instanceof Error ? e.message : "Could not estimate disk space",
            variant: "destructive",
          });
        } finally {
          setMailerDiskCheckLoadingId(null);
        }
        return;
      }
      await runMailerGeneration(meeting);
    },
    [isMailerLocalMode, toast, runMailerGeneration],
  );

  const handleMailerInviteSetupConfirm = useCallback(() => {
    if (!mailerInviteSetupMeeting) return;
    const m = mailerInviteSetupMeeting;
    setMailerInviteSetupOpen(false);
    setMailerInviteSetupMeeting(null);
    void handleGenerateMeetingMailers(m);
  }, [mailerInviteSetupMeeting, toast, handleGenerateMeetingMailers]);

  const handleMailerDiskPreflightConfirm = useCallback(() => {
    const payload = mailerDiskPreflightPayload;
    if (!payload) return;
    setMailerDiskPreflightOpen(false);
    setMailerDiskPreflightPayload(null);
    void runMailerGeneration(payload.meeting);
  }, [mailerDiskPreflightPayload, runMailerGeneration]);

  const handleDownloadSavedMeetingMailers = useCallback(
    async (meeting: Meeting) => {
      if (mailerDownloadInFlightRef.current) {
        return;
      }
      mailerDownloadInFlightRef.current = true;
      setDownloadingSavedMailersMeetingId(meeting.id);
      const { dismiss: dismissLoadingUi } = toast({
        title: "Preparing mailer download",
        description:
          "Listing batches and packaging files. Large ZIPs can take a minute — stay on this page.",
        duration: 600_000,
      });
      try {
        const n = await downloadAllMeetingMailerPdfs(meeting.id, isMailerLocalMode);
        if (n === 0) {
          toast({
            title: "No PDF files found",
            description: isMailerLocalMode
              ? `Nothing under mailers/${meeting.id}/ on this machine. Run Generate invitation PDFs first.`
              : "No invitation PDFs in Blob storage for this meeting. Generate them from Actions first.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Download started",
            description:
              n === 1
                ? "1 PDF batch file — check your browser downloads."
                : `ZIP with ${n} PDF batch files — check your browser downloads.`,
          });
        }
      } catch (e) {
        toast({
          title: "Download failed",
          description: e instanceof Error ? e.message : "Could not download PDFs",
          variant: "destructive",
        });
      } finally {
        dismissLoadingUi();
        mailerDownloadInFlightRef.current = false;
        setDownloadingSavedMailersMeetingId(null);
      }
    },
    [isMailerLocalMode, toast],
  );

  const handleGenerateTestMailer = useCallback(async () => {
    setTestMailerDownloading(true);
    try {
      const response = await fetch("/api/mailer-test-pdf", { credentials: "include" });
      if (!response.ok) {
        let message = `Request failed (${response.status})`;
        try {
          const data = (await response.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = "mailer-layout-test.pdf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
        toast({
        title: "Test mailer downloaded",
        description:
          "Sample address (centered) and barcode (left edge on panel centerline) — same as generated invitation PDFs.",
      });
    } catch (e) {
      toast({
        title: "Could not generate test mailer",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setTestMailerDownloading(false);
    }
  }, [toast]);

  const showDataChanges =
    selectedMeeting && selectedMeeting.mailersGenerated;

  // Handle employee creation
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    // Remove FormData logic
    // const form = e.target as HTMLFormElement;
    // const formData = new FormData(form);
    
    // Add basic validation before sending
    if (!newEmployee.fullName || !newEmployee.email) {
      toast({
        title: "Missing Information",
        description: "Please enter both full name and email.",
        variant: "destructive",
      });
      return;
    }
    
    setIsCreatingEmployee(true); // Set loading state
    
    try {
      const response = await fetch("/api/create-employee", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // Use state directly, remove isAdmin
        body: JSON.stringify({
          fullName: newEmployee.fullName,
          email: newEmployee.email,
          // isAdmin: formData.get("isAdmin") === "on", // Removed isAdmin
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create employee");
      }
      
      // Reset state instead of form.reset()
      setNewEmployee({ fullName: "", email: "" }); 
      
      // Trigger refresh of employee list
      setEmployeeRefreshTrigger(prev => prev + 1);
      
      toast({
        title: "Success",
        description: "Employee created successfully",
        variant: "default",
      });
      setShowAddEmployeeForm(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create employee",
        variant: "destructive",
      });
    } finally {
      setIsCreatingEmployee(false); // Reset loading state
    }
  };

  // Function to format city/state/zip consistently (CITY STATE ZIP)
  const formatCityStateZip = (value: string): string => {
    if (!value) return '';
    
    // First, remove all commas and normalize existing spaces
    let formatted = value.replace(/,/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
    
    // Check if we have a string with no spaces (like MINOTND80000)
    if (!formatted.includes(' ')) {
      // Try to detect common state codes and split accordingly
      const statePatterns = /([A-Z]+)(AK|AL|AR|AZ|CA|CO|CT|DC|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)([0-9]+)/;
      const match = formatted.match(statePatterns);
      
      if (match) {
        // We found a pattern like MINOTND80000
        const [_, city, state, zip] = match;
        formatted = `${city} ${state} ${zip}`;
      }
    }
    
    return formatted;
  };
  
  // Add handlers for address copying
  const handleServiceAddressChange = (value: string) => {
    // Convert to uppercase right away
    const uppercaseValue = value.toUpperCase();
    
    setNewShareholderData(prev => ({
      ...prev,
      serviceAddress: uppercaseValue
    }));
    
    // Update other addresses if copy options are enabled
    if (useServiceForCustomer) {
      setNewShareholderData(prev => ({
        ...prev,
        customerMailingAddress: uppercaseValue
      }));
    }
    
    if (useServiceForOwner) {
      setNewShareholderData(prev => ({
        ...prev,
        ownerMailingAddress: uppercaseValue
      }));
    }
    
    if (useServiceForResident) {
      setNewShareholderData(prev => ({
        ...prev,
        residentMailingAddress: uppercaseValue
      }));
    }
  };
  
  const handleCityStateZipChange = (value: string) => {
    // Store the raw input with commas and spaces, just convert to uppercase
    const uppercaseValue = value.toUpperCase();
    
    setNewShareholderData(prev => ({
      ...prev,
      cityStateZip: uppercaseValue
    }));
    
    // Update other city/state/zip if copy options are enabled
    if (useServiceForCustomer) {
      setNewShareholderData(prev => ({
        ...prev,
        cityStateZip: uppercaseValue
      }));
    }
    
    if (useServiceForOwner) {
      setNewShareholderData(prev => ({
        ...prev,
        ownerCityStateZip: uppercaseValue
      }));
    }
    
    if (useServiceForResident) {
      setNewShareholderData(prev => ({
        ...prev,
        residentCityStateZip: uppercaseValue
      }));
    }
  };
  
  const handleUseServiceForCustomer = (checked: boolean) => {
    setUseServiceForCustomer(checked);
    if (checked) {
      setNewShareholderData(prev => ({
        ...prev,
        customerMailingAddress: prev.serviceAddress,
        cityStateZip: prev.cityStateZip
      }));
    }
  };
  
  const handleUseServiceForOwner = (checked: boolean) => {
    setUseServiceForOwner(checked);
    if (checked) {
      setNewShareholderData(prev => ({
        ...prev,
        ownerMailingAddress: prev.serviceAddress,
        ownerCityStateZip: prev.cityStateZip
      }));
    }
  };
  
  const handleUseServiceForResident = (checked: boolean) => {
    setUseServiceForResident(checked);
    if (checked) {
      setNewShareholderData(prev => ({
        ...prev,
        residentMailingAddress: prev.serviceAddress,
        residentCityStateZip: prev.cityStateZip
      }));
    }
  };

  // Add handlers for name copying
  const handleShareholderNameChange = (value: string) => {
    // Convert to uppercase right away
    const uppercaseValue = value.toUpperCase();
    
    setNewShareholderData(prev => ({
      ...prev,
      name: uppercaseValue
    }));
    
    // Update other names if copy options are enabled
    if (useShareholderForOwner) {
      setNewShareholderData(prev => ({
        ...prev,
        ownerName: uppercaseValue
      }));
    }
    
    if (useShareholderForCustomer) {
      setNewShareholderData(prev => ({
        ...prev,
        customerName: uppercaseValue
      }));
    }
    
    if (useShareholderForResident) {
      setNewShareholderData(prev => ({
        ...prev,
        residentName: uppercaseValue
      }));
    }
  };
  
  const handleUseShareholderForOwner = (checked: boolean) => {
    setUseShareholderForOwner(checked);
    if (checked) {
      setNewShareholderData(prev => ({
        ...prev,
        ownerName: prev.name
      }));
    }
  };
  
  const handleUseShareholderForCustomer = (checked: boolean) => {
    setUseShareholderForCustomer(checked);
    if (checked) {
      setNewShareholderData(prev => ({
        ...prev,
        customerName: prev.name
      }));
    }
  };
  
  const handleUseShareholderForResident = (checked: boolean) => {
    setUseShareholderForResident(checked);
    if (checked) {
      setNewShareholderData(prev => ({
        ...prev,
        residentName: prev.name
      }));
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
            className="mt-4 cursor-pointer"
          >
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  const loadImageAsBase64 = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = "Anonymous";
      img.onload = function () {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  return (
    <div className="w-full [&_button:not(:disabled)]:cursor-pointer [&_[role=menuitem]:not([data-disabled])]:cursor-pointer [&_[role=tab]:not(:disabled)]:cursor-pointer [&_[role=option]:not([data-disabled])]:cursor-pointer [&_[role=combobox]:not(:disabled)]:cursor-pointer [&_label:has(input[type=file]:not(:disabled))]:cursor-pointer">
      <div className="max-w-6xl mx-auto bg-white px-3 sm:px-6 lg:px-8 py-4 sm:py-6 mb-16 md:mb-6 shadow-sm rounded-lg">
        <div className="space-y-6">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Admin Dashboard
              </h1>
              
              <p className="text-sm text-gray-500">
                Manage employees, meetings, and system settings
              </p>
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
                className="w-full sm:w-auto flex items-center justify-center gap-1" 
              onClick={() => refreshMeetings()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Loading...' : 'Refresh'}
            </Button>
        </div>
        
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-muted-foreground sm:grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="meetings">Meetings</TabsTrigger>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="shareholders">Benefit Unit Owners</TabsTrigger>
            <TabsTrigger value="properties">Properties</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
        <div className="w-full flex justify-center items-center">
          <div className="max-w-6xl">
            <CheckinStatusDashboard />
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg shadow transition text-base"
              onClick={async () => {
                try {
                  setIsLoading(true);
                  
                  // Fetch properties
                  const propertiesResponse = await fetch(`/api/properties?limit=5000${meetingScopeQuery}`);
                  if (!propertiesResponse.ok) throw new Error("Failed to fetch properties");
                  const propertiesData = propertiesFromApiPayload(await propertiesResponse.json());

                  // Fetch shareholders
                  const shareholdersResponse = await fetch(
                    selectedMeeting
                      ? `/api/shareholders?meetingId=${encodeURIComponent(selectedMeeting.id)}`
                      : "/api/shareholders?limit=5000"
                  );
                  if (!shareholdersResponse.ok) throw new Error("Failed to fetch shareholders");
                  const shareholdersData = await shareholdersResponse.json();
                  
                  // Calculate statistics
                  const totalProperties = propertiesData.length;
                  const checkedInProperties = propertiesData.filter((p: Property) => p.checkedIn).length;
                  const totalShareholders = shareholdersData.shareholders.length;
                  const checkedInShareholders = shareholdersData.shareholders.filter((s: any) => 
                    propertiesData.some((p: Property) => p.shareholderId === s.shareholderId && p.checkedIn)
                  ).length;
                  
                  // Load logos as base64
                  const nprwdLogo = await loadImageAsBase64("/NPRWDLogo.png");
                  const softWhereLogo = await loadImageAsBase64("/soft-where-logo.png");

                  const doc = new jsPDF();

                  // Draw logos (adjust x, y, width, height as needed)
                  doc.addImage(nprwdLogo, "PNG", 15, 10, 30, 30);
                  doc.addImage(softWhereLogo, "PNG", 160, 10, 30, 30);
                  
                  // Add title
                  doc.setFontSize(20);
                  doc.text("NPRWD AquaShare", 105, 20, { align: "center"});
                  doc.text("Benefit Unit Owner Meeting", 105, 30, { align: "center"});
                  doc.text("Meeting Report", 105, 40, { align: "center" });
                  
                  // Add date
                  doc.setFontSize(12);
                  doc.text(`Meeting Date: ${selectedMeeting ? new Date(selectedMeeting.date).toLocaleDateString() : 'Not specified'}`, 105, 50, { align: "center" });
                  
                  // Add statistics
                  doc.setFontSize(14);
                  doc.text("Meeting Statistics", 20, 70);
                  
                  doc.setFontSize(12);
                  doc.text(`Total Benefit Unit Owners: ${totalShareholders}`, 20, 80);
                  doc.text(`Checked-in Benefit Unit Owners: ${checkedInShareholders}`, 20, 90);
                  doc.text(`Attendance Rate: ${((checkedInShareholders / totalShareholders) * 100).toFixed(1)}%`, 20, 100);
                  
                  doc.text(`Total Benefit Units: ${totalProperties}`, 20, 120);
                  doc.text(`Checked-in Benefit Units: ${checkedInProperties}`, 20, 130);
                  doc.text(`Benefit Units Check-in Rate: ${((checkedInProperties / totalProperties) * 100).toFixed(1)}%`, 20, 140);
                  
                  // Add summary
                  doc.setFontSize(14);
                  doc.text("Summary", 20, 170);
                  doc.setFontSize(12);
                  doc.text(
                    `This report shows that ${checkedInShareholders} out of ${totalShareholders} benefit unit owners ` +
                    `(${((checkedInShareholders / totalShareholders) * 100).toFixed(1)}%) have checked in, ` +
                    `representing ${checkedInProperties} out of ${totalProperties} properties ` +
                    `(${((checkedInProperties / totalProperties) * 100).toFixed(1)}%).`,
                    20, 180, { maxWidth: 170 }
                  );
                  
                  // Save the PDF
                  doc.save("benefit-unit-owner-meeting-report.pdf");
                  
                  toast({
                    title: "Success",
                    description: "Report generated successfully",
                  });
                } catch (error) {
                  toast({
                    title: "Error",
                    description: error instanceof Error ? error.message : "Failed to generate report",
                    variant: "destructive",
                  });
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Final Report
                </>
              )}
            </Button>
          </div>
        </div>
          </TabsContent>

          <TabsContent value="meetings" className="mt-4 space-y-6">
            <div
              className={cn(
                "rounded-lg border px-4 py-3 text-sm",
                selectedMeeting
                  ? "border-blue-200 bg-blue-50/90"
                  : "border-amber-200 bg-amber-50/90"
              )}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="font-semibold text-gray-900">
                    Active meeting for the system
                  </p>
                  {selectedMeeting ? (
                    <p className="text-gray-700">
                      <span className="font-medium">
                        {selectedMeeting.year} Annual Meeting
                      </span>
                      <span className="text-gray-500">
                        {" · "}
                        {new Date(selectedMeeting.date).toLocaleDateString()}
                      </span>
                      <span className="ml-2 font-mono text-xs text-gray-500">
                        (ID {selectedMeeting.id})
                      </span>
                    </p>
                  ) : (
                    <p className="text-amber-900">
                      No meeting is selected. Uploads, mailers, reports, and check-in all use the
                      meeting you choose below.
                    </p>
                  )}
                </div>
                {selectedMeeting && (
                  <Badge
                    className="w-fit shrink-0 border-blue-200 bg-blue-100 text-blue-800 hover:bg-blue-100"
                    variant="secondary"
                  >
                    <Check className="mr-1 h-3.5 w-3.5" aria-hidden />
                    In use
                  </Badge>
                )}
              </div>
            </div>
              
        {/* Shareholder Meetings Card */}
            <Card>
          <CardHeader className="bg-gradient-to-r from-blue-50 to-white pb-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-2">
                <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Meetings
            </CardTitle>
                <CardDescription>
                  Use <span className="font-medium text-foreground">Actions</span> on each row to set the active meeting,
                  edit details, export or import benefit unit owners as CSV (Excel meetings only for import), or run
                  destructive tools.
                  {isDevEnvironment ? (
                    <>
                      {" "}
                      In development, <span className="font-medium text-foreground">Generate invitation PDFs</span> opens a
                      dialog to choose where files are saved, then runs generation.
                    </>
                  ) : null}{" "}
                  After mailers are generated,{" "}
                  <span className="font-medium text-foreground">Existing mailers</span> downloads a ZIP of PDFs (cloud in
                  production; local dev zips the project <span className="font-mono text-xs">mailers/</span> tree — if you
                  saved to another drive via folder picker, open that drive in File Explorer).{" "}
                  <span className="font-medium text-foreground">Uncheck-in all</span> resets check-in and signatures only;{" "}
                  <span className="font-medium text-foreground">Delete all shareholders &amp; properties</span> removes benefit
                  unit owner and property rows but keeps the meeting record.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {/* Create a new meeting */}
            <CreateMeetingForm
              onSuccess={(meeting) => {
                setMeetings((prev: Meeting[]) =>
                  [...prev, meeting].sort(
                    (a, b) =>
                      new Date(a.date).getTime() - new Date(b.date).getTime() ||
                      String(a.id).localeCompare(String(b.id)),
                  ),
                );
                toast({
                  title: "Success",
                  description: "Meeting created successfully"
                });
              }}
            />

            {/* List existing meetings */}
            <div className="space-y-3 mt-4">
              <h3 className="text-sm font-medium text-gray-700">Existing Meetings</h3>
                  {initialLoading ? (
                    <div className="flex justify-center items-center h-24">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    </div>
                  ) : meetings.length === 0 ? (
                <div className="p-4 rounded-lg bg-gray-50 text-center text-gray-500 text-sm">
                  No meetings found. Create your first meeting above.
                </div>
              ) : (
                meetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    role="group"
                    aria-label={`${meeting.year} annual meeting row`}
                    tabIndex={0}
                    className={cn(
                      "flex w-full flex-col rounded-lg border transition-all text-left",
                      selectedMeetingId === meeting.id 
                        ? "border-blue-500 bg-blue-50 shadow-sm" 
                        : "hover:border-gray-300 hover:bg-gray-50",
                      isUploading || wipingMeetingId !== null
                        ? "cursor-not-allowed opacity-80"
                        : "cursor-pointer",
                    )}
                      onClick={() => {
                      if (isUploading || wipingMeetingId !== null) return;
                      void persistSystemActiveMeeting(meeting);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      if (isUploading || wipingMeetingId !== null) return;
                      void persistSystemActiveMeeting(meeting);
                    }}
                  >
                    <div className="flex w-full flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {meeting.year} Annual Meeting
                          </h3>
                          <p className="text-sm text-gray-500">
                            {new Date(meeting.date).toLocaleDateString()}
                          </p>
                          <p className="mt-1 text-xs font-mono text-muted-foreground">
                            Meeting ID <span className="font-semibold text-foreground">{meeting.id}</span>
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {meeting.mailersGenerated ? (
                              <Badge
                                className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-50"
                                variant="secondary"
                                title={
                                  meeting.mailerGenerationDate
                                    ? `Invitation PDFs generated ${new Date(meeting.mailerGenerationDate).toLocaleString()}`
                                    : "Invitation PDF batches were generated and stored"
                                }
                              >
                                <Mail className="mr-1 h-3 w-3" aria-hidden />
                                Mailers generated
                                {meeting.mailerGenerationDate ? (
                                  <span className="ml-1 font-normal opacity-90">
                                    · {new Date(meeting.mailerGenerationDate).toLocaleDateString()}
                                  </span>
                                ) : null}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Invitation PDFs not generated yet
                              </span>
                            )}
                        </div>
                        </div>
                          {selectedMeetingId === meeting.id && (
                          <Badge
                            className="shrink-0 border-blue-200 bg-blue-100 text-blue-800 hover:bg-blue-100"
                            variant="secondary"
                          >
                            <Check className="mr-1 h-3 w-3" aria-hidden />
                            Active
                          </Badge>
                          )}
                        </div>
                      </div>

                    <div
                      className="flex shrink-0 flex-wrap items-center justify-end gap-2"
                      data-meeting-actions
                      onClick={(e) => e.stopPropagation()}
                    >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 cursor-pointer gap-1"
                          disabled={
                            isUploading ||
                            wipingMeetingId !== null ||
                            exportingMeetingId === meeting.id
                          }
                          aria-label={`Actions for ${meeting.year} annual meeting`}
                        >
                          Actions
                          <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[min(100vw-2rem,17rem)]">
                        <DropdownMenuItem
                          disabled={isUploading || wipingMeetingId !== null}
                          onSelect={() => {
                            setTimeout(() => {
                              setSelectedMeetingId(meeting.id);
                              void persistSystemActiveMeeting(meeting);
                            }, 0);
                          }}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Set as active meeting
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={isUploading || wipingMeetingId !== null}
                          onSelect={() => {
                            setTimeout(() => {
                              setSelectedMeetingId(meeting.id);
                              void persistSystemActiveMeeting(meeting);
                              setMeetingToEdit(
                                meetings.find((m) => String(m.id) === String(meeting.id)) ?? meeting,
                              );
                            }, 0);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit meeting
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={
                            isUploading ||
                            wipingMeetingId !== null ||
                            exportingMeetingId === meeting.id
                          }
                          onSelect={() => {
                            setTimeout(() => void handleExportMeetingCsv(meeting), 0);
                          }}
                        >
                          {exportingMeetingId === meeting.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <Download className="mr-2 h-4 w-4" aria-hidden />
                          )}
                          Export benefit unit owners (CSV)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={
                            isUploading ||
                            wipingMeetingId !== null ||
                            exportingSignatureListMeetingId === meeting.id
                          }
                          onSelect={() => {
                            setTimeout(() => void handleExportSignatureList(meeting), 0);
                          }}
                        >
                          {exportingSignatureListMeetingId === meeting.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <FileText className="mr-2 h-4 w-4" aria-hidden />
                          )}
                          Export Signature List
                        </DropdownMenuItem>
                        {isDevEnvironment ? (
                          <DropdownMenuItem
                            disabled={
                              isUploading ||
                              wipingMeetingId !== null ||
                              mailerGeneratingMeetingId === meeting.id ||
                              mailerDiskCheckLoadingId === meeting.id
                            }
                            onSelect={() => {
                              setTimeout(() => handleOpenMailerInviteSetup(meeting), 0);
                            }}
                          >
                            {mailerGeneratingMeetingId === meeting.id ||
                            mailerDiskCheckLoadingId === meeting.id ? (
                              <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" aria-hidden />
                            ) : (
                              <Mail className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                            )}
                            Generate invitation PDFs
                          </DropdownMenuItem>
                        ) : null}
                        {meeting.mailersGenerated && (
                          <DropdownMenuItem
                            disabled={isUploading || wipingMeetingId !== null}
                            onSelect={() => {
                              void handleDownloadSavedMeetingMailers(meeting);
                            }}
                          >
                            {downloadingSavedMailersMeetingId === meeting.id ? (
                              <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" aria-hidden />
                            ) : (
                              <Download className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                            )}
                            Download existing mailers
                          </DropdownMenuItem>
                        )}
                        {meeting.dataSource === "excel" && (
                          <DropdownMenuItem
                            disabled={isUploading || wipingMeetingId !== null}
                            onSelect={() =>
                              setTimeout(() => {
                                clearPendingCsvImport();
                                setCsvImportMeeting(meeting);
                              }, 0)
                            }
                          >
                            <Upload className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                            Import benefit unit owners (CSV)…
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={isUploading || wipingMeetingId !== null}
                          onSelect={() => setTimeout(() => setUncheckMeetingDialog(meeting), 0)}
                        >
                          Uncheck-in all
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={isUploading || wipingMeetingId !== null}
                          onSelect={() => setTimeout(() => void openWipeConfirmDialog(meeting), 0)}
                        >
                          Delete all shareholders &amp; properties
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={isUploading || wipingMeetingId !== null}
                          onSelect={() => setTimeout(() => setDeleteMeetingDialog(meeting), 0)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                          Delete meeting…
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                    </div>
                    {downloadingSavedMailersMeetingId === meeting.id ? (
                      <div
                        className="border-t border-blue-200 bg-blue-50/90 px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
                          <Loader2
                            className="h-4 w-4 shrink-0 animate-spin"
                            aria-hidden
                          />
                          <span>Preparing mailer download…</span>
                        </div>
                        <p className="mt-1 text-xs text-blue-800/90">
                          Fetching PDF batches and building your file. You can keep working; the
                          browser will save when ready.
                        </p>
                        <div
                          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-blue-200/80"
                          role="progressbar"
                          aria-valuetext="Loading"
                          aria-busy
                        >
                          <div className="h-full w-full origin-left animate-pulse rounded-full bg-blue-600/90" />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
              <AlertDialog
                open={wipeConfirmOpen}
                onOpenChange={(open) => {
                  if (!open) resetWipeConfirmDialog();
                }}
              >
                <AlertDialogContent className="max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete all shareholders and properties?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3 text-sm text-muted-foreground">
                        {wipeConfirmMeeting && (
                          <p>
                            <span className="font-medium text-foreground">
                              {wipeConfirmMeeting.year} Annual Meeting
                            </span>
                            <span className="text-muted-foreground">
                              {" "}
                              · ID {wipeConfirmMeeting.id}
                            </span>
                          </p>
                        )}
                        {wipePreviewLoading && (
                          <div className="flex items-center gap-2 py-1 text-foreground">
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                            <span>Calculating how many records will be removed…</span>
                          </div>
                        )}
                        {!wipePreviewLoading && wipePreviewError && (
                          <p className="text-destructive">
                            {wipePreviewError} You can still confirm deletion below if you want to continue.
                          </p>
                        )}
                        {!wipePreviewLoading && wipePreviewCounts && (
                          <p className="text-foreground">
                            This action will remove{" "}
                            <strong>
                              {wipePreviewCounts.shareholders.toLocaleString()} benefit unit owner
                              {wipePreviewCounts.shareholders === 1 ? "" : "s"}
                            </strong>{" "}
                            and{" "}
                            <strong>
                              {wipePreviewCounts.properties.toLocaleString()} propert
                              {wipePreviewCounts.properties === 1 ? "y" : "ies"}
                            </strong>
                            . The meeting row stays so you can re-import CSV. Saved change snapshots for this meeting are{" "}
                            <strong>not</strong> removed. To delete the meeting and snapshots, use{" "}
                            <strong>Delete meeting</strong> in Actions.
                          </p>
                        )}
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={wipingMeetingId !== null}>Cancel</AlertDialogCancel>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={
                        wipingMeetingId !== null ||
                        wipePreviewLoading ||
                        !wipeConfirmMeeting
                      }
                      onClick={() => {
                        if (wipeConfirmMeeting) void handleWipeMeetingShareholdersAndProperties(wipeConfirmMeeting.id);
                      }}
                    >
                      {wipingMeetingId !== null ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                          Deleting…
                        </>
                      ) : (
                        "Delete all data"
                      )}
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog
                open={uncheckMeetingDialog !== null}
                onOpenChange={(open) => {
                  if (!open) setUncheckMeetingDialog(null);
                }}
              >
                      <AlertDialogContent>
                        <AlertDialogHeader>
                    <AlertDialogTitle>Uncheck-in all for this meeting?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <span className="block">
                        For{" "}
                        <span className="font-medium text-foreground">
                          {uncheckMeetingDialog
                            ? `${uncheckMeetingDialog.year} Annual Meeting (ID ${uncheckMeetingDialog.id})`
                            : ""}
                        </span>
                        , this sets every benefit unit to not checked in and clears owner signatures and check-in
                        timestamps for benefit unit owners tied to this meeting. Other meetings are not affected.
                      </span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={uncheckInProgress}>Cancel</AlertDialogCancel>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={uncheckInProgress}
                      onClick={() => void runBulkUncheckInForMeeting()}
                    >
                      {uncheckInProgress ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                          Working…
                        </>
                      ) : (
                        "Uncheck-in all"
                      )}
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog
                open={deleteMeetingDialog !== null}
                onOpenChange={(open) => {
                  if (!open) setDeleteMeetingDialog(null);
                }}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete meeting {deleteMeetingDialog?.id}?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <span className="block">
                        This permanently deletes this annual meeting record and{" "}
                        <strong>all benefit unit owners</strong> tied to it (including legacy year IDs),{" "}
                        <strong>all of their properties</strong>, and{" "}
                        <strong>saved change snapshots</strong> for this meeting. This cannot be undone.
                      </span>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button
                      type="button"
                      className="bg-red-600 text-white hover:bg-red-700"
                      onClick={() => {
                        void (async () => {
                          if (!deleteMeetingDialog) return;
                          const ok = await handleDelete(deleteMeetingDialog.id);
                          if (ok) setDeleteMeetingDialog(null);
                        })();
                      }}
                    >
                      Delete meeting and data
                    </Button>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
            </div>
          </CardContent>
        </Card>

            {selectedMeeting && showDataChanges && (
              <Card className="mt-6 overflow-hidden hover:shadow-md transition-all">
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
            {isDevEnvironment ? (
            <Dialog
              open={mailerInviteSetupOpen}
              onOpenChange={(open) => {
                setMailerInviteSetupOpen(open);
                if (!open) setMailerInviteSetupMeeting(null);
              }}
            >
              <DialogContent className="max-h-[min(90vh,720px)] max-w-lg overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Generate invitation PDFs</DialogTitle>
                  <DialogDescription>
                    {mailerInviteSetupMeeting ? (
                      <>
                        Optionally download a layout test, then generate invitation PDFs for{" "}
                        <span className="font-medium text-foreground">
                          {mailerInviteSetupMeeting.year} Annual Meeting
                        </span>{" "}
                        <span className="font-mono text-xs">(ID {mailerInviteSetupMeeting.id})</span>.
                        {isMailerLocalMode ? (
                          <>
                            {" "}
                            In development, PDFs are written under{" "}
                            <span className="font-mono text-xs">mailers/&#123;meeting id&#125;/</span> as{" "}
                            <span className="font-mono text-xs">mailers-001.pdf</span>,{" "}
                            <span className="font-mono text-xs">mailers-002.pdf</span>, … (each part sized to ~2.5 GiB; page count follows the mailer template).
                          </>
                        ) : null}
                      </>
                    ) : null}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="rounded-md border border-muted bg-muted/30 px-3 py-3">
                    <p className="text-sm font-medium text-foreground">Test mailer layout</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sample address and barcode — same layout as production batches (one page per mailer).
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 gap-2"
                      disabled={testMailerDownloading}
                      onClick={(e) => {
                        e.preventDefault();
                        void handleGenerateTestMailer();
                      }}
                    >
                      {testMailerDownloading ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <FileText className="h-4 w-4" aria-hidden />
                      )}
                      Generate test mailer
                    </Button>
                  </div>
                </div>
                <DialogFooter className="gap-2 sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setMailerInviteSetupOpen(false);
                      setMailerInviteSetupMeeting(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="button" onClick={() => void handleMailerInviteSetupConfirm()}>
                    Generate invitation PDFs
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            ) : null}

            <AlertDialog
              open={mailerDiskPreflightOpen}
              onOpenChange={(open) => {
                setMailerDiskPreflightOpen(open);
                if (!open) {
                  setMailerDiskPreflightPayload(null);
                }
              }}
            >
              <AlertDialogContent className="max-w-lg">
                <AlertDialogHeader>
                  <AlertDialogTitle>Local disk space (mailers folder)</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3 text-left text-sm text-foreground">
                      {mailerDiskPreflightPayload ? (
                        <>
                          <p>
                            <span className="font-medium text-foreground">
                              {mailerDiskPreflightPayload.meeting.year} Annual Meeting
                            </span>{" "}
                            <span className="font-mono text-xs">
                              (ID {mailerDiskPreflightPayload.meeting.id})
                            </span>
                          </p>
                          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                            <li>
                              Benefit unit owners:{" "}
                              <span className="font-medium text-foreground">
                                {mailerDiskPreflightPayload.data.shareholderCount.toLocaleString()}
                              </span>
                            </li>
                            <li>
                              Measured size per mailer (sample):{" "}
                              <span className="font-medium text-foreground">
                                {mailerDiskPreflightPayload.data.bytesPerMailerFormatted}
                              </span>
                            </li>
                            <li>
                              Estimated total output:{" "}
                              <span className="font-medium text-foreground">
                                {mailerDiskPreflightPayload.data.estimatedRawFormatted}
                              </span>{" "}
                              raw,{" "}
                              <span className="font-medium text-foreground">
                                {mailerDiskPreflightPayload.data.estimatedWithMarginFormatted}
                              </span>{" "}
                              with {mailerDiskPreflightPayload.data.marginPercent}% margin for filesystem overhead
                            </li>
                            <li>
                              Free space on project drive (
                              <span className="break-all font-mono text-xs">
                                {mailerDiskPreflightPayload.data.mailersDirectory}
                              </span>
                              ):{" "}
                              {mailerDiskPreflightPayload.data.freeFormatted !== null ? (
                                <span className="font-medium text-foreground">
                                  {mailerDiskPreflightPayload.data.freeFormatted}
                                </span>
                              ) : (
                                <span className="text-amber-700 dark:text-amber-400">
                                  Could not read — continue only if you know there is enough room
                                </span>
                              )}
                            </li>
                          </ul>
                          {mailerDiskPreflightPayload.data.sufficient === false &&
                          mailerDiskPreflightPayload.data.shortfallFormatted ? (
                            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
                              Not enough free space on the project drive: you need about{" "}
                              <strong>{mailerDiskPreflightPayload.data.shortfallFormatted}</strong> more under{" "}
                              <span className="font-mono">mailers/</span> (after the margin), or free disk space / move
                              the repo.
                            </p>
                          ) : null}
                          {mailerDiskPreflightPayload.data.sufficient === null ? (
                            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                              Free space could not be detected on the project volume. If generation stops with a
                              disk-full error, free space on the drive that contains this project&apos;s{" "}
                              <span className="font-mono">mailers/</span> folder.
                            </p>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            Estimate is total PDF bytes for all owners (same model as generation). Delete old PDFs in{" "}
                            <span className="font-mono">mailers/</span> if you need space.
                          </p>
                        </>
                      ) : (
                        <span />
                      )}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                  <Button type="button" onClick={handleMailerDiskPreflightConfirm}>
                    Generate mailers
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Dialog
              open={mailerDialogOpen}
              onOpenChange={(open) => {
                if (open) setMailerDialogOpen(true);
              }}
            >
              <DialogContent
                className="sm:max-w-md"
                hideCloseButton
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
              >
                <DialogHeader>
                  <DialogTitle>Generating invitation PDFs</DialogTitle>
                  <DialogDescription>
                    {isMailerLocalMode
                      ? "Writing batched PDFs (mailers-001.pdf, mailers-002.pdf, … ~2.5 GiB per file) under mailers/{meeting id}/."
                      : "Uploading batched PDFs to storage (same naming; ~2.5 GiB per file)."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  {mailerProgressIndeterminate ? (
                    <div
                      className="relative h-2 w-full overflow-hidden rounded-full bg-primary/20"
                      role="progressbar"
                      aria-valuetext="Generating PDF on server"
                    >
                      <div className="absolute inset-y-0 w-1/3 rounded-full bg-primary animate-mailer-indeterminate" />
                    </div>
                  ) : (
                    <Progress value={mailerProgress} className="h-2" />
                  )}
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>
                      {mailerBatchShareholderCount > 0
                        ? `${mailerBatchShareholderCount} benefit unit owner${mailerBatchShareholderCount === 1 ? "" : "s"}`
                        : "—"}
                    </span>
                    <span>
                      {mailerProgressIndeterminate ? "—" : `${mailerProgress}%`}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{mailerStatus}</p>
                  <p className="text-xs text-muted-foreground">
                    One page per benefit unit owner, ordered by ZIP on the mailing address; multiple PDF files in order.
                    The dev server terminal logs progress while each batch is built.
                  </p>
                </div>
                <DialogFooter className="sm:justify-stretch pt-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="lg"
                    className="w-full text-base font-semibold"
                    onClick={() => setMailerGenerationCancelConfirmOpen(true)}
                  >
                    Cancel generation
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <AlertDialog
              open={mailerGenerationCancelConfirmOpen}
              onOpenChange={setMailerGenerationCancelConfirmOpen}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Stop generating invitation PDFs?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Any partial file already written stays on disk or in storage. You can run generation
                    again for the same meeting if needed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel type="button">Keep generating</AlertDialogCancel>
                  <AlertDialogAction
                    type="button"
                    className={buttonVariants({ variant: "destructive" })}
                    onClick={confirmAbortMailerGeneration}
                  >
                    Stop generation
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Dialog
              open={csvImportMeeting !== null}
              onOpenChange={(open) => {
                if (!open) {
                  setCsvImportMeeting(null);
                  clearPendingCsvImport();
                }
              }}
            >
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Import benefit unit owners (CSV)</DialogTitle>
                  <DialogDescription>
                    {csvImportMeeting ? (
                      <>
                        Parsed rows replace all benefit unit owners for{" "}
                        <span className="font-medium text-foreground">
                          {csvImportMeeting.year} Annual Meeting
                        </span>{" "}
                        <span className="font-mono text-xs">(ID {csvImportMeeting.id})</span>.
                      </>
                    ) : null}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0 space-y-4">
                      <label
                        htmlFor="meeting-csv-modal-upload"
                        className={cn(
                          "flex flex-col items-center justify-center w-full min-h-[7rem] border-2 border-dashed rounded-lg transition-colors px-3 py-4",
                          !isUploading && !isValidatingCsv
                            ? "cursor-pointer border-amber-300 bg-amber-50 hover:bg-amber-100 hover:border-amber-400"
                            : "cursor-not-allowed border-gray-200 bg-gray-100",
                        )}
                      >
                        {isValidatingCsv ? (
                          <>
                            <Loader2 className="w-8 h-8 mb-2 animate-spin text-amber-500" />
                            <span className="text-sm text-gray-700">Parsing and validating CSV…</span>
                          </>
                        ) : (
                          <>
                            <Upload className={cn("w-8 h-8 mb-2", isUploading ? "text-gray-400" : "text-amber-500")} />
                            <span className="text-sm font-semibold text-gray-800">Choose CSV file</span>
                            <span className="text-xs text-gray-500 mt-1 text-center">
                              Headers are normalized like the server import; each row needs an account value.
                            </span>
                          </>
                        )}
                        <input
                          ref={csvInputMeetingModalRef}
                          id="meeting-csv-modal-upload"
                          name="file"
                          type="file"
                          className="hidden"
                          accept=".csv,text/csv"
                          disabled={isUploading || isValidatingCsv || csvImportMeeting === null}
                          onChange={handlePendingCsvFileChosen}
                        />
                      </label>

                      {pendingCsvFile && pendingCsvRowCount !== null && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm text-emerald-950">
                            <span className="font-medium">{pendingCsvFile.name}</span>
                            <span className="text-emerald-900">
                              {" "}
                              — {pendingCsvRowCount} row(s) passed validation.
                            </span>
                          </p>
                          <div className="flex flex-wrap gap-2 shrink-0">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={clearPendingCsvImport}
                              disabled={isUploading}
                            >
                              Discard
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void handleSavePendingCsvImport()}
                              disabled={
                                isUploading ||
                                !(csvImportMeeting?.id ?? systemSelectedMeetingId)
                              }
                            >
                              {isUploading ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Saving…
                                </>
                              ) : (
                                "Save"
                              )}
                            </Button>
                    </div>
                        </div>
                      )}

                    <UploadProgress
                      isUploading={isUploading}
                      progress={uploadProgress}
                      currentStep={currentStep}
                      error={uploadError}
                      onComplete={handleUploadComplete}
                    />
                  </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 w-full sm:w-auto cursor-pointer"
                      disabled={isUploading || isValidatingCsv}
                      onClick={() => triggerBenefitUnitOwnerCsvTemplateDownload()}
                    >
                      <Download className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                      Download CSV template
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <EditMeetingDialog
              meeting={meetingToEdit}
              onClose={() => setMeetingToEdit(null)}
              onSaved={async (updated) => {
                toast({
                  title: "Meeting updated",
                  description: `${updated.year} Annual Meeting · ${new Date(updated.date).toLocaleString()}`,
                });
                const list = await refreshMeetings();
                const fresh = list?.find((m) => String(m.id) === String(updated.id));
                if (fresh && String(selectedMeetingId) === String(updated.id)) {
                  setSelectedMeeting(fresh);
                }
              }}
            />
          </TabsContent>

          <TabsContent value="employees" className="mt-4 space-y-6">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {!showAddEmployeeForm && (
                <Button
                  type="button"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => setShowAddEmployeeForm(true)}
                >
                  + Add Employee
                </Button>
              )}
            </div>

            <div className="space-y-6">
              <div className="rounded-lg border bg-white">
                <EmployeeList refreshTrigger={employeeRefreshTrigger} />
              </div>
            </div>

            {showAddEmployeeForm && (
              <Card>
                <CardHeader className="bg-gradient-to-r from-green-50 to-white pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <UserPlus className="h-5 w-5 shrink-0 text-green-600" />
                    New employee
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
                          onChange={(e) => setNewEmployee((prev) => ({ ...prev, fullName: e.target.value }))}
                          required
                          className="border-gray-200 focus:border-green-500 focus:ring-green-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="Enter employee's email"
                          value={newEmployee.email}
                          onChange={(e) => setNewEmployee((prev) => ({ ...prev, email: e.target.value }))}
                          required
                          className="border-gray-200 focus:border-green-500 focus:ring-green-500"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        disabled={isCreatingEmployee}
                        onClick={() => {
                          setShowAddEmployeeForm(false);
                          setNewEmployee({ fullName: "", email: "" });
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="w-full bg-green-600 hover:bg-green-700 sm:w-auto"
                        disabled={isCreatingEmployee}
                      >
                        {isCreatingEmployee ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create employee"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="shareholders" className="mt-4 space-y-3">
            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <Checkbox
                  id="admin-shareholders-all-meetings"
                  checked={shareholdersShowAllMeetings}
                  onCheckedChange={(v) => {
                    const on = v === true;
                    if (on) {
                      setShareholdersShowAllMeetings(true);
                    } else {
                      setShareholdersShowAllMeetings(false);
                    }
                  }}
                />
                <Label htmlFor="admin-shareholders-all-meetings" className="cursor-pointer font-normal leading-snug">
                  Show shareholders from <span className="font-medium">all</span> meetings (full database). When off, the list uses the{" "}
                  <span className="font-medium">active meeting</span> chosen on the Meetings tab (saved for everyone).
                </Label>
          </div>
        </div>
      <Card className="border-0 shadow-none">
        <CardContent className="p-0">
                <ShareholdersList
                  listAllShareholders={shareholdersShowAllMeetings}
                  meetingIdForQuery={undefined}
                  showMeetingColumn
                  adminManageShareholders={true}
                  refreshTrigger={shareholderAdminRefresh}
                  onAdminMutation={() => setShareholderAdminRefresh((k) => k + 1)}
                />
        </CardContent>
      </Card>
          </TabsContent>
        
          <TabsContent value="properties" className="mt-4 space-y-6">
          {/* Property Management Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-gray-900">Property Management</h2>
            </div>

            {systemSelectedMeetingId ? (
              meetingForPropertyScope ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50/90 px-4 py-3 text-sm">
                  <p className="font-semibold text-gray-900">Showing properties for</p>
                  <p className="mt-1 text-gray-800">
                    {formatMeetingLabel(meetingForPropertyScope)}
                    <span className="ml-2 font-mono text-xs text-gray-600">
                      · Database ID {meetingForPropertyScope.id}
                    </span>
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  Active meeting id <span className="font-mono font-medium">{systemSelectedMeetingId}</span> does not
                  match the meetings list. Open the Meetings tab or refresh.
                </div>
              )
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                Choose an annual meeting on the <span className="font-medium">Meetings</span> tab to scope this list.
              </div>
            )}

            <Separator />
            
            <div className="bg-white rounded-lg border">
              <div className="w-full p-4 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by owner, address..."
                      className="pl-10 border-gray-200 focus:border-primary"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="bg-white rounded-lg border">
                  <Button 
                    className="w-full"
                    onClick={() => setShowCreatePropertyDialog(true)}
                  >
                    Create a new property
                  </Button>
                </div>

                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : !systemSelectedMeetingId ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>Select a meeting on the Meetings tab to load properties.</p>
                  </div>
                ) : filteredProperties.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Search className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    <p>
                      {searchQuery.trim()
                        ? "No properties match your search for this meeting."
                        : "No properties found for this meeting."}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-2 text-sm text-gray-600">
                      Showing {filteredProperties.length} of {properties.length} properties
                    </div>
                    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                      {paginatedProperties.map((property) => (
                        <Card 
                          key={property.id}
                          className={cn(
                            "overflow-hidden cursor-pointer transition-colors",
                            property.shareholderId && newShareholderIds.has(property.shareholderId)
                              ? "bg-yellow-50 border-yellow-300 hover:border-yellow-400"
                              : "hover:border-primary bg-white border-gray-200"
                          )}
                          onClick={() => {
                            setSelectedProperty(property);
                            setShowDetails(true);
                          }}
                        >
                          <CardContent className="p-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <h3 className="font-medium text-gray-900">{property.serviceAddress}</h3>
                                <p className="text-sm text-gray-500">{property.ownerName || property.customerName}</p>
                              </div>
                              <Badge 
                                variant={property.checkedIn ? "success" : "secondary"}
                                className={property.checkedIn ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}
                              >
                                {property.checkedIn ? "Checked In" : "Not Checked In"}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <div className="flex justify-between items-center mt-4">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span>
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          </TabsContent>

          <TabsContent value="system" className="mt-4">
            <div className="rounded-md border bg-muted/30 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  Dependency Install Links
                </h3>
                <p className="text-xs text-muted-foreground">
                  Topaz pad capture needs the Chrome extension, SigPlusExtLite on Windows, and SigPlus where applicable.
                </p>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a
                      href="https://chromewebstore.google.com/detail/topaz-sigplusextlite-exte/dhcpobccjkdnmibckgpejmbpmpembgco?pli=1"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      Topaz SigPlusExtLite Extension (Chrome Web Store)
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://www.topazsystems.com/software/SigPlusExtLite_V3.exe"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      Topaz SigPlusExtLite (SigPlusExtLite_V3.exe)
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://www.topazsystems.com/software/sigplus.exe"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      Topaz SigPlus (sigplus.exe)
                    </a>
                  </li>
                </ul>
              </div>
          </TabsContent>
        </Tabs>
        </div>
      </div>

      {/* Property Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Property Details</DialogTitle>
            <DialogDescription>
              View property information
            </DialogDescription>
          </DialogHeader>
          
          {selectedProperty && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Status</Label>
                  <Badge 
                    variant={selectedProperty.checkedIn ? "success" : "secondary"}
                    className={selectedProperty.checkedIn ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}
                  >
                    {selectedProperty.checkedIn ? "Checked In" : "Not Checked In"}
                  </Badge>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <Label className="text-xs text-gray-500">Owner</Label>
                <p className="font-medium">{selectedProperty.ownerName}</p>
                <p className="text-sm text-gray-600">{selectedProperty.ownerMailingAddress}</p>
                <p className="text-sm text-gray-600">{selectedProperty.ownerCityStateZip}</p>
              </div>
              
              <div>
                <Label className="text-xs text-gray-500">Service Address</Label>
                <p className="font-medium">{selectedProperty.serviceAddress}</p>
              </div>

              <div className="pt-4">
                <Separator className="mb-4" />
                <div className="flex gap-2 mt-3 border-t pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center gap-1 w-full"
                    onClick={() => {
                      setSelectedProperty(selectedProperty);
                      setTransferType("new");
                      setShowTransferDialog(true);
                    }}
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Transfer
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button 
              className="w-full sm:w-auto"
              onClick={() => setShowDetails(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Shareholder/Property Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        if (!open) {
          // Reset form when closing
          setAcquisitionType("new");
          setNewShareholderData({
            name: "",
            serviceAddress: "",
            ownerName: "",
            customerName: "",
            ownerMailingAddress: "",
            ownerCityStateZip: "",
            customerMailingAddress: "",
            cityStateZip: "",
            residentName: "",
            residentMailingAddress: "",
            residentCityStateZip: "",
          });
          setSelectedExistingProperty(null);
          setExistingPropertySearchQuery("");
          setShowAddDialog(false);
          setUseServiceForCustomer(false);
          setUseServiceForOwner(false);
          setUseServiceForResident(false);
          setUseShareholderForOwner(false);
          setUseShareholderForCustomer(false);
          setUseShareholderForResident(false);
        }
        setShowAddDialog(open);
      }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Shareholder</DialogTitle>
            <DialogDescription>
              Create a new shareholder with property
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Shareholder Name</Label>
              <Input 
                value={newShareholderData.name}
                onChange={(e) => handleShareholderNameChange(e.target.value)}
                placeholder="Enter full name"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Acquisition Type</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant={acquisitionType === "new" ? "default" : "outline"} 
                  className={acquisitionType === "new" ? "border-primary bg-primary text-white" : "justify-start"}
                  onClick={() => setAcquisitionType("new")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New Property
                </Button>
                <Button 
                  variant={acquisitionType === "existing" ? "default" : "outline"} 
                  className={acquisitionType === "existing" ? "border-primary bg-primary text-white" : "justify-start"}
                  onClick={() => setAcquisitionType("existing")}
                >
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Existing Property
                </Button>
              </div>
            </div>
            
            {acquisitionType === "new" && (
              <div className="space-y-4 mt-1">
                {/* Owner Information Section */}
                <div className="border p-3 rounded-md space-y-2">
                  <h3 className="text-sm font-medium">Owner Information</h3>
                  <Input 
                    placeholder="Owner Name" 
                    value={newShareholderData.ownerName}
                    onChange={(e) => setNewShareholderData(prev => ({...prev, ownerName: e.target.value.toUpperCase()}))}
                    className="bg-white"
                  />
                  <Input 
                    placeholder="Owner Mailing Address" 
                    value={newShareholderData.ownerMailingAddress}
                    onChange={(e) => setNewShareholderData(prev => ({...prev, ownerMailingAddress: e.target.value.toUpperCase()}))}
                    disabled={useServiceForOwner}
                    className={useServiceForOwner ? "bg-gray-50 border-gray-200" : "bg-white"}
                  />
                  <Input 
                    placeholder="City, State, ZIP (e.g. MINOT ND 80000)" 
                    value={newShareholderData.ownerCityStateZip}
                    onChange={(e) => setNewShareholderData(prev => ({...prev, ownerCityStateZip: e.target.value.toUpperCase()}))}
                    disabled={useServiceForOwner}
                    className={useServiceForOwner ? "bg-gray-50 border-gray-200" : "bg-white"}
                  />
                  <p className="text-xs text-gray-500 mt-1">Format as: CITY STATE ZIP (commas allowed)</p>
                </div>
                
                {/* Service Address Section - Copy from existing property */}
                <div className="border p-3 rounded-md space-y-2">
                  <h3 className="text-sm font-medium">Service Address</h3>
                  <Input 
                    placeholder="Service Address" 
                    value={selectedProperty?.serviceAddress || ""}
                    disabled
                    className="bg-gray-50 border-gray-200"
                  />
                  <Input 
                    placeholder="City, State, ZIP" 
                    value={selectedProperty?.cityStateZip || ""}
                    disabled
                    className="bg-gray-50 border-gray-200"
                  />
                  <p className="text-xs text-gray-500 mt-1">Service address from existing property (cannot be changed)</p>
                </div>
              </div>
            )}

            {acquisitionType === "existing" && (
              <div className="space-y-3">
                <Label>Select Existing Property</Label>
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by address or owner name..."
                      className="pl-10 border-gray-200"
                      value={existingPropertySearchQuery}
                      onChange={(e) => setExistingPropertySearchQuery(e.target.value)}
                    />
                    
                    {/* Dropdown Search Results */}
                    {existingPropertySearchQuery && (
                      <div className="absolute left-0 right-0 top-full mt-1 border rounded-md bg-white shadow-lg z-10 max-h-[200px] overflow-y-auto">
                        {properties
                          .filter(property => {
                            const query = existingPropertySearchQuery.toLowerCase();
                            return property.serviceAddress?.toLowerCase().includes(query) || 
                                  property.ownerName?.toLowerCase().includes(query);
                          })
                          .map(property => (
                            <div 
                              key={property.id} 
                              className="px-3 py-2 border-b hover:bg-gray-50"
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                setSelectedExistingProperty(property);
                                setExistingPropertySearchQuery(""); // Clear search after selection
                              }}
                            >
                              <div style={{ fontSize: '14px', fontWeight: 500, color: "#000000" }}>{property.ownerName}</div>
                              <div style={{ fontSize: '12px', color: "#6B7280" }}>{property.serviceAddress}</div>
                            </div>
                          ))}
                        {properties.filter(property => {
                          const query = existingPropertySearchQuery.toLowerCase();
                          return property.serviceAddress?.toLowerCase().includes(query) || 
                                property.ownerName?.toLowerCase().includes(query) ||
                                property.ownerMailingAddress?.toLowerCase().includes(query) ||
                                property.ownerCityStateZip?.toLowerCase().includes(query);
                        }).length === 0 && (
                          <div className="p-4 text-center text-gray-500">
                            <p>No properties found matching your search</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Selected Property Display */}
                  {selectedExistingProperty && (
                    <div className="mt-3 p-3 border rounded-md bg-blue-50">
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="font-medium text-sm">Selected Property</h4>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0" 
                          onClick={() => setSelectedExistingProperty(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="space-y-1">
                        <div className="font-medium text-sm">{selectedExistingProperty.ownerName}</div>
                        <div className="text-xs text-gray-600">{selectedExistingProperty.serviceAddress}</div>
                        <div className="text-xs text-gray-500">Account: {selectedExistingProperty.account}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button 
              className="w-full sm:w-auto"
              onClick={() => setShowAddDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Property Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={(open) => {
        if (!open) {
          setShowTransferDialog(false);
          setTransferType("new");
          setSelectedExistingShareholder(null);
          setShareholderSearchQuery("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Property</DialogTitle>
            <DialogDescription>
              Transfer property to a new or existing owner
            </DialogDescription>
          </DialogHeader>
          
          {selectedProperty && (
            <div className="p-2 border rounded-md bg-gray-50 space-y-1 my-2">
              <h3 className="text-sm font-medium">Current Property</h3>
              <p className="text-sm font-medium">{selectedProperty.ownerName}</p>
              <p className="text-sm">{selectedProperty.serviceAddress}</p>
            </div>
          )}
          
          <div className="py-1">
            <div>
              <Label className="text-sm font-medium mb-1 block">Transfer Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant={transferType === "new" ? "default" : "outline"} 
                  className={transferType === "new" ? "border-primary bg-primary text-white" : "border-gray-200"}
                  onClick={() => setTransferType("new")}
                >
                  <UserPlus className="mr-1 h-4 w-4" />
                  New Owner
                </Button>
                <Button 
                  variant={transferType === "existing" ? "default" : "outline"} 
                  className={transferType === "existing" ? "border-primary bg-primary text-white" : "border-gray-200"}
                  onClick={() => setTransferType("existing")}
                >
                  <ArrowRightLeft className="mr-1 h-4 w-4" />
                  Existing Owner
                </Button>
              </div>
            </div>
          </div>
          
          {transferType === "new" && (
            <div className="space-y-2 mt-2">
              {/* Owner Information Form */}
              <div className="border p-2 rounded-md space-y-2">
                <h3 className="text-sm font-medium">Owner Information</h3>
                <Input 
                  placeholder="Owner Name" 
                  value={newShareholderData.ownerName}
                  onChange={(e) => setNewShareholderData(prev => ({...prev, ownerName: e.target.value.toUpperCase()}))}
                  className="bg-white h-8 text-sm"
                />
                <Input 
                  placeholder="Owner Mailing Address" 
                  value={newShareholderData.ownerMailingAddress}
                  onChange={(e) => setNewShareholderData(prev => ({...prev, ownerMailingAddress: e.target.value.toUpperCase()}))}
                  disabled={useServiceForOwner}
                  className={`${useServiceForOwner ? "bg-gray-50 border-gray-200" : "bg-white"} h-8 text-sm`}
                />
                <Input 
                  placeholder="City, State, ZIP (e.g. MINOT ND 80000)" 
                  value={newShareholderData.ownerCityStateZip}
                  onChange={(e) => setNewShareholderData(prev => ({...prev, ownerCityStateZip: e.target.value.toUpperCase()}))}
                  disabled={useServiceForOwner}
                  className={`${useServiceForOwner ? "bg-gray-50 border-gray-200" : "bg-white"} h-8 text-sm`}
                />
                <p className="text-xs text-gray-500">Format as: CITY STATE ZIP (commas allowed)</p>
              </div>
            </div>
          )}
          
          {transferType === "existing" && (
            <div className="space-y-2 mt-2">
              {/* Existing Shareholder Selection Form */}
              <div className="border p-2 rounded-md space-y-2">
                <h3 className="text-sm font-medium">Select Existing Shareholder</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name..."
                    className="pl-10 border-gray-200 h-8 text-sm"
                    value={shareholderSearchQuery}
                    onChange={(e) => setShareholderSearchQuery(e.target.value)}
                  />
                </div>
                <div className="border rounded-md overflow-hidden max-h-[150px] overflow-y-auto">
                  {shareholders.length > 0 ? (
                    shareholders
                      .filter(shareholder => {
                        const query = shareholderSearchQuery.toLowerCase();
                        return !query || shareholder.name?.toLowerCase().includes(query);
                      })
                      .map(shareholder => (
                        <div 
                          key={shareholder.id} 
                          className={`py-1 px-2 cursor-pointer hover:bg-gray-50 ${
                            selectedExistingShareholder?.id === shareholder.id ? 'bg-blue-50 border-l-4 border-blue-500' : 'border-b'
                          }`}
                          onClick={() => setSelectedExistingShareholder(shareholder)}
                        >
                          <div className="font-medium text-sm">{shareholder.name}</div>
                          <div className="text-xs text-gray-500 font-mono">
                            Barcode ID:{" "}
                            {displayShareholderId(
                              shareholder.shareholderId,
                              shareholder.meetingId ?? systemSelectedMeetingId,
                            )}
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="p-2 text-center text-gray-500">
                      <p className="text-sm">No shareholders found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="mt-4">
            <Button 
              variant="outline"
              className="w-full sm:w-auto mr-2"
              onClick={() => setShowTransferDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              className="w-full sm:w-auto"
              onClick={async () => {
                if (!selectedProperty) return;
                
                try {
                  // Set loading state
                  setIsLoading(true);
                  
                  if (transferType === "new") {
                    if (!systemSelectedMeetingId) {
                      throw new Error("Select an annual meeting on the Meetings tab before transferring.");
                    }
                    const shareholderId = makeMeetingScopedShareholderId(systemSelectedMeetingId);

                    const shareholderResponse = await fetch("/api/shareholders", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        name: newShareholderData.ownerName.trim().toUpperCase(),
                        shareholderId,
                        ownerMailingAddress: newShareholderData.ownerMailingAddress,
                        ownerCityStateZip: newShareholderData.ownerCityStateZip,
                        meetingId: systemSelectedMeetingId,
                      }),
                    });
                    
                    if (!shareholderResponse.ok) {
                      const errorData = await shareholderResponse.json();
                      throw new Error(errorData.error || "Failed to create shareholder");
                    }
                    
                    // Transfer the property to the new owner
                    const transferResponse = await fetch(`/api/properties/${selectedProperty.id}/transfer`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        newShareholderId: shareholderId,
                        newOwnerName: newShareholderData.ownerName,
                        newOwnerMailingAddress: useServiceForOwner ? selectedProperty.serviceAddress : newShareholderData.ownerMailingAddress,
                        newOwnerCityStateZip: useServiceForOwner ? selectedProperty.cityStateZip : newShareholderData.ownerCityStateZip,
                      }),
                    });
                    
                    if (!transferResponse.ok) {
                      const errorData = await transferResponse.json();
                      throw new Error(errorData.error || "Failed to transfer property");
                    }
                    
                    // Step 2: Update Handler (Add new shareholder ID to set)
                    setNewShareholderIds(ids => new Set(ids).add(shareholderId));
                    
                  } else if (transferType === "existing" && selectedExistingShareholder) {
                    // Transfer to existing shareholder
                    const transferResponse = await fetch(`/api/properties/${selectedProperty.id}/transfer`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        newShareholderId: selectedExistingShareholder.shareholderId,
                        newOwnerName: selectedExistingShareholder.name,
                      }),
                    });
                    
                    if (!transferResponse.ok) {
                      const errorData = await transferResponse.json();
                      throw new Error(errorData.error || "Failed to transfer property");
                    }
                  } else {
                    throw new Error("Please select a shareholder");
                  }
                  
                  toast({
                    title: "Success",
                    description: "Property transferred successfully",
                  });
                  
                  // Refresh properties and close dialog
                  await refreshProperties();
                  setShowTransferDialog(false);
                  
                } catch (error) {
                  toast({
                    title: "Error",
                    description: error instanceof Error ? error.message : "Failed to transfer property",
                  });
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={
                isLoading || 
                !selectedProperty || 
                (transferType === "new" && !newShareholderData.ownerName) ||
                (transferType === "existing" && !selectedExistingShareholder)
              }
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Transfer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Property Dialog */}
      <Dialog open={showCreatePropertyDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCreatePropertyDialog(false);
          setNewPropertyData({
            serviceAddress: "",
            ownerName: "",
            ownerMailingAddress: "",
            ownerCityStateZip: "",
            account: "",
            shareholderId: "",
            cityStateZip: "",
          });
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Property</DialogTitle>
            <DialogDescription>
              Add a new property to the system
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Service Address</Label>
              <Input 
                placeholder="Enter service address" 
                value={newPropertyData.serviceAddress}
                onChange={(e) => setNewPropertyData(prev => ({...prev, serviceAddress: e.target.value.toUpperCase()}))}
                className="bg-white"
              />
            </div>

            <div className="space-y-2">
              <Label>Select Owner</Label>
              <Button 
                className="w-full"
                onClick={() => setShowOwnerSelectionDialog(true)}
              >
                {newPropertyData.ownerName ? newPropertyData.ownerName : "Select Owner"}
              </Button>
            </div>
          </div>
          
          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button 
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setShowCreatePropertyDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              className="w-full sm:w-auto"
              onClick={async () => {
                if (!newPropertyData.serviceAddress || !newPropertyData.ownerName) {
                  toast({
                    title: "Error",
                    description: "Please fill in all required fields",
                    variant: "destructive",
                  });
                  return;
                }

                try {
                  setIsLoading(true);
                  
                  // Generate a random account number if not provided
                  let accountNumber = newPropertyData.account;
                  if (!accountNumber) {
                    accountNumber = Math.floor(Math.random() * (999999 - 100000 + 1) + 100000).toString();
                  }
                  // Use the shareholderId from newPropertyData
                  const shareholderId = newPropertyData.shareholderId;
                  // Validate required fields
                  if (!accountNumber || !newPropertyData.serviceAddress || !shareholderId) {
                    toast({
                      title: "Error",
                      description: "Account number, service address and shareholder ID are required",
                      variant: "destructive",
                    });
                    setIsLoading(false);
                    return;
                  }
                  // Create the property
                  const response = await fetch("/api/properties", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      ...newPropertyData,
                      account: accountNumber,
                      shareholderId,
                      cityStateZip: newPropertyData.ownerCityStateZip,
                    }),
                  });

                  if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "Failed to create property");
                  }

                  toast({
                    title: "Success",
                    description: "Property created successfully",
                  });

                  // Refresh properties and close dialog
                  await refreshProperties();
                  setShowCreatePropertyDialog(false);
                  
                } catch (error) {
                  toast({
                    title: "Error",
                    description: error instanceof Error ? error.message : "Failed to create property",
                    variant: "destructive",
                  });
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading || !newPropertyData.serviceAddress || !newPropertyData.ownerName}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Property"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Owner Selection Dialog */}
      <Dialog open={showOwnerSelectionDialog} onOpenChange={(open) => {
        if (!open) {
          setShowOwnerSelectionDialog(false);
          setPropertyOwnerType("new");
          setSelectedExistingShareholder(null);
          setShareholderSearchQuery("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Owner</DialogTitle>
            <DialogDescription>
              Choose an existing owner or create a new one
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-1">
            <div>
              <Label className="text-sm font-medium mb-1 block">Owner Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant={propertyOwnerType === "new" ? "default" : "outline"} 
                  className={propertyOwnerType === "new" ? "border-primary bg-primary text-white" : "border-gray-200"}
                  onClick={() => setPropertyOwnerType("new")}
                >
                  <UserPlus className="mr-1 h-4 w-4" />
                  New Owner
                </Button>
                <Button 
                  variant={propertyOwnerType === "existing" ? "default" : "outline"} 
                  className={propertyOwnerType === "existing" ? "border-primary bg-primary text-white" : "border-gray-200"}
                  onClick={() => setPropertyOwnerType("existing")}
                >
                  <ArrowRightLeft className="mr-1 h-4 w-4" />
                  Existing Owner
                </Button>
              </div>
            </div>
          </div>
          
          {propertyOwnerType === "new" && (
            <div className="space-y-2 mt-2">
              <div className="border p-2 rounded-md space-y-2">
                <h3 className="text-sm font-medium">Owner Information</h3>
                <Input 
                  placeholder="Owner Name" 
                  value={newPropertyData.ownerName}
                  onChange={(e) => setNewPropertyData(prev => ({...prev, ownerName: e.target.value.toUpperCase()}))}
                  className="bg-white h-8 text-sm"
                />
                <Input 
                  placeholder="Owner Mailing Address" 
                  value={newPropertyData.ownerMailingAddress}
                  onChange={(e) => setNewPropertyData(prev => ({...prev, ownerMailingAddress: e.target.value.toUpperCase()}))}
                  className="bg-white h-8 text-sm"
                />
                <Input 
                  placeholder="City, State, ZIP (e.g. MINOT ND 80000)" 
                  value={newPropertyData.ownerCityStateZip}
                  onChange={(e) => setNewPropertyData(prev => ({...prev, ownerCityStateZip: e.target.value.toUpperCase()}))}
                  className="bg-white h-8 text-sm"
                />
                <p className="text-xs text-gray-500">Format as: CITY STATE ZIP (commas allowed)</p>
              </div>
            </div>
          )}
          
          {propertyOwnerType === "existing" && (
            <div className="space-y-2 mt-2">
              <div className="border p-2 rounded-md space-y-2">
                <h3 className="text-sm font-medium">Select Existing Shareholder</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name..."
                    className="pl-10 border-gray-200 h-8 text-sm"
                    value={shareholderSearchQuery}
                    onChange={(e) => setShareholderSearchQuery(e.target.value)}
                  />
                </div>
                <div className="border rounded-md overflow-hidden max-h-[150px] overflow-y-auto">
                  {shareholders.length > 0 ? (
                    shareholders
                      .filter(shareholder => {
                        const query = shareholderSearchQuery.toLowerCase();
                        return !query || shareholder.name?.toLowerCase().includes(query);
                      })
                      .map(shareholder => (
                        <div 
                          key={shareholder.id} 
                          className={`py-1 px-2 cursor-pointer hover:bg-gray-50 ${
                            selectedExistingShareholder?.id === shareholder.id ? 'bg-blue-50 border-l-4 border-blue-500' : 'border-b'
                          }`}
                          onClick={() => {
                            setSelectedExistingShareholder(shareholder);
                            setNewPropertyData(prev => ({
                              ...prev,
                              ownerName: shareholder.name,
                              ownerMailingAddress: shareholder.ownerMailingAddress,
                              ownerCityStateZip: shareholder.ownerCityStateZip,
                              shareholderId: shareholder.shareholderId,
                            }));
                          }}
                        >
                          <div className="font-medium text-sm">{shareholder.name}</div>
                          <div className="text-xs text-gray-500 font-mono">
                            Barcode ID:{" "}
                            {displayShareholderId(
                              shareholder.shareholderId,
                              shareholder.meetingId ?? systemSelectedMeetingId,
                            )}
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="p-2 text-center text-gray-500">
                      <p className="text-sm">No shareholders found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="mt-4">
            <Button 
              variant="outline"
              className="w-full sm:w-auto mr-2"
              onClick={() => setShowOwnerSelectionDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              className="w-full sm:w-auto"
              onClick={async () => {
                if (propertyOwnerType === "new" && !newPropertyData.ownerName) {
                  toast({
                    title: "Error",
                    description: "Please enter owner name",
                    variant: "destructive",
                  });
                  return;
                }
                if (propertyOwnerType === "existing" && !selectedExistingShareholder) {
                  toast({
                    title: "Error",
                    description: "Please select an existing shareholder",
                    variant: "destructive",
                  });
                  return;
                }

                try {
                  setIsLoading(true);

                  if (propertyOwnerType === "new") {
                    if (!systemSelectedMeetingId) {
                      toast({
                        title: "No meeting selected",
                        description: "Choose an annual meeting on the Meetings tab before creating owners.",
                        variant: "destructive",
                      });
                      return;
                    }
                    const shareholderId = makeMeetingScopedShareholderId(systemSelectedMeetingId);

                    const response = await fetch("/api/shareholders", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        name: newPropertyData.ownerName.trim().toUpperCase(),
                        shareholderId,
                        ownerMailingAddress: newPropertyData.ownerMailingAddress,
                        ownerCityStateZip: newPropertyData.ownerCityStateZip,
                        meetingId: systemSelectedMeetingId,
                      }),
                    });

                    if (!response.ok) {
                      const errorData = await response.json();
                      throw new Error(errorData.error || "Failed to create shareholder");
                    }

                    // Get the created shareholder from the response
                    const createdShareholder = await response.json();
                    // Update the newPropertyData with the generated shareholderId from the response
                    setNewPropertyData(prev => ({
                      ...prev,
                      shareholderId: createdShareholder.shareholderId,
                    }));

                    // Add the new shareholder ID to the set of new shareholders
                    setNewShareholderIds(ids => new Set(ids).add(createdShareholder.shareholderId));

                    toast({
                      title: "Success",
                      description: "New shareholder created successfully",
                    });
                  }

                  setShowOwnerSelectionDialog(false);
                } catch (error) {
                  toast({
                    title: "Error",
                    description: error instanceof Error ? error.message : "Failed to create shareholder",
                    variant: "destructive",
                  });
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={
                (propertyOwnerType === "new" && !newPropertyData.ownerName) ||
                (propertyOwnerType === "existing" && !selectedExistingShareholder)
              }
            >
              {propertyOwnerType === "existing" ? "Select Owner" : "Create and Select New Owner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}