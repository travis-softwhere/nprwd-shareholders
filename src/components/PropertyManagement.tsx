"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Property } from "@/types/Property"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { Loader2, Search, Building2, Plus, Filter, Home, UserPlus, ArrowRightLeft, History, FileQuestion } from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
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
import { getShareholdersList } from "@/actions/getShareholdersList"
import { useToast } from "@/components/ui/use-toast"

interface TransferHistory {
    id: number;
    fromShareholder: {
        id: number;
        name: string;
    };
    toShareholder: {
        id: number;
        name: string;
    };
    transferredAt: string;
    transferredBy: {
        id: number;
        name: string;
    };
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
    const { toast } = useToast()
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

    useEffect(() => {
        fetchProperties()
        fetchShareholders()
    }, [])

    const fetchShareholders = async () => {
        try {
            const { shareholders: shareholdersData } = await getShareholdersList(1, 1000); // Fetch all shareholders
            setShareholders(shareholdersData);
        } catch (error) {
            console.error('Error fetching shareholders:', error);
            toast({
                title: "Error",
                description: "Failed to load shareholders",
                variant: "destructive",
            });
        }
    };

    const fetchProperties = async () => {
        try {
            setIsLoading(true);
            const response = await fetch("/api/properties?limit=100") // Fetch more properties at once
            if (!response.ok) {
                throw new Error("Failed to fetch properties")
            }
            const data = await response.json()
            setProperties(data.properties)
        } catch (error) {
            console.error("Error fetching properties:", error)
            toast({
                title: "Error",
                description: "Failed to load properties",
                variant: "destructive",
            });
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

    const formatPropertyData = (property: Partial<Property> & { shareholderId: string }) => {
        // Format account properly
        let formattedAccount = property.account || '';
        if (formattedAccount && !formattedAccount.includes('-')) {
            formattedAccount = formattedAccount.padStart(10, '0') + '-00';
        }
        
        // Ensure all text fields are properly trimmed and formatted
        return {
            account: formattedAccount,
            shareholderId: property.shareholderId,
            numOf: property.numOf?.trim() || '',
            customerName: property.customerName?.trim().toUpperCase() || '',
            customerMailingAddress: property.customerMailingAddress?.trim() || '',
            cityStateZip: property.cityStateZip?.trim() || '',
            ownerName: property.ownerName?.trim().toUpperCase() || '',
            ownerMailingAddress: property.ownerMailingAddress?.trim() || '',
            ownerCityStateZip: property.ownerCityStateZip?.trim() || '',
            residentName: property.residentName?.trim().toUpperCase() || '',
            residentMailingAddress: property.residentMailingAddress?.trim() || '',
            residentCityStateZip: property.residentCityStateZip?.trim() || '',
            serviceAddress: property.serviceAddress?.trim() || '',
            checkedIn: !!property.checkedIn,
            // Include ID if it exists (for updates)
            ...(property.id ? { id: property.id } : {})
        };
    };

    const handleSave = async () => {
        if (!editedProperty || !selectedProperty) return

        try {
            // Format all property data
            const propertyData = formatPropertyData({
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
            console.error("Error updating property:", error)
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
            console.error("Error deleting property:", error);
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

    const generateRandomId = (): string => {
        // Generate a 6-digit random ID between 100000 and 999999
        return Math.floor(Math.random() * (999999 - 100000 + 1) + 100000).toString();
    };

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
        
        try {
            // Create shareholder with generated ID if not provided
            const shareholderId = newShareholder.id || generateRandomId();
            
            // Format all data for API submission
            const propertyData = formatPropertyDataForSubmission();
            
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
            console.error("Error adding shareholder:", error);
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
            console.error("Error transferring property:", error);
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
            console.error("Error fetching transfer history:", error);
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
            const updatedProperty = formatPropertyData({
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
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to update check-in status");
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
            console.error("Error toggling check-in status:", error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to update check-in status",
                variant: "destructive",
            });
        }
    };

    const filteredProperties = properties.filter(property => {
        const matchesSearch = 
            property.account.toLowerCase().includes(searchQuery.toLowerCase()) ||
            property.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            property.ownerName.toLowerCase().includes(searchQuery.toLowerCase())
        
        const matchesFilter = 
            filterStatus === "all" ||
            (filterStatus === "checked" && property.checkedIn) ||
            (filterStatus === "unchecked" && !property.checkedIn)
        
        return matchesSearch && matchesFilter
    })

    // Filter properties for the dropdown
    const filteredPropertiesForDropdown = properties.filter(property => {
        const searchLower = propertySearchQuery.toLowerCase()
        return (
            property.account.toLowerCase().includes(searchLower) ||
            property.serviceAddress.toLowerCase().includes(searchLower) ||
            property.ownerName.toLowerCase().includes(searchLower) ||
            property.customerName.toLowerCase().includes(searchLower)
        )
    })

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
    const formatPropertyDataForSubmission = () => {
        // Format the account number
        let formattedAccount = newShareholder.property.account;
        if (!formattedAccount.includes('-')) {
            formattedAccount = formattedAccount.padStart(10, '0') + '-00';
        }
        
        // Format all fields and apply final formatting to city/state/zip fields
        return {
            // Required fields
            shareholderId: newShareholder.id || generateRandomId(),
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
}