"use client"

import type React from "react"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Shareholder } from "@/types/shareholder"
import { useMeeting } from "@/contexts/MeetingContext"
import { useSession } from "next-auth/react"
import { getShareholdersList } from "@/actions/getShareholdersList"
import {
    Search,
    Filter,
    ChevronRight,
    ChevronLeft,
    Users,
    ArrowUpDown,
    Loader2,
    Pencil,
    Trash2,
    ExternalLink,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
} from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/use-toast"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
    ADMIN_MEETING_FILTER_ALL,
    formatMeetingLabel,
    resolveMeetingFromShareholderMeetingId,
    shareholderMatchesMeetingFilter,
} from "@/lib/meetingDisplay"
import { displayShareholderId } from "@/lib/meetingScopedShareholderId"
import { shareholderRecordMatchesSearch } from "@/lib/shareholderSearch"

interface ShareholderListProps {
    initialShareholders?: Shareholder[]
    totalShareholders?: number
    /** Admin only: load every shareholder row (all meetings), via `?listAll=true` */
    listAllShareholders?: boolean
    /**
     * When set (e.g. admin meeting filter), load this meeting’s shareholders instead of the
     * globally active meeting. Ignored when `listAllShareholders` is true.
     */
    meetingIdForQuery?: string
    /** Show a Meeting column (annual meeting label; also when `listAllShareholders`) */
    showMeetingColumn?: boolean
    /** Admin: Meeting dropdown (list-all: “All meetings” + optional narrow; otherwise sets app-wide active meeting) */
    adminMeetingToolbar?: {
        value: string
        onChange: (meetingId: string) => void
        listAll: boolean
    }
    /** Admin tab: row edit/delete, no row navigation to detail */
    adminManageShareholders?: boolean
    /** Increment to refetch list after admin mutations */
    refreshTrigger?: number
    onAdminMutation?: () => void
}

type SortField = "totalProperties" | "name" | "shareholderId"
type SortOrder = "asc" | "desc"

