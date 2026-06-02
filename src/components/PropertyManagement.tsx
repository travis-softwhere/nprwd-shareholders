"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Property } from "@/types/Property"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { Loader2, Search, Building2, Plus, Filter, Home, UserPlus, ArrowRightLeft, FileQuestion } from "lucide-react"
import { PropertyListCards } from "@/components/PropertyListCards"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from "@/components/ui/dialog"
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
} from "@/components/ui/alert-dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getShareholdersList } from "@/actions/getShareholdersList"
import { useToast } from "@/components/ui/use-toast"
import EditablePropertyName from "@/components/EditablePropertyName"
import { useMeeting } from "@/contexts/MeetingContext"
import {
    canonicalShareholderId,
    displayShareholderId,
    makeMeetingScopedShareholderId,
} from "@/lib/meetingScopedShareholderId"
import { propertyMatchesSearch } from "@/lib/propertySearch"
import { formatPropertyForApi } from "@/lib/formatPropertyForApi"

interface TransferHistory {
    id: number;
    fromShareholder: {
        id: string;
        name: string;
    };
    toShareholder: {
        id: string;
        name: string;
    };
    transferredAt: string;
    meetingId?: string | null;
}

interface NewShareholder {
    name: string;
    id: string;
    property: {
        account: string;
        numOf: string;
        customerName: string;
        customerMailingAddress: string;
        cityStateZip: string;
        ownerName: string;
        ownerMailingAddress: string;
        ownerCityStateZip: string;
        residentName: string;
        residentMailingAddress: string;
        residentCityStateZip: string;
        serviceAddress: string;
        checkedIn: boolean;
    };
}

