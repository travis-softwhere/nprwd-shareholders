"use client"

import type React from "react"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import type { Shareholder } from "@/types/shareholder"
import { useMeeting } from "@/contexts/MeetingContext"
import { useSession } from "next-auth/react"
import { getShareholdersList } from "@/actions/getShareholdersList"
import { Search, Filter, ChevronRight, ChevronLeft, Users, ArrowUpDown, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface ShareholderListProps {
    initialShareholders?: Shareholder[]
    totalShareholders?: number
}

type SortField = "totalProperties" | "name" | "shareholderId"
type SortOrder = "asc" | "desc"

const ShareholderList: React.FC<ShareholderListProps> = ({
    initialShareholders = [],
    totalShareholders: initialTotal = 0,
}) => {
    const { data: session, status } = useSession()
    const router = useRouter()

    // Internal state management
    const [allShareholders, setAllShareholders] = useState<Shareholder[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(25)
    const [searchTerm, setSearchTerm] = useState("")
    const [sortField, setSortField] = useState<SortField>("shareholderId")
    const [sortOrder, setSortOrder] = useState<SortOrder>("asc")
    const [propertyFilter, setPropertyFilter] = useState<string>("all")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [isFilterOpen, setIsFilterOpen] = useState(false)

    // Fetch all shareholders on mount
    useEffect(() => {
        const fetchAllShareholders = async () => {
            setIsLoading(true)
            try {
                const res = await fetch("/api/shareholders")
                const data = await res.json()
                const processedShareholders = (data.shareholders || []).map((sh: any) => ({
                    ...sh,
                    totalProperties: sh.properties ? sh.properties.length : 0,
                    checkedInProperties: sh.properties
                        ? sh.properties.filter((p: any) => p.checkedIn).length
                        : 0,
                }))
                setAllShareholders(processedShareholders)
            } catch (error) {
                toast({
                    title: "Error",
                    description: "Failed to fetch shareholders data. Please try again.",
                    variant: "destructive",
                })
            } finally {
                setIsLoading(false)
            }
        }
        fetchAllShareholders()
    }, [])

    // Filter shareholders based on search and filters
    const filteredShareholders = useMemo(() => {
        if (!allShareholders.length) return [];

        return allShareholders
            .filter((shareholder) => {
                if (!shareholder) return false

                // If no search term, only apply property and status filters
                if (!searchTerm) {
                    return true;
                }

                const searchLower = searchTerm.toLowerCase();
                
                // Check shareholder fields
                const matchesShareholder = 
                    shareholder.name.toLowerCase().includes(searchLower) ||
                    shareholder.shareholderId.toLowerCase().includes(searchLower) ||
                    (shareholder.ownerMailingAddress?.toLowerCase().includes(searchLower) ?? false) ||
                    (shareholder.ownerCityStateZip?.toLowerCase().includes(searchLower) ?? false);

                // Check property fields
                const matchesProperty = shareholder.properties?.some((property: any) => 
                    property.account?.toLowerCase().includes(searchLower) ||
                    property.serviceAddress?.toLowerCase().includes(searchLower) ||
                    property.customerName?.toLowerCase().includes(searchLower) ||
                    property.ownerName?.toLowerCase().includes(searchLower) ||
                    property.customerMailingAddress?.toLowerCase().includes(searchLower) ||
                    property.cityStateZip?.toLowerCase().includes(searchLower) ||
                    property.ownerMailingAddress?.toLowerCase().includes(searchLower) ||
                    property.ownerCityStateZip?.toLowerCase().includes(searchLower) ||
                    property.residentName?.toLowerCase().includes(searchLower) ||
                    property.residentMailingAddress?.toLowerCase().includes(searchLower) ||
                    property.residentCityStateZip?.toLowerCase().includes(searchLower)
                ) ?? false;

                return matchesShareholder || matchesProperty;
            })
            .filter((shareholder) => {
                // Apply property count filter
                const matchesPropertyFilter =
                    propertyFilter === "all"
                        ? true
                        : propertyFilter === "1"
                            ? shareholder.totalProperties === 1
                            : propertyFilter === "2-5"
                                ? shareholder.totalProperties >= 2 && shareholder.totalProperties <= 5
                                : propertyFilter === "6+"
                                    ? shareholder.totalProperties >= 6
                                    : true;

                // Apply status filter
                const matchesStatusFilter =
                    statusFilter === "all"
                        ? true
                        : statusFilter === "checked-in"
                            ? shareholder.checkedInProperties === shareholder.totalProperties
                            : shareholder.checkedInProperties < shareholder.totalProperties;

                return matchesPropertyFilter && matchesStatusFilter;
            })
            .sort((a, b) => {
                let aValue: string | number = a[sortField]
                let bValue: string | number = b[sortField]

                if (sortField === "totalProperties") {
                    aValue = Number(aValue) || 0
                    bValue = Number(bValue) || 0
                } else {
                    aValue = String(aValue || "")
                    bValue = String(bValue || "")
                }

                return sortOrder === "asc"
                    ? aValue < bValue
                        ? -1
                        : aValue > bValue
                            ? 1
                            : 0
                    : aValue > bValue
                        ? -1
                        : aValue < bValue
                            ? 1
                            : 0
            });
    }, [allShareholders, searchTerm, sortField, sortOrder, propertyFilter, statusFilter]);

    const totalShareholders = filteredShareholders.length
    const totalPages = Math.ceil(totalShareholders / itemsPerPage)
    const paginatedShareholders = filteredShareholders.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    if (status === "loading") {
        return (
            <div className="flex items-center justify-center h-full py-12">
                <div className="text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-lg text-gray-600">Loading shareholders...</p>
                </div>
            </div>
        )
    }

    const handleRowClick = (shareholderId: string) => {
        router.push(`/shareholders/${shareholderId}`)
    }

    // Function to get status badge color
    const getStatusBadge = (checkedIn: number, total: number) => {
        const isFullyCheckedIn = checkedIn === total;
        const isPartiallyCheckedIn = checkedIn > 0 && checkedIn < total;
        
        if (isFullyCheckedIn) {
            return "bg-green-100 text-green-800";
        } else if (isPartiallyCheckedIn) {
            return "bg-amber-100 text-amber-800";
        } else {
            return "bg-gray-100 text-gray-800";
        }
    };

    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage)
    }

    const handleItemsPerPageChange = (newItemsPerPage: number) => {
        setItemsPerPage(newItemsPerPage)
        setCurrentPage(1) // Reset to first page when changing items per page
    }

    return (
        <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-md p-4 md:p-6 mb-20 md:mb-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Users className="h-6 w-6 text-blue-500" />
                    Benefit Unit Owner List
                </h2>
                {/*
                <div>
                    <span>Total Benefit Unit Owners: {allShareholders.length}</span>
                </div>
                */}
                <div className="relative flex w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Input
                            type="text"
                            placeholder="Search by name or ID"
                            className="w-full pl-10 pr-4 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                    {/* <Button 
                        variant="outline" 
                        className="ml-2 px-3" 
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                    >
                        <Filter className="h-4 w-4" />
                        <span className="sr-only md:not-sr-only md:ml-2">Filters</span>
                    </Button> */}
                </div>
            </div>
            
            {/* Filters - Toggleable on mobile */}
            <div className={`mb-6 ${isFilterOpen ? 'block' : 'hidden md:block'}`}>
                <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm font-medium text-gray-700 mb-2">Filters & Sorting</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs text-gray-600 mb-1">Sort By</label>
                            <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                value={`${sortField}-${sortOrder}`}
                                onChange={(e) => {
                                    const [field, order] = e.target.value.split("-")
                                    setSortField(field as SortField)
                                    setSortOrder(order as SortOrder)
                                }}
                            >
                                <option value="shareholderId-asc">ID (A-Z)</option>
                                <option value="shareholderId-desc">ID (Z-A)</option>
                                <option value="name-asc">Name (A-Z)</option>
                                <option value="name-desc">Name (Z-A)</option>
                                <option value="totalProperties-asc">Properties (Low to High)</option>
                                <option value="totalProperties-desc">Properties (High to Low)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-600 mb-1">Property Count</label>
                            <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                value={propertyFilter}
                                onChange={(e) => setPropertyFilter(e.target.value)}
                            >
                                <option value="all">All Properties</option>
                                <option value="1">Single Property</option>
                                <option value="2-5">2-5 Properties</option>
                                <option value="6+">6+ Properties</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-600 mb-1">Check-in Status</label>
                            <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="all">All Status</option>
                                <option value="checked-in">Fully Checked In</option>
                                <option value="not-checked-in">Partially/Not Checked In</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            
            {paginatedShareholders.length === 0 && !isLoading ? (
                <div className="text-center py-12 px-4 bg-gray-50 rounded-lg border border-gray-200">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">No shareholders found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                        Try adjusting your search or filter criteria
                    </p>
                </div>
            ) : (
                <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Benefit Unit Owner Barcode ID
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Owner Address
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Total Properties
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {isLoading ? (
                                    // Loading skeleton for table rows
                                    Array(5).fill(0).map((_, index) => (
                                        <tr key={`loading-${index}`}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Skeleton className="h-4 w-32" />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="space-y-2">
                                                    <Skeleton className="h-4 w-40" />
                                                    <Progress value={45} className="h-1 bg-gray-100" />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Skeleton className="h-4 w-8" />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Skeleton className="h-6 w-24 rounded-full" />
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    paginatedShareholders.map((shareholder) => (
                                        <tr
                                            key={shareholder.shareholderId}
                                            className={cn(
                                                "hover:bg-blue-50 cursor-pointer transition-colors duration-150",
                                                shareholder.isNew && "bg-yellow-50 hover:bg-yellow-100"
                                            )}
                                            onClick={() => handleRowClick(shareholder.shareholderId)}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">{shareholder.shareholderId}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{shareholder.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">{shareholder.ownerMailingAddress + ", " + shareholder.ownerCityStateZip}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">{shareholder.totalProperties}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(shareholder.checkedInProperties, shareholder.totalProperties)}`}>
                                                    {shareholder.checkedInProperties} / {shareholder.totalProperties} Checked In
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View - Improved */}
                    <div className="md:hidden space-y-3">
                        {isLoading ? (
                            // Loading skeleton for mobile cards
                            Array(4).fill(0).map((_, index) => (
                                <Card 
                                    key={`loading-mobile-${index}`}
                                    className="overflow-hidden border-l-4 border-l-gray-200"
                                >
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="w-5/6 space-y-2">
                                                <Skeleton className="h-5 w-40" />
                                                <Skeleton className="h-4 w-32" />
                                                <Progress value={45} className="h-1 bg-gray-100" />
                                            </div>
                                            <div className="bg-gray-100 rounded-full p-1">
                                                <ChevronRight className="h-5 w-5 text-gray-300" />
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                                            <Skeleton className="h-4 w-24" />
                                            <Skeleton className="h-6 w-16 rounded-full" />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        ) : (
                            paginatedShareholders.map((shareholder) => (
                                <Card 
                                    key={shareholder.shareholderId}
                                    className={cn(
                                        "overflow-hidden hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500",
                                        shareholder.isNew && "bg-yellow-50 border-l-yellow-400 hover:bg-yellow-100"
                                    )}
                                    onClick={() => handleRowClick(shareholder.shareholderId)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="w-5/6">
                                                <h3 className="font-semibold text-gray-900 text-base truncate">{shareholder.name}</h3>
                                                <p className="text-sm text-gray-500 mt-0.5">Barcode ID: {shareholder.shareholderId}</p>
                                            </div>
                                            <div className="bg-gray-100 rounded-full p-1">
                                                <ChevronRight className="h-5 w-5 text-blue-500" />
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                                            <div className="flex items-center gap-1 text-sm text-gray-600">
                                                <Users className="h-4 w-4 text-gray-500" />
                                                <span>
                                                    {shareholder.totalProperties} {shareholder.totalProperties === 1 ? 'property' : 'properties'}
                                                </span>
                                            </div>
                                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusBadge(shareholder.checkedInProperties, shareholder.totalProperties)}`}>
                                                {shareholder.checkedInProperties}/{shareholder.totalProperties}
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </>
            )}

            {/* Pagination Controls */}
            <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-start">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1 || isLoading}
                        className="gap-1"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages || isLoading}
                        className="gap-1"
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <span className="text-sm text-gray-600">
                        Page {currentPage} of {totalPages}
                    </span>
                    <select
                        value={itemsPerPage}
                        onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                        disabled={isLoading}
                    >
                        <option value="10">10 per page</option>
                        <option value="25">25 per page</option>
                        <option value="50">50 per page</option>
                        <option value="100">100 per page</option>
                    </select>
                </div>
            </div>
            
            {/* Mobile spacing for bottom nav */}
            <div className="h-16 md:hidden"></div>
        </div>
    )
}

export default ShareholderList