const ShareholderList: React.FC<ShareholderListProps> = ({
    initialShareholders = [],
    totalShareholders: initialTotal = 0,
    listAllShareholders = false,
    meetingIdForQuery,
    showMeetingColumn = false,
    adminMeetingToolbar,
    adminManageShareholders = false,
    refreshTrigger = 0,
    onAdminMutation,
}) => {
    const { data: session, status } = useSession()
    const router = useRouter()
    const { selectedMeeting, meetings } = useMeeting()

    const showMeetingCol = showMeetingColumn || listAllShareholders

    const meetingLabel = (meetingId?: string | null) => {
        if (meetingId == null || meetingId === "") return "—"
        const m = resolveMeetingFromShareholderMeetingId(meetingId, meetings)
        if (!m) {
            const s = String(meetingId).trim()
            if (/^\d{4}$/.test(s) && meetings.filter((x) => x.year === parseInt(s, 10)).length > 1) {
                return `Legacy year ${s} — multiple meetings this year; update meeting_id to the numeric DB id`
            }
            return `Unknown meeting (${meetingId})`
        }
        return formatMeetingLabel(m)
    }

    const canonicalMeetingIdLine = (meetingId?: string | null) => {
        const m = resolveMeetingFromShareholderMeetingId(meetingId, meetings)
        if (m) return `ID ${m.id}`
        const s = meetingId != null ? String(meetingId).trim() : ""
        if (s && /^\d{4}$/.test(s) && meetings.filter((x) => x.year === parseInt(s, 10)).length > 1) {
            return `Raw ${s} (ambiguous)`
        }
        return s !== "" ? `Raw ${s}` : "—"
    }

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
    const [editTarget, setEditTarget] = useState<Shareholder | null>(null)
    const [editName, setEditName] = useState("")
    const [editOwnerMailing, setEditOwnerMailing] = useState("")
    const [editOwnerCityState, setEditOwnerCityState] = useState("")
    const [editSaving, setEditSaving] = useState(false)
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [refetchTick, setRefetchTick] = useState(0)

    // Fetch shareholders: list-all, explicit meeting id (admin), or global active meeting
    useEffect(() => {
        const fetchAllShareholders = async () => {
            let url: string
            if (listAllShareholders) {
                url = "/api/shareholders?listAll=true"
            } else {
                const mid = meetingIdForQuery ?? selectedMeeting?.id
                if (!mid) {
                    setAllShareholders([])
                    setIsLoading(false)
                    return
                }
                url = `/api/shareholders?meetingId=${encodeURIComponent(mid)}`
            }

            setIsLoading(true)
            try {
                const res = await fetch(url)
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
                    description: "Failed to fetch benefit unit owner data. Please try again.",
                    variant: "destructive",
                })
            } finally {
                setIsLoading(false)
            }
        }
        fetchAllShareholders()
    }, [selectedMeeting?.id, listAllShareholders, meetingIdForQuery, refreshTrigger, refetchTick])

    useEffect(() => {
        setCurrentPage(1)
    }, [adminMeetingToolbar?.value, listAllShareholders])

    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, propertyFilter, statusFilter])

    const fireMutation = () => {
        setRefetchTick((t) => t + 1)
        onAdminMutation?.()
    }

    const openEdit = (sh: Shareholder, e?: React.MouseEvent) => {
        e?.stopPropagation()
        setEditTarget(sh)
        setEditName(sh.name || "")
        setEditOwnerMailing(sh.ownerMailingAddress || "")
        setEditOwnerCityState(sh.ownerCityStateZip || "")
    }

    const saveEdit = async () => {
        if (!editTarget) return
        setEditSaving(true)
        try {
            const res = await fetch(`/api/shareholders/${encodeURIComponent(editTarget.shareholderId)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editName,
                    ownerMailingAddress: editOwnerMailing,
                    ownerCityStateZip: editOwnerCityState,
                }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || "Update failed")
            }
            toast({ title: "Saved", description: "Benefit unit owner updated." })
            setEditTarget(null)
            fireMutation()
        } catch (err) {
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Could not save",
                variant: "destructive",
            })
        } finally {
            setEditSaving(false)
        }
    }

    const confirmDelete = async () => {
        if (!deleteTargetId) return
        setDeleteLoading(true)
        try {
            const res = await fetch(`/api/shareholders/${encodeURIComponent(deleteTargetId)}`, {
                method: "DELETE",
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || "Delete failed")
            }
            toast({ title: "Deleted", description: "Benefit unit owner and their properties were removed." })
            setDeleteTargetId(null)
            fireMutation()
        } catch (err) {
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Could not delete",
                variant: "destructive",
            })
        } finally {
            setDeleteLoading(false)
        }
    }

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

                const barcodeId = displayShareholderId(shareholder.shareholderId, shareholder.meetingId)
                const propertyRows = shareholder.properties ?? []
                const alternateNames = propertyRows.flatMap((property: {
                    ownerName?: string
                    customerName?: string
                    residentName?: string
                }) => [property.ownerName, property.customerName, property.residentName])
                const propertyTexts = propertyRows.flatMap((property: {
                    account?: string
                    serviceAddress?: string
                    customerName?: string
                    ownerName?: string
                    customerMailingAddress?: string
                    cityStateZip?: string
                    ownerMailingAddress?: string
                    ownerCityStateZip?: string
                    residentName?: string
                    residentMailingAddress?: string
                    residentCityStateZip?: string
                }) => [
                    property.account,
                    property.serviceAddress,
                    property.customerName,
                    property.ownerName,
                    property.customerMailingAddress,
                    property.cityStateZip,
                    property.ownerMailingAddress,
                    property.ownerCityStateZip,
                    property.residentName,
                    property.residentMailingAddress,
                    property.residentCityStateZip,
                ])

                return shareholderRecordMatchesSearch(
                    {
                        name: shareholder.name,
                        alternateNames,
                        shareholderId: shareholder.shareholderId,
                        barcodeId,
                        sharedId: shareholder.sharedId,
                        ownerMailingAddress: shareholder.ownerMailingAddress,
                        ownerCityStateZip: shareholder.ownerCityStateZip,
                        propertyTexts,
                    },
                    searchTerm,
                )
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
            .filter((shareholder) => {
                if (!adminMeetingToolbar?.listAll) return true
                if (adminMeetingToolbar.value === ADMIN_MEETING_FILTER_ALL) return true
                return shareholderMatchesMeetingFilter(
                    shareholder.meetingId,
                    adminMeetingToolbar.value,
                    meetings,
                )
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
    }, [
        allShareholders,
        searchTerm,
        sortField,
        sortOrder,
        propertyFilter,
        statusFilter,
        adminMeetingToolbar,
        meetings,
    ]);

    const adminMeetingScopeLine = useMemo(() => {
        if (!adminMeetingToolbar || meetings.length === 0) return null
        const { value, listAll } = adminMeetingToolbar
        const meetingFromValue = meetings.find((x) => String(x.id) === String(value))
        if (listAll) {
            if (value === ADMIN_MEETING_FILTER_ALL) {
                return "All meetings in the database — use Meeting to narrow this table to one meeting."
            }
            return meetingFromValue ? `Narrowed to ${formatMeetingLabel(meetingFromValue)}.` : null
        }
        return meetingFromValue
            ? `Active meeting for the app: ${formatMeetingLabel(meetingFromValue)}. Change it below or on the Meetings tab.`
            : null
    }, [adminMeetingToolbar, meetings])

    const totalShareholders = filteredShareholders.length
    const totalPages = Math.ceil(totalShareholders / itemsPerPage)
    const paginatedShareholders = filteredShareholders.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    const loadedPropertyVotes = useMemo(
        () => allShareholders.reduce((sum, sh) => sum + (Number(sh.totalProperties) || 0), 0),
        [allShareholders],
    )
    const filteredPropertyVotes = useMemo(
        () => filteredShareholders.reduce((sum, sh) => sum + (Number(sh.totalProperties) || 0), 0),
        [filteredShareholders],
    )
    const totalsNarrowedByFilters =
        filteredShareholders.length !== allShareholders.length || filteredPropertyVotes !== loadedPropertyVotes

    if (status === "loading") {
        return (
            <div className="flex items-center justify-center h-full py-12">
                <div className="text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-lg text-gray-600">Loading benefit unit owners...</p>
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

    const showAdminMeetingFilter = Boolean(adminMeetingToolbar && meetings.length > 0)

    return (
        <div
            className={cn(
                "w-full bg-white rounded-lg shadow-md p-4 md:p-6 mb-20 md:mb-6",
                adminManageShareholders ? "max-w-none" : "max-w-7xl mx-auto",
            )}
        >
            {!listAllShareholders && !meetingIdForQuery && !selectedMeeting && (
                <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                    Select the active annual meeting (admin or meeting picker) to load benefit unit owners and check-in
                    status for that meeting.
                </div>
            )}
            {listAllShareholders && (
                <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
                    Showing every benefit unit owner in the database (all meetings). The home dashboard still filters by
                    the active meeting.
                </div>
            )}
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
                            placeholder="Search name, ID, or address"
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
                    <div className="text-sm font-medium text-gray-700 mb-1">Filters & Sorting</div>
                    {adminMeetingScopeLine && (
                        <p className="text-xs text-muted-foreground mb-3 leading-snug">{adminMeetingScopeLine}</p>
                    )}
                    <div
                        className={cn(
                            "grid grid-cols-1 sm:grid-cols-2 gap-4",
                            showAdminMeetingFilter ? "lg:grid-cols-4" : "lg:grid-cols-3",
                        )}
                    >
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
                        {showAdminMeetingFilter && adminMeetingToolbar && (
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Meeting</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                    value={adminMeetingToolbar.value}
                                    onChange={(e) => adminMeetingToolbar.onChange(e.target.value)}
                                >
                                    {adminMeetingToolbar.listAll && (
                                        <option value={ADMIN_MEETING_FILTER_ALL}>All meetings</option>
                                    )}
                                    {meetings.map((m) => (
                                        <option key={m.id} value={String(m.id)}>
                                            {formatMeetingLabel(m)} — ID {m.id}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
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
                    <h3 className="text-lg font-medium text-gray-900">No benefit unit owners found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                        Try adjusting your search or filter criteria
                    </p>
                </div>
            ) : (
                <>
                    {/* Desktop Table View */}
                    <div
                        className={cn(
                            "hidden md:block rounded-lg border border-gray-200",
                            adminManageShareholders ? "w-full overflow-hidden" : "overflow-x-auto",
                        )}
                    >
                        <table className="w-full table-fixed divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    {showMeetingCol && (
                                        <th className="w-[12%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Meeting
                                        </th>
                                    )}
                                    <th
                                        className={cn(
                                            "px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                            showMeetingCol ? "w-[14%]" : "w-[16%]",
                                        )}
                                    >
                                        Benefit Unit Owner Barcode ID
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Owner Address
                                    </th>
                                    <th className="w-[8%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Total Properties
                                    </th>
                                    <th className="w-[14%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    {adminManageShareholders && (
                                        <th className="w-[9rem] px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {isLoading ? (
                                    // Loading skeleton for table rows
                                    Array(5).fill(0).map((_, index) => (
                                        <tr key={`loading-${index}`}>
                                            {showMeetingCol && (
                                                <td className="px-3 py-4 align-top">
                                                    <Skeleton className="h-4 w-40" />
                                                </td>
                                            )}
                                            <td className="px-3 py-4 align-top whitespace-nowrap">
                                                <Skeleton className="h-4 w-32" />
                                            </td>
                                            <td className="px-3 py-4 align-top">
                                                <div className="space-y-2">
                                                    <Skeleton className="h-4 w-40" />
                                                    <Progress value={45} className="h-1 bg-gray-100" />
                                                </div>
                                            </td>
                                            <td className="px-3 py-4 align-top">
                                                <Skeleton className="h-4 w-full max-w-[12rem]" />
                                            </td>
                                            <td className="px-3 py-4 align-top whitespace-nowrap">
                                                <Skeleton className="h-4 w-8" />
                                            </td>
                                            <td className="px-3 py-4 align-top whitespace-nowrap">
                                                <Skeleton className="h-6 w-24 rounded-full" />
                                            </td>
                                            {adminManageShareholders && (
                                                <td className="px-2 py-4 align-top">
                                                    <Skeleton className="h-8 w-28 ml-auto" />
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                ) : (
                                    paginatedShareholders.map((shareholder) => (
                                        <tr
                                            key={shareholder.shareholderId}
                                            className={cn(
                                                "transition-colors duration-150",
                                                adminManageShareholders
                                                    ? "hover:bg-muted/50"
                                                    : "hover:bg-blue-50 cursor-pointer",
                                                shareholder.isNew && "bg-yellow-50 hover:bg-yellow-100"
                                            )}
                                            onClick={() =>
                                                !adminManageShareholders && handleRowClick(shareholder.shareholderId)
                                            }
                                        >
                                            {showMeetingCol && (
                                                <td className="px-3 py-4 text-sm text-muted-foreground align-top">
                                                    <div className="font-medium text-foreground leading-snug break-words">
                                                        {meetingLabel(shareholder.meetingId)}
                                                    </div>
                                                    <div className="text-xs font-mono mt-0.5">{canonicalMeetingIdLine(shareholder.meetingId)}</div>
                                                </td>
                                            )}
                                            <td className="px-3 py-4 text-sm align-top whitespace-nowrap font-mono">
                                                {displayShareholderId(shareholder.shareholderId, shareholder.meetingId)}
                                            </td>
                                            <td className="px-3 py-4 text-sm font-medium align-top break-words whitespace-normal">
                                                {shareholder.name}
                                            </td>
                                            <td className="px-3 py-4 text-sm align-top break-words whitespace-normal text-gray-800">
                                                {[shareholder.ownerMailingAddress, shareholder.ownerCityStateZip]
                                                    .filter(Boolean)
                                                    .join(", ") || "—"}
                                            </td>
                                            <td className="px-3 py-4 text-sm align-top whitespace-nowrap">{shareholder.totalProperties}</td>
                                            <td className="px-3 py-4 align-top">
                                                <span
                                                    className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(shareholder.checkedInProperties, shareholder.totalProperties)}`}
                                                >
                                                    {shareholder.checkedInProperties} / {shareholder.totalProperties} Checked In
                                                </span>
                                            </td>
                                            {adminManageShareholders && (
                                                <td className="px-2 py-4 align-top text-right">
                                                    <div className="flex justify-end gap-0.5 flex-wrap">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 shrink-0"
                                                            asChild
                                                        >
                                                            <Link
                                                                href={`/shareholders/${encodeURIComponent(shareholder.shareholderId)}`}
                                                                aria-label={`Open detail page for ${shareholder.name}`}
                                                                title="Open shareholder page"
                                                            >
                                                                <ExternalLink className="h-4 w-4" />
                                                            </Link>
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 shrink-0"
                                                            aria-label={`Edit ${shareholder.name}`}
                                                            onClick={(e) => openEdit(shareholder, e)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            aria-label={`Delete ${shareholder.name}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setDeleteTargetId(shareholder.shareholderId)
                                                            }}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            )}
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
                                        "overflow-hidden transition-shadow border-l-4 border-l-blue-500",
                                        adminManageShareholders ? "" : "hover:shadow-md cursor-pointer",
                                        shareholder.isNew && "bg-yellow-50 border-l-yellow-400 hover:bg-yellow-100"
                                    )}
                                    onClick={() =>
                                        !adminManageShareholders && handleRowClick(shareholder.shareholderId)
                                    }
                                >
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="w-5/6">
                                                <h3 className="font-semibold text-gray-900 text-base truncate">{shareholder.name}</h3>
                                                <p className="text-sm text-gray-500 mt-0.5 font-mono">
                                                    Barcode ID:{" "}
                                                    {displayShareholderId(shareholder.shareholderId, shareholder.meetingId)}
                                                </p>
                                                {showMeetingCol && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {meetingLabel(shareholder.meetingId)}
                                                        <span className="font-mono"> · {canonicalMeetingIdLine(shareholder.meetingId)}</span>
                                                    </p>
                                                )}
                                            </div>
                                            {adminManageShareholders ? (
                                                <div className="flex gap-1 shrink-0">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        asChild
                                                    >
                                                        <Link
                                                            href={`/shareholders/${encodeURIComponent(shareholder.shareholderId)}`}
                                                            aria-label={`Open detail page for ${shareholder.name}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <ExternalLink className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            openEdit(shareholder, e)
                                                        }}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-red-600"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setDeleteTargetId(shareholder.shareholderId)
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="bg-gray-100 rounded-full p-1">
                                                    <ChevronRight className="h-5 w-5 text-blue-500" />
                                                </div>
                                            )}
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

            <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit benefit unit owner</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="edit-barcode">Barcode ID</Label>
                            <Input
                                id="edit-barcode"
                                value={
                                    editTarget
                                        ? displayShareholderId(editTarget.shareholderId, editTarget.meetingId)
                                        : ""
                                }
                                disabled
                                readOnly
                                className="font-mono"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Name</Label>
                            <Input
                                id="edit-name"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                autoComplete="off"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-mail">Owner mailing address</Label>
                            <Input
                                id="edit-mail"
                                value={editOwnerMailing}
                                onChange={(e) => setEditOwnerMailing(e.target.value)}
                                autoComplete="off"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-csz">Owner city, state ZIP</Label>
                            <Input
                                id="edit-csz"
                                value={editOwnerCityState}
                                onChange={(e) => setEditOwnerCityState(e.target.value)}
                                autoComplete="off"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={() => void saveEdit()} disabled={editSaving}>
                            {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteTargetId !== null} onOpenChange={(o) => !o && setDeleteTargetId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this benefit unit owner?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This removes the shareholder record and <strong>all properties</strong> linked to barcode{" "}
                            <span className="font-mono">{deleteTargetId}</span>. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            disabled={deleteLoading}
                            onClick={(e) => {
                                e.preventDefault()
                                void confirmDelete()
                            }}
                        >
                            {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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

            {!isLoading && (
                <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                    <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-6 sm:gap-y-1">
                        <p className="text-gray-900">
                            <span className="font-semibold tabular-nums">{allShareholders.length}</span>
                            <span className="mx-1">benefit unit owner{allShareholders.length === 1 ? "" : "s"}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="mx-1 font-semibold tabular-nums">{loadedPropertyVotes}</span>
                            <span className="text-gray-800">
                                total propert{loadedPropertyVotes === 1 ? "y" : "ies"} (votes)
                            </span>
                        </p>
                        {totalsNarrowedByFilters && (
                            <p className="text-muted-foreground">
                                Filtered list:{" "}
                                <span className="font-medium tabular-nums text-foreground">
                                    {filteredShareholders.length}
                                </span>{" "}
                                owner{filteredShareholders.length === 1 ? "" : "s"} ·{" "}
                                <span className="font-medium tabular-nums text-foreground">
                                    {filteredPropertyVotes}
                                </span>{" "}
                                propert{filteredPropertyVotes === 1 ? "y" : "ies"}
                            </p>
                        )}
                    </div>
                </div>
            )}
            
            {/* Mobile spacing for bottom nav */}
            <div className="h-16 md:hidden"></div>
        </div>
    )
}

export default ShareholderList