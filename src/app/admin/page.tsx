"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Upload, Check, Trash2, Settings, UserPlus, Calendar, ChevronRight, FileSpreadsheet, Download, RefreshCw, Home, Search, Plus, ArrowRightLeft, Edit, X, FileText } from "lucide-react";
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
import { BulkUncheckInButton } from "@/components/BulkUncheckInButton";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
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

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Add refreshProperties function to reuse in multiple places
  const refreshProperties = async () => {
    try {
      // Clear the search query to ensure all properties are shown after refresh
      setSearchQuery("");
      
      // Fetch the latest properties
      const propertiesResponse = await fetch("/api/properties?limit=5000");
      if (propertiesResponse.ok) {
        const responseText = await propertiesResponse.text();
        if (responseText) {
          const propertiesData = JSON.parse(responseText);
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
  
  // Fetch properties on component mount
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        setIsLoading(true);
        // Add a limit and include all properties
        const response = await fetch("/api/properties?limit=5000");
        if (!response.ok) throw new Error("Failed to fetch properties");
        const data = await response.json();
        setProperties(data);
        setFilteredProperties(data); // Always set all properties initially
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
  }, [toast]);

  // Filter properties based on search
  useEffect(() => {
    if (!properties.length) return;
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

  // Fetch shareholders
  useEffect(() => {
    const fetchShareholders = async () => {
      try {
        const response = await fetch("/api/shareholders?limit=100");
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
  }, [toast]);

  // Refs to track ongoing upload and initialization
  const abortControllerRef = useRef<AbortController | null>(null);
  const uploadInProgressRef = useRef<boolean>(false);
  const initialLoadCompleteRef = useRef<boolean>(false);

  // Add Employee state
  const [newEmployee, setNewEmployee] = useState({
    fullName: "",
    email: "",
  });
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);

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

  // Fetch and refresh meetings
  const refreshMeetings = useCallback(async () => {
    try {
      setIsLoading(true);
      const allMeetings = await getMeetings();
      setMeetings(allMeetings);
    } catch (error) {
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
    // Only load data on mount if we haven't already
    if (!initialLoadCompleteRef.current && meetings.length === 0) {
      // Don't use full page loading state, let components show their own loading indicators
    const loadInitialData = async () => {
        try {
          const allMeetings = await getMeetings();
          setMeetings(allMeetings);
          
          // Auto-select the first meeting if data exists
          if (allMeetings.length > 0 && !selectedMeetingId) {
            setSelectedMeetingId(allMeetings[0].id);
          }
          
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
  }, [meetings.length, selectedMeetingId, toast, setMeetings]);

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
        toast({
          title: "Success",
          description: "Meeting deleted successfully",
          variant: "default",
        });
        
        // Refresh meetings after deletion
        await refreshMeetings();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete meeting",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete meeting",
        variant: "destructive",
      });
    }
  };

  // Handle Print Mailers – will try to use the latest meeting if no meeting is selected
  const handlePrintMailers = async () => {
    setIsPrinting(true);
    try {
      if (!selectedMeeting) {
        throw new Error("No meeting selected");
      }
      
      const response = await fetch("/api/print-mailers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          meetingId: selectedMeeting.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Failed to generate PDFs");
      }

      console.log(`Starting download of ${data.batches.length} PDF batches...`);

      // Download each batch
      for (const batch of data.batches) {
        console.log(`Downloading ${batch.fileName}...`);
        
        // Fetch the PDF from the Vercel Blob URL
        const pdfResponse = await fetch(batch.url);
        if (!pdfResponse.ok) {
          throw new Error(`Failed to download ${batch.fileName}`);
        }

        const blob = await pdfResponse.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = batch.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: "Batch Downloaded",
          description: `${batch.fileName} downloaded successfully`,
          variant: "default",
        });
      }

      toast({
        title: "Success",
        description: "All mailer batches generated and downloaded successfully",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate mailers",
        variant: "destructive",
      });
      console.error(error);
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
            className="mt-4"
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
    <div className="w-full">
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
        
        <div className="w-full flex justify-center items-center">
          <div className="max-w-6xl">
            <CheckinStatusDashboard />
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg shadow transition text-base"
              onClick={async () => {
                try {
                  setIsLoading(true);
                  
                  // Fetch properties
                  const propertiesResponse = await fetch("/api/properties?limit=5000");
                  if (!propertiesResponse.ok) throw new Error("Failed to fetch properties");
                  const propertiesData = await propertiesResponse.json();
                  
                  // Fetch shareholders
                  const shareholdersResponse = await fetch("/api/shareholders?limit=5000");
                  if (!shareholdersResponse.ok) throw new Error("Failed to fetch shareholders");
                  const shareholdersData = await shareholdersResponse.json();
                  
                  // Calculate statistics
                  const totalProperties = propertiesData.length;
                  const checkedInProperties = propertiesData.filter((p: any) => p.checked_in).length;
                  const totalShareholders = shareholdersData.shareholders.length;
                  const checkedInShareholders = shareholdersData.shareholders.filter((s: any) => 
                    propertiesData.some((p: any) => p.shareholderId === s.shareholderId && p.checked_in)
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

        {/* Employee Section */}
        <div className="space-y-6">
              <div className="bg-white rounded-lg border">
            <EmployeeList refreshTrigger={employeeRefreshTrigger} />
          </div>
        </div>

          {/* Cards Grid Section */}
          <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
        {/* Add Employee Card */}
            <Card>
          <CardHeader className="bg-gradient-to-r from-green-50 to-white pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
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
                    onChange={(e) => setNewEmployee(prev => ({ ...prev, email: e.target.value }))}
                    required
                        className="border-gray-200 focus:border-green-500 focus:ring-green-500"
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
            <Card>
          <CardHeader className="bg-gradient-to-r from-blue-50 to-white pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Meetings
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
                          {selectedMeetingId === meeting.id && (
                            <Check className="h-5 w-5 text-blue-500" />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Delete Meeting */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <BulkUncheckInButton />
                        {/* <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="ml-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button> */}
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

          {/* Data Management Section - Condition changed to hide after data upload */}
      {selectedMeeting && !selectedMeeting.hasInitialData && (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-gray-900">Data Management</h2>
              </div>
          <Separator />
          
              <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
            {/* Upload Data Card */}
            {showUploadComponent && (
              <Card className="overflow-hidden hover:shadow-md transition-all">
                <CardHeader className="bg-gradient-to-r from-amber-50 to-white pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Upload className="h-5 w-5 text-amber-600" />
                    Upload Benefit Unit Owner Data
                  </CardTitle>
                  <CardDescription>
                    Upload CSV file with Benefit Unit Owner for {selectedMeeting?.year} meeting
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
      
      <Card className="border-0 shadow-none">
        <CardContent className="p-0">
          <ShareholdersList />
        </CardContent>
      </Card>
        
          {/* Property Management Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-gray-900">Property Management</h2>
            </div>
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
                ) : filteredProperties.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Search className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    <p>No properties found</p>
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
                          <div className="text-xs text-gray-500">Shareholder ID: {shareholder.shareholderId}</div>
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
                    // Generate a random shareholder ID for the new owner
                    const shareholderId = Math.floor(Math.random() * (999999 - 100000 + 1) + 100000).toString();
                    
                    // Create the shareholder first
                    console.log('New address for new shareholder: ', newShareholderData.ownerMailingAddress, newShareholderData.ownerCityStateZip)

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
                          <div className="text-xs text-gray-500">Shareholder ID: {shareholder.shareholderId}</div>
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
                    // Generate a random shareholder ID for the new owner
                    const shareholderId = Math.floor(Math.random() * (999999 - 100000 + 1) + 100000).toString();

                    // Create the new shareholder
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