export function PropertyManagement() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { toast } = useToast()
    const { selectedMeeting } = useMeeting()
    const [highlightedPropertyId, setHighlightedPropertyId] = useState<number | null>(null)
    const focusedPropertyHandled = useRef(false)
    const meetingScope = selectedMeeting?.id
        ? `&meetingId=${encodeURIComponent(selectedMeeting.id)}`
        : ""
    const [properties, setProperties] = useState<Property[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [editedProperty, setEditedProperty] = useState<Partial<Property> | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [filterStatus, setFilterStatus] = useState<"all" | "checked" | "unchecked">("all")
    const [isAddingShareholder, setIsAddingShareholder] = useState(false)
    const [isTransferring, setIsTransferring] = useState(false)
    const [shareholders, setShareholders] = useState<any[]>([])
    const [newShareholder, setNewShareholder] = useState<NewShareholder>({
        name: "",
        id: "",
        property: {
            account: "",
            numOf: "",
            customerName: "",
            customerMailingAddress: "",
            cityStateZip: "",
            ownerName: "",
            ownerMailingAddress: "",
            ownerCityStateZip: "",
            residentName: "",
            residentMailingAddress: "",
            residentCityStateZip: "",
            serviceAddress: "",
            checkedIn: false,
        }
    })
    const [transferHistory, setTransferHistory] = useState<TransferHistory[]>([])
    const [isViewingHistory, setIsViewingHistory] = useState(false)
    const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null)
    const [acquisitionType, setAcquisitionType] = useState<"new" | "existing">("new")
    const [selectedExistingProperty, setSelectedExistingProperty] = useState<Property | null>(null)
    const [propertySearchQuery, setPropertySearchQuery] = useState("")
    const [formErrors, setFormErrors] = useState<{[key: string]: string}>({})
    const [useServiceForCustomer, setUseServiceForCustomer] = useState(false)
    const [useServiceForOwner, setUseServiceForOwner] = useState(false)
    const [useServiceForResident, setUseServiceForResident] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchProperties()
        fetchShareholders()
    }, [selectedMeeting?.id])

    const focusPropertyIdParam = searchParams.get("propertyId")
    const focusSearchParam = searchParams.get("search")?.trim() ?? ""

    useEffect(() => {
        focusedPropertyHandled.current = false
    }, [focusPropertyIdParam, focusSearchParam])

    useEffect(() => {
        if (!focusSearchParam) return
        setFilterStatus("all")
        setSearchQuery(focusSearchParam)
    }, [focusSearchParam])

    useEffect(() => {
        if (isLoading || properties.length === 0) return
        if (focusedPropertyHandled.current) return
        if (!focusPropertyIdParam && !focusSearchParam) return

        let property: Property | undefined

        if (focusPropertyIdParam) {
            const id = Number.parseInt(focusPropertyIdParam, 10)
            if (Number.isFinite(id)) {
                property = properties.find((p) => p.id === id)
            }
        }

        if (!property && focusSearchParam) {
            const q = focusSearchParam.toLowerCase()
            property =
                properties.find(
                    (p) => p.serviceAddress?.trim().toLowerCase() === q,
                ) ??
                properties.find((p) =>
                    propertyMatchesSearch(p, focusSearchParam, { properties }),
                )
        }

        if (!property) return

        focusedPropertyHandled.current = true
        setFilterStatus("all")
        setHighlightedPropertyId(property.id)
        setSelectedProperty({ ...property })
        if (focusSearchParam) {
            setSearchQuery(focusSearchParam)
        } else {
            const searchSeed =
                property.serviceAddress?.trim() || property.account?.trim() || ""
            if (searchSeed) setSearchQuery(searchSeed)
        }

        const scrollToCard = () => {
            document.getElementById(`property-card-${property!.id}`)?.scrollIntoView({
                block: "center",
                behavior: "smooth",
            })
        }
        requestAnimationFrame(() => {
            requestAnimationFrame(scrollToCard)
        })
    }, [isLoading, properties, focusPropertyIdParam, focusSearchParam])

    const fetchShareholders = async () => {
        if (!selectedMeeting?.id) {
            setShareholders([])
            return
        }
        try {
            const response = await fetch(
                `/api/shareholders?meetingId=${encodeURIComponent(selectedMeeting.id)}`
            );
            
            if (!response.ok) {
                setError("Failed to fetch shareholders");
                return;
            }
            
            const data = await response.json();
            setShareholders(data.shareholders || []);
        } catch (error) {
            setError("Failed to fetch shareholders");
        }
    };

    const fetchProperties = async () => {
        if (!selectedMeeting?.id) {
            setProperties([])
            setIsLoading(false)
            return
        }
        try {
            setIsLoading(true);
            const response = await fetch(`/api/properties?limit=all${meetingScope}`)
            if (!response.ok) {
                setError("Failed to fetch properties");
                return;
            }
            const data = await response.json()
            setProperties(data.properties)
        } catch (error) {
            setError("Failed to fetch properties");
        } finally {
            setIsLoading(false)
        }
    }

    const handleEdit = (property: Property) => {
        // Make a complete deep copy of the property to avoid reference issues
        setSelectedProperty({...property})
        setEditedProperty({...property})
        setIsEditing(true)
    }

    const handleSave = async () => {
        if (!editedProperty || !selectedProperty) return

        try {
            // Format all property data
            const propertyData = formatPropertyForApi({
                ...selectedProperty,
                ...editedProperty
            });

            const response = await fetch(`/api/properties/${selectedProperty.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(propertyData),
            })

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to update property")
            }

            const updatedProperty = await response.json()
            
            // Update the local state first for immediate feedback
            setProperties(properties.map(p => 
                p.id === updatedProperty.id ? updatedProperty : p
            ))
            
            // Then refresh all properties in the background
            fetchProperties();
            
            setIsEditing(false)
            setSelectedProperty(null)
            toast({
                title: "Success",
                description: "Property updated successfully",
            });
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to update property",
                variant: "destructive",
            });
        }
    }

    const handleDelete = async (propertyId: number) => {
        try {
            const response = await fetch(`/api/properties/${propertyId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to delete property");
            }

            // Update local state first for immediate feedback
            setProperties(properties.filter(p => p.id !== propertyId));
            
            // Refresh the properties list in the background
            fetchProperties();
            
            toast({
                title: "Success",
                description: "Property deleted successfully",
            });
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to delete property",
                variant: "destructive",
            });
        }
    };

    const validateNewShareholderForm = () => {
        const errors: {[key: string]: string} = {};
        
        // Validate shareholder info
        if (!newShareholder.name.trim()) {
            errors.name = "Shareholder name is required";
        }
        
        // Validate property info
        if (!newShareholder.property.account.trim()) {
            errors.account = "Account number is required";
        } else if (!/^\d{10}-\d{2}$/.test(newShareholder.property.account) && 
                  !/^\d{1,10}$/.test(newShareholder.property.account)) {
            errors.account = "Account must be in format XXXXXXXXXX-XX";
        }
        
        if (!newShareholder.property.customerName.trim()) {
            errors.customerName = "Customer name is required";
        }
        
        if (!newShareholder.property.customerMailingAddress.trim()) {
            errors.customerMailingAddress = "Customer mailing address is required";
        }
        
        if (!newShareholder.property.cityStateZip.trim()) {
            errors.cityStateZip = "Customer city, state, zip is required";
        }
        
        if (!newShareholder.property.ownerName.trim()) {
            errors.ownerName = "Owner name is required";
        }
        
        if (!newShareholder.property.ownerMailingAddress.trim()) {
            errors.ownerMailingAddress = "Owner mailing address is required";
        }
        
        if (!newShareholder.property.ownerCityStateZip.trim()) {
            errors.ownerCityStateZip = "Owner city, state, zip is required";
        }
        
        if (!newShareholder.property.serviceAddress.trim()) {
            errors.serviceAddress = "Service address is required";
        }
        
        // Resident info is optional, but if resident name is provided, check format
        if (newShareholder.property.residentName.trim() && 
            !newShareholder.property.residentName.includes(',')) {
            errors.residentName = "Resident name should be in format: LASTNAME, FIRSTNAME";
        }

        console.log("Validation errors:", errors);
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    }

    const handleAddShareholder = async () => {
        // Validate form before submission
        if (!validateNewShareholderForm()) {
            toast({
                title: "Error",
                description: "Please fill in all required fields",
                variant: "destructive",
            });
            return;
        }

        if (!selectedMeeting?.id) {
            toast({
                title: "No meeting selected",
                description: "Choose an annual meeting (toolbar) before adding benefit unit owners.",
                variant: "destructive",
            });
            return;
        }

        try {
            const meetingKey = String(selectedMeeting.id);
            const shareholderId =
                newShareholder.id && newShareholder.id.trim()
                    ? canonicalShareholderId(newShareholder.id.trim(), meetingKey)
                    : makeMeetingScopedShareholderId(meetingKey);

            const propertyData = formatPropertyDataForSubmission(shareholderId);
            
            console.log("Sending property data to API:", propertyData);
            
            // Create shareholder first
            const shareholderResponse = await fetch("/api/shareholders", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: newShareholder.name.trim(),
                    shareholderId,
                    ownerMailingAddress: newShareholder.property.ownerMailingAddress,
                    ownerCityStateZip: newShareholder.property.ownerCityStateZip,
                    meetingId: meetingKey,
                }),
            });

            if (!shareholderResponse.ok) {
                const errorData = await shareholderResponse.json();
                throw new Error(errorData.error || "Failed to create shareholder");
            }

            // If new property is selected, create it
            if (acquisitionType === "new") {
                const propertyResponse = await fetch("/api/properties", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(propertyData),
                });

                if (!propertyResponse.ok) {
                    const errorData = await propertyResponse.json();
                    throw new Error(errorData.error || "Failed to create property");
                }
                
                // Get the created property to verify it was created correctly
                const newProperty = await propertyResponse.json();
                console.log("Created property:", newProperty);
            } else if (selectedExistingProperty) {
                // If existing property is selected, transfer it
                const transferResponse = await fetch(`/api/properties/${selectedExistingProperty.id.toString()}/transfer`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        toShareholderId: shareholderId,
                    }),
                });

                if (!transferResponse.ok) {
                    const errorData = await transferResponse.json();
                    throw new Error(errorData.error || "Failed to transfer property");
                }
            }

            // Refresh the data
            await fetchShareholders();
            await fetchProperties();

            // Reset form and close dialog
            setNewShareholder({
                name: "",
                id: "",
                property: {
                    account: "",
                    numOf: "",
                    customerName: "",
                    customerMailingAddress: "",
                    cityStateZip: "",
                    ownerName: "",
                    ownerMailingAddress: "",
                    ownerCityStateZip: "",
                    residentName: "",
                    residentMailingAddress: "",
                    residentCityStateZip: "",
                    serviceAddress: "",
                    checkedIn: false,
                },
            });
            setFormErrors({});
            setAcquisitionType("new");
            setSelectedExistingProperty(null);
            setIsAddingShareholder(false);

            toast({
                title: "Success",
                description: "Shareholder and property added successfully",
            });
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to add shareholder",
                variant: "destructive",
            });
        }
    };

    const handleTransferProperty = async (propertyId: number, newShareholderId: string) => {
        try {
            const response = await fetch(`/api/properties/${propertyId}/transfer`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    toShareholderId: newShareholderId,
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to transfer property");
            }

            // Refresh the data
            await fetchProperties();

            setIsTransferring(false);
            toast({
                title: "Success",
                description: "Property transferred successfully",
            });
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to transfer property",
                variant: "destructive",
            });
        }
    };

    const fetchTransferHistory = async (propertyId: number) => {
        try {
            const response = await fetch(`/api/properties/${propertyId}/transfers`);
            if (!response.ok) {
                throw new Error("Failed to fetch transfer history");
            }
            const data = await response.json();
            setTransferHistory(data);
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to fetch transfer history",
                variant: "destructive",
            });
        }
    };

    const handleViewHistory = async (propertyId: number) => {
        setSelectedPropertyId(propertyId);
        setIsViewingHistory(true);
        await fetchTransferHistory(propertyId);
    };

    const handleToggleCheckIn = async (property: Property) => {
        try {
            // Format all property data with toggled check-in status
            const updatedProperty = formatPropertyForApi({
                ...property, 
                checkedIn: !property.checkedIn
            });
            
            const response = await fetch(`/api/properties/${property.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(updatedProperty),
            });

            if (!response.ok) {
                throw new Error("Failed to update check-in status");
            }

            const result = await response.json();
            
            // Update the local state immediately for instant feedback
            setProperties(properties.map(p => 
                p.id === result.id ? result : p
            ));
            
            toast({
                title: "Success",
                description: `Property ${result.checkedIn ? 'checked in' : 'checked out'} successfully`,
            });
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to update check-in status",
                variant: "destructive",
            });
        }
    };

    const filteredProperties = properties.filter((property) => {
        const matchesSearch = propertyMatchesSearch(property, searchQuery, { properties })
        const matchesFilter =
            filterStatus === "all" ||
            (filterStatus === "checked" && property.checkedIn) ||
            (filterStatus === "unchecked" && !property.checkedIn)
        return matchesSearch && matchesFilter
    })

    const filteredPropertiesForDropdown = properties.filter((property) =>
        propertyMatchesSearch(property, propertySearchQuery, { properties }),
    )

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
        
        setNewShareholder({
            ...newShareholder,
            property: {
                ...newShareholder.property,
                serviceAddress: uppercaseValue,
            },
        });
        
        // Update other addresses if copy options are enabled
        if (useServiceForCustomer) {
            setNewShareholder(prev => ({
                ...prev,
                property: {
                    ...prev.property,
                    customerMailingAddress: uppercaseValue
                }
            }));
        }
        
        if (useServiceForOwner) {
            setNewShareholder(prev => ({
                ...prev,
                property: {
                    ...prev.property,
                    ownerMailingAddress: uppercaseValue
                }
            }));
        }
        
        if (useServiceForResident) {
            setNewShareholder(prev => ({
                ...prev,
                property: {
                    ...prev.property,
                    residentMailingAddress: uppercaseValue
                }
            }));
        }
    };
    
    const handleServiceCityStateZipChange = (value: string) => {
        // Store the raw input value with commas and spaces
        setNewShareholder({
            ...newShareholder,
            property: {
                ...newShareholder.property,
                cityStateZip: value.toUpperCase(),
            },
        });
        
        // Format only when syncing to other fields
        const formattedValue = formatCityStateZip(value);
        
        // Update other city/state/zip if copy options are enabled
        if (useServiceForCustomer) {
            setNewShareholder(prev => ({
                ...prev,
                property: {
                    ...prev.property,
                    cityStateZip: value.toUpperCase()
                }
            }));
        }
        
        if (useServiceForOwner) {
            setNewShareholder(prev => ({
                ...prev,
                property: {
                    ...prev.property,
                    ownerCityStateZip: value.toUpperCase()
                }
            }));
        }
        
        if (useServiceForResident) {
            setNewShareholder(prev => ({
                ...prev,
                property: {
                    ...prev.property,
                    residentCityStateZip: value.toUpperCase()
                }
            }));
        }
    };
    
    const handleUseServiceForCustomer = (checked: boolean) => {
        setUseServiceForCustomer(checked);
        if (checked) {
            setNewShareholder(prev => ({
                ...prev,
                property: {
                    ...prev.property,
                    customerMailingAddress: prev.property.serviceAddress,
                    cityStateZip: prev.property.cityStateZip
                }
            }));
        }
    };
    
    const handleUseServiceForOwner = (checked: boolean) => {
        setUseServiceForOwner(checked);
        if (checked) {
            setNewShareholder(prev => ({
                ...prev,
                property: {
                    ...prev.property,
                    ownerMailingAddress: prev.property.serviceAddress,
                    ownerCityStateZip: prev.property.cityStateZip
                }
            }));
        }
    };
    
    const handleUseServiceForResident = (checked: boolean) => {
        setUseServiceForResident(checked);
        if (checked) {
            setNewShareholder(prev => ({
                ...prev,
                property: {
                    ...prev.property,
                    residentMailingAddress: prev.property.serviceAddress,
                    residentCityStateZip: prev.property.cityStateZip
                }
            }));
        }
    };
    
    // Add handlers to capitalize text input for other fields
    const handleNameChange = (value: string) => {
        setNewShareholder({
            ...newShareholder,
            name: value.toUpperCase(),
        });
    };
    
    const handleCustomerNameChange = (value: string) => {
        setNewShareholder({
            ...newShareholder,
            property: {
                ...newShareholder.property,
                customerName: value.toUpperCase(),
            },
        });
    };
    
    const handleOwnerNameChange = (value: string) => {
        setNewShareholder({
            ...newShareholder,
            property: {
                ...newShareholder.property,
                ownerName: value.toUpperCase(),
            },
        });
    };
    
    const handleResidentNameChange = (value: string) => {
        setNewShareholder({
            ...newShareholder,
            property: {
                ...newShareholder.property,
                residentName: value.toUpperCase(),
            },
        });
    };
    
    const handleCustomerMailingAddressChange = (value: string) => {
        setNewShareholder({
            ...newShareholder,
            property: {
                ...newShareholder.property,
                customerMailingAddress: value.toUpperCase(),
            },
        });
    };
    
    const handleOwnerMailingAddressChange = (value: string) => {
        setNewShareholder({
            ...newShareholder,
            property: {
                ...newShareholder.property,
                ownerMailingAddress: value.toUpperCase(),
            },
        });
    };
    
    const handleResidentMailingAddressChange = (value: string) => {
        setNewShareholder({
            ...newShareholder,
            property: {
                ...newShareholder.property,
                residentMailingAddress: value.toUpperCase(),
            },
        });
    };
    
    const handleOwnerCityStateZipChange = (value: string) => {
        setNewShareholder({
            ...newShareholder,
            property: {
                ...newShareholder.property,
                ownerCityStateZip: value.toUpperCase(),
            },
        });
    };
    
    const handleResidentCityStateZipChange = (value: string) => {
        setNewShareholder({
            ...newShareholder,
            property: {
                ...newShareholder.property,
                residentCityStateZip: value.toUpperCase(),
            },
        });
    };

    // Format property data right before sending to API
    const formatPropertyDataForSubmission = (shareholderId: string) => {
        // Format the account number
        let formattedAccount = newShareholder.property.account;
        if (!formattedAccount.includes('-')) {
            formattedAccount = formattedAccount.padStart(10, '0') + '-00';
        }
        
        // Format all fields and apply final formatting to city/state/zip fields
        return {
            // Required fields
            shareholderId,
            account: formattedAccount,
            
            // Customer information
            customerName: newShareholder.property.customerName.trim().toUpperCase(),
            customerMailingAddress: newShareholder.property.customerMailingAddress.trim().toUpperCase(),
            cityStateZip: formatCityStateZip(newShareholder.property.cityStateZip),
            
            // Owner information
            ownerName: newShareholder.property.ownerName.trim().toUpperCase(),
            ownerMailingAddress: newShareholder.property.ownerMailingAddress.trim().toUpperCase(),
            ownerCityStateZip: formatCityStateZip(newShareholder.property.ownerCityStateZip),
            
            // Resident information (optional)
            residentName: newShareholder.property.residentName.trim().toUpperCase(),
            residentMailingAddress: newShareholder.property.residentMailingAddress.trim().toUpperCase(),
            residentCityStateZip: formatCityStateZip(newShareholder.property.residentCityStateZip),
            
            // Property details
            serviceAddress: newShareholder.property.serviceAddress.trim().toUpperCase(),
            numOf: newShareholder.property.numOf.trim(),
            checkedIn: newShareholder.property.checkedIn
        };
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <p className="text-red-600 mb-4">{error}</p>
                    <Button onClick={fetchProperties}>Retry</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Dialog open={isAddingShareholder} onOpenChange={setIsAddingShareholder}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Shareholder
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Add New Shareholder</DialogTitle>
                            <DialogDescription>
                                Add a new shareholder with property information
                            </DialogDescription>
                        </DialogHeader>
                        
                        {/* Acquisition Type Selection */}
                        <div className="space-y-4">
                            <div>
                                <Label>Acquisition Type</Label>
                                <Select value={acquisitionType} onValueChange={(value: "new" | "existing") => setAcquisitionType(value)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="new">New Property</SelectItem>
                                        <SelectItem value="existing">Existing Property</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Shareholder Information */}
                            <div className="space-y-4">
                                <h3 className="font-semibold">Shareholder Information</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="name">Shareholder Name *</Label>
                                        <Input
                                            id="name"
                                            value={newShareholder.name}
                                            onChange={(e) => handleNameChange(e.target.value)}
                                            placeholder="Enter shareholder name"
                                            className={formErrors.name ? "border-red-500" : ""}
                                        />
                                        {formErrors.name && <p className="text-red-500 text-sm">{formErrors.name}</p>}
                                    </div>
                                    <div>
                                        <Label htmlFor="id">Shareholder ID</Label>
                                        <Input
                                            id="id"
                                            value={newShareholder.id}
                                            onChange={(e) => setNewShareholder({...newShareholder, id: e.target.value})}
                                            placeholder="Auto-generated if empty"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Property Information */}
                            <div className="space-y-4">
                                <h3 className="font-semibold">Property Information</h3>
                                
                                {acquisitionType === "new" ? (
                                    <div className="space-y-4">
                                        {/* Account and Service Address */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label htmlFor="account">Account Number *</Label>
                                                <Input
                                                    id="account"
                                                    value={newShareholder.property.account}
                                                    onChange={(e) => setNewShareholder({
                                                        ...newShareholder,
                                                        property: {
                                                            ...newShareholder.property,
                                                            account: e.target.value
                                                        }
                                                    })}
                                                    placeholder="XXXXXXXXXX-XX"
                                                    className={formErrors.account ? "border-red-500" : ""}
                                                />
                                                {formErrors.account && <p className="text-red-500 text-sm">{formErrors.account}</p>}
                                            </div>
                                            <div>
                                                <Label htmlFor="numOf">Number of</Label>
                                                <Input
                                                    id="numOf"
                                                    value={newShareholder.property.numOf}
                                                    onChange={(e) => setNewShareholder({
                                                        ...newShareholder,
                                                        property: {
                                                            ...newShareholder.property,
                                                            numOf: e.target.value
                                                        }
                                                    })}
                                                    placeholder="e.g., 1"
                                                />
                                            </div>
                                        </div>

                                        {/* Service Address */}
                                        <div>
                                            <Label htmlFor="serviceAddress">Service Address *</Label>
                                            <Input
                                                id="serviceAddress"
                                                value={newShareholder.property.serviceAddress}
                                                onChange={(e) => handleServiceAddressChange(e.target.value)}
                                                placeholder="Enter service address"
                                                className={formErrors.serviceAddress ? "border-red-500" : ""}
                                            />
                                            {formErrors.serviceAddress && <p className="text-red-500 text-sm">{formErrors.serviceAddress}</p>}
                                        </div>

                                        {/* Address Copy Options */}
                                        <div className="space-y-2">
                                            <Label>Copy Service Address To:</Label>
                                            <div className="flex gap-4">
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id="useServiceForCustomer"
                                                        checked={useServiceForCustomer}
                                                        onCheckedChange={handleUseServiceForCustomer}
                                                    />
                                                    <Label htmlFor="useServiceForCustomer">Customer</Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id="useServiceForOwner"
                                                        checked={useServiceForOwner}
                                                        onCheckedChange={handleUseServiceForOwner}
                                                    />
                                                    <Label htmlFor="useServiceForOwner">Owner</Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id="useServiceForResident"
                                                        checked={useServiceForResident}
                                                        onCheckedChange={handleUseServiceForResident}
                                                    />
                                                    <Label htmlFor="useServiceForResident">Resident</Label>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Customer Information */}
                                        <div className="space-y-4">
                                            <h4 className="font-medium">Customer Information</h4>
                                            <div className="grid grid-cols-1 gap-4">
                                                <div>
                                                    <Label htmlFor="customerName">Customer Name *</Label>
                                                    <Input
                                                        id="customerName"
                                                        value={newShareholder.property.customerName}
                                                        onChange={(e) => handleCustomerNameChange(e.target.value)}
                                                        placeholder="Enter customer name"
                                                        className={formErrors.customerName ? "border-red-500" : ""}
                                                    />
                                                    {formErrors.customerName && <p className="text-red-500 text-sm">{formErrors.customerName}</p>}
                                                </div>
                                                <div>
                                                    <Label htmlFor="customerMailingAddress">Customer Mailing Address *</Label>
                                                    <Input
                                                        id="customerMailingAddress"
                                                        value={newShareholder.property.customerMailingAddress}
                                                        onChange={(e) => handleCustomerMailingAddressChange(e.target.value)}
                                                        placeholder="Enter customer mailing address"
                                                        className={formErrors.customerMailingAddress ? "border-red-500" : ""}
                                                    />
                                                    {formErrors.customerMailingAddress && <p className="text-red-500 text-sm">{formErrors.customerMailingAddress}</p>}
                                                </div>
                                                <div>
                                                    <Label htmlFor="cityStateZip">City, State, Zip *</Label>
                                                    <Input
                                                        id="cityStateZip"
                                                        value={newShareholder.property.cityStateZip}
                                                        onChange={(e) => handleServiceCityStateZipChange(e.target.value)}
                                                        placeholder="CITY STATE ZIP"
                                                        className={formErrors.cityStateZip ? "border-red-500" : ""}
                                                    />
                                                    {formErrors.cityStateZip && <p className="text-red-500 text-sm">{formErrors.cityStateZip}</p>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Owner Information */}
                                        <div className="space-y-4">
                                            <h4 className="font-medium">Owner Information</h4>
                                            <div className="grid grid-cols-1 gap-4">
                                                <div>
                                                    <Label htmlFor="ownerName">Owner Name *</Label>
                                                    <Input
                                                        id="ownerName"
                                                        value={newShareholder.property.ownerName}
                                                        onChange={(e) => handleOwnerNameChange(e.target.value)}
                                                        placeholder="Enter owner name"
                                                        className={formErrors.ownerName ? "border-red-500" : ""}
                                                    />
                                                    {formErrors.ownerName && <p className="text-red-500 text-sm">{formErrors.ownerName}</p>}
                                                </div>
                                                <div>
                                                    <Label htmlFor="ownerMailingAddress">Owner Mailing Address *</Label>
                                                    <Input
                                                        id="ownerMailingAddress"
                                                        value={newShareholder.property.ownerMailingAddress}
                                                        onChange={(e) => handleOwnerMailingAddressChange(e.target.value)}
                                                        placeholder="Enter owner mailing address"
                                                        className={formErrors.ownerMailingAddress ? "border-red-500" : ""}
                                                    />
                                                    {formErrors.ownerMailingAddress && <p className="text-red-500 text-sm">{formErrors.ownerMailingAddress}</p>}
                                                </div>
                                                <div>
                                                    <Label htmlFor="ownerCityStateZip">Owner City, State, Zip *</Label>
                                                    <Input
                                                        id="ownerCityStateZip"
                                                        value={newShareholder.property.ownerCityStateZip}
                                                        onChange={(e) => handleOwnerCityStateZipChange(e.target.value)}
                                                        placeholder="CITY STATE ZIP"
                                                        className={formErrors.ownerCityStateZip ? "border-red-500" : ""}
                                                    />
                                                    {formErrors.ownerCityStateZip && <p className="text-red-500 text-sm">{formErrors.ownerCityStateZip}</p>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Resident Information (Optional) */}
                                        <div className="space-y-4">
                                            <h4 className="font-medium">Resident Information (Optional)</h4>
                                            <div className="grid grid-cols-1 gap-4">
                                                <div>
                                                    <Label htmlFor="residentName">Resident Name</Label>
                                                    <Input
                                                        id="residentName"
                                                        value={newShareholder.property.residentName}
                                                        onChange={(e) => handleResidentNameChange(e.target.value)}
                                                        placeholder="LASTNAME, FIRSTNAME"
                                                        className={formErrors.residentName ? "border-red-500" : ""}
                                                    />
                                                    {formErrors.residentName && <p className="text-red-500 text-sm">{formErrors.residentName}</p>}
                                                </div>
                                                <div>
                                                    <Label htmlFor="residentMailingAddress">Resident Mailing Address</Label>
                                                    <Input
                                                        id="residentMailingAddress"
                                                        value={newShareholder.property.residentMailingAddress}
                                                        onChange={(e) => handleResidentMailingAddressChange(e.target.value)}
                                                        placeholder="Enter resident mailing address"
                                                    />
                                                </div>
                                                <div>
                                                    <Label htmlFor="residentCityStateZip">Resident City, State, Zip</Label>
                                                    <Input
                                                        id="residentCityStateZip"
                                                        value={newShareholder.property.residentCityStateZip}
                                                        onChange={(e) => handleResidentCityStateZipChange(e.target.value)}
                                                        placeholder="CITY STATE ZIP"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <Label>Search Existing Properties</Label>
                                            <Input
                                                value={propertySearchQuery}
                                                onChange={(e) => setPropertySearchQuery(e.target.value)}
                                                placeholder="Search by account, address, or name..."
                                            />
                                        </div>
                                        <div className="max-h-60 overflow-y-auto border rounded-md p-2">
                                            {filteredPropertiesForDropdown.map((property) => (
                                                <div
                                                    key={property.id}
                                                    className={`p-2 cursor-pointer rounded hover:bg-gray-100 ${
                                                        selectedExistingProperty?.id === property.id ? 'bg-blue-100' : ''
                                                    }`}
                                                    onClick={() => setSelectedExistingProperty(property)}
                                                >
                                                    <div className="font-medium">{property.account}</div>
                                                    <div className="text-sm text-gray-600">{property.serviceAddress}</div>
                                                    <div className="text-sm text-gray-600">{property.ownerName}</div>
                                                </div>
                                            ))}
                                        </div>
                                        {selectedExistingProperty && (
                                            <div className="p-4 bg-gray-50 rounded-md">
                                                <h4 className="font-medium mb-2">Selected Property:</h4>
                                                <p><strong>Account:</strong> {selectedExistingProperty.account}</p>
                                                <p><strong>Service Address:</strong> {selectedExistingProperty.serviceAddress}</p>
                                                <p><strong>Owner:</strong> {selectedExistingProperty.ownerName}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => setIsAddingShareholder(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleAddShareholder}>
                                Add Shareholder
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Search and Filter */}
            <div className="flex gap-4">
                <div className="flex-1">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                            placeholder="Search account, addresses, names, shareholder ID…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>
                <Select value={filterStatus} onValueChange={(value: "all" | "checked" | "unchecked") => setFilterStatus(value)}>
                    <SelectTrigger className="w-48">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Properties</SelectItem>
                        <SelectItem value="checked">Checked In</SelectItem>
                        <SelectItem value="unchecked">Not Checked In</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Properties list */}
            <Card>
                <CardHeader>
                    <CardTitle>Properties ({filteredProperties.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <PropertyListCards
                        properties={filteredProperties}
                        meetingId={selectedMeeting?.id}
                        highlightedPropertyId={highlightedPropertyId}
                        onToggleCheckIn={handleToggleCheckIn}
                        onEdit={handleEdit}
                        onViewHistory={handleViewHistory}
                        onDelete={handleDelete}
                        onOwnerNameUpdate={(propertyId, newName) => {
                            setProperties(
                                properties.map((p) =>
                                    p.id === propertyId ? { ...p, ownerName: newName } : p,
                                ),
                            )
                        }}
                    />
                </CardContent>
            </Card>

            {/* Edit Property Dialog */}
            {isEditing && selectedProperty && editedProperty && (
                <Dialog open={isEditing} onOpenChange={setIsEditing}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Edit Property</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="edit-account">Account</Label>
                                    <Input
                                        id="edit-account"
                                        value={editedProperty.account || ""}
                                        onChange={(e) => setEditedProperty({
                                            ...editedProperty,
                                            account: e.target.value
                                        })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="edit-serviceAddress">Service Address</Label>
                                    <Input
                                        id="edit-serviceAddress"
                                        value={editedProperty.serviceAddress || ""}
                                        onChange={(e) => setEditedProperty({
                                            ...editedProperty,
                                            serviceAddress: e.target.value
                                        })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="edit-ownerName">Owner Name</Label>
                                    <Input
                                        id="edit-ownerName"
                                        value={editedProperty.ownerName || ""}
                                        onChange={(e) => setEditedProperty({
                                            ...editedProperty,
                                            ownerName: e.target.value
                                        })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="edit-customerName">Customer Name</Label>
                                    <Input
                                        id="edit-customerName"
                                        value={editedProperty.customerName || ""}
                                        onChange={(e) => setEditedProperty({
                                            ...editedProperty,
                                            customerName: e.target.value
                                        })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="edit-ownerMailingAddress">Owner Mailing Address</Label>
                                    <Input
                                        id="edit-ownerMailingAddress"
                                        value={editedProperty.ownerMailingAddress || ""}
                                        onChange={(e) => setEditedProperty({
                                            ...editedProperty,
                                            ownerMailingAddress: e.target.value
                                        })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="edit-customerMailingAddress">Customer Mailing Address</Label>
                                    <Input
                                        id="edit-customerMailingAddress"
                                        value={editedProperty.customerMailingAddress || ""}
                                        onChange={(e) => setEditedProperty({
                                            ...editedProperty,
                                            customerMailingAddress: e.target.value
                                        })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="edit-ownerCityStateZip">Owner City, State, Zip</Label>
                                    <Input
                                        id="edit-ownerCityStateZip"
                                        value={editedProperty.ownerCityStateZip || ""}
                                        onChange={(e) => setEditedProperty({
                                            ...editedProperty,
                                            ownerCityStateZip: e.target.value
                                        })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="edit-cityStateZip">Customer City, State, Zip</Label>
                                    <Input
                                        id="edit-cityStateZip"
                                        value={editedProperty.cityStateZip || ""}
                                        onChange={(e) => setEditedProperty({
                                            ...editedProperty,
                                            cityStateZip: e.target.value
                                        })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="edit-residentName">Resident Name</Label>
                                    <Input
                                        id="edit-residentName"
                                        value={editedProperty.residentName || ""}
                                        onChange={(e) => setEditedProperty({
                                            ...editedProperty,
                                            residentName: e.target.value
                                        })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="edit-residentMailingAddress">Resident Mailing Address</Label>
                                    <Input
                                        id="edit-residentMailingAddress"
                                        value={editedProperty.residentMailingAddress || ""}
                                        onChange={(e) => setEditedProperty({
                                            ...editedProperty,
                                            residentMailingAddress: e.target.value
                                        })}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="edit-residentCityStateZip">Resident City, State, Zip</Label>
                                <Input
                                    id="edit-residentCityStateZip"
                                    value={editedProperty.residentCityStateZip || ""}
                                    onChange={(e) => setEditedProperty({
                                        ...editedProperty,
                                        residentCityStateZip: e.target.value
                                    })}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => setIsEditing(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleSave}>
                                Save Changes
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Transfer Property Dialog */}
            <Dialog open={isTransferring} onOpenChange={setIsTransferring}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Transfer Property</DialogTitle>
                        <DialogDescription>
                            Select a new shareholder to transfer this property to.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Select onValueChange={(value) => handleTransferProperty(selectedProperty?.id || 0, value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select shareholder" />
                            </SelectTrigger>
                            <SelectContent>
                                {shareholders.map((shareholder) => (
                                    <SelectItem key={shareholder.shareholderId} value={shareholder.shareholderId}>
                                        {shareholder.name} (
                                        {displayShareholderId(
                                            shareholder.shareholderId,
                                            selectedMeeting?.id,
                                        )}
                                        )
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Transfer History Dialog */}
            <Dialog open={isViewingHistory} onOpenChange={setIsViewingHistory}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Transfer History</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {transferHistory.length === 0 ? (
                            <p className="text-muted-foreground">No transfer history found.</p>
                        ) : (
                            <div className="space-y-2">
                                {transferHistory.map((transfer) => (
                                    <div key={transfer.id} className="p-4 border rounded-lg">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-medium">
                                                    From: {transfer.fromShareholder.name}
                                                </p>
                                                <p className="font-medium">
                                                    To: {transfer.toShareholder.name}
                                                </p>
                                                {transfer.meetingId ? (
                                                    <p className="text-sm text-muted-foreground">
                                                        Meeting ID: {transfer.meetingId}
                                                    </p>
                                                ) : null}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {new Date(transfer.transferredAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}