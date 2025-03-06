"use client"

import type React from "react"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import type { Shareholder } from "@/types/shareholder"
import { useMeeting } from "@/contexts/MeetingContext"
import { useSession } from "next-auth/react"
import { getShareholdersList } from "@/actions/getShareholdersList"

interface ShareholderListProps {
    initialShareholders: Shareholder[]
    totalShareholders: number
    currentPage: number
    itemsPerPage: number
}

type SortField = "totalProperties" | "name" | "shareholderId"
type SortOrder = "asc" | "desc"

const ShareholderList: React.FC<ShareholderListProps> = ({
    initialShareholders,
    totalShareholders,
    currentPage = 1,
    itemsPerPage = 25,
}) => {
    const { data: session, status } = useSession()
    const router = useRouter()


    const [shareholders, setShareholders] = useState<Shareholder[]>(initialShareholders)
    const [searchTerm, setSearchTerm] = useState("")
    const [sortField, setSortField] = useState<SortField>("shareholderId")
    const [sortOrder, setSortOrder] = useState<SortOrder>("asc")
    const [barcodeInput, setBarcodeInput] = useState("")
    const [propertyFilter, setPropertyFilter] = useState<string>("all")
    const [statusFilter, setStatusFilter] = useState<string>("all")

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin")
        }
    }, [status, router])

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { shareholders: newShareholders } = await getShareholdersList(currentPage, itemsPerPage)
                setShareholders(newShareholders)
            } catch (error) {
                console.error("Failed to fetch shareholders:", error)
            }
        }

        fetchData()
    }, [currentPage, itemsPerPage])

    const filteredAndSortedShareholders = useMemo(() => {
        return shareholders
            .filter((shareholder) => {
                if (!shareholder) return false

                const matchesSearch =
                    shareholder.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    shareholder.shareholderId.toLowerCase().includes(searchTerm.toLowerCase())

                const matchesPropertyFilter =
                    propertyFilter === "all"
                        ? true
                        : propertyFilter === "1"
                            ? shareholder.totalProperties === 1
                            : propertyFilter === "2-5"
                                ? shareholder.totalProperties >= 2 && shareholder.totalProperties <= 5
                                : propertyFilter === "6+"
                                    ? shareholder.totalProperties >= 6
                                    : true

                const matchesStatusFilter =
                    statusFilter === "all"
                        ? true
                        : statusFilter === "checked-in"
                            ? shareholder.checkedInProperties === shareholder.totalProperties
                            : shareholder.checkedInProperties < shareholder.totalProperties

                return matchesSearch && matchesPropertyFilter && matchesStatusFilter
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
            })
    }, [shareholders, searchTerm, sortField, sortOrder, propertyFilter, statusFilter])

    if (status === "loading") {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-lg text-gray-500">Loading...</p>
            </div>
        )
    }

    const handleBarcodeSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const shareholder = shareholders.find((s) => s.shareholderId === barcodeInput)
        if (shareholder) {
            router.push(`/shareholders/${shareholder.shareholderId}`)
        } else {
            alert("Shareholder not found")
        }
        setBarcodeInput("")
    }

    const handleRowClick = (shareholderId: string) => {
        router.push(`/shareholders/${shareholderId}`)
    }

    const totalPages = Math.ceil(totalShareholders / itemsPerPage)

    return (
        <div className="w-full bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Shareholder List</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <input
                    type="text"
                    placeholder="Search by name or ID"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select
                    className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <select
                    className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={propertyFilter}
                    onChange={(e) => setPropertyFilter(e.target.value)}
                >
                    <option value="all">All Properties</option>
                    <option value="1">Single Property</option>
                    <option value="2-5">2-5 Properties</option>
                    <option value="6+">6+ Properties</option>
                </select>
                <select
                    className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="all">All Status</option>
                    <option value="checked-in">Fully Checked In</option>
                    <option value="not-checked-in">Partially/Not Checked In</option>
                </select>
            </div>
            <form onSubmit={handleBarcodeSubmit} className="mb-6">
                <input
                    type="text"
                    placeholder="Scan barcode"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                />
            </form>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Total Properties
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredAndSortedShareholders.map((shareholder) => (
                            <tr
                                key={shareholder.shareholderId}
                                className="hover:bg-blue-50 cursor-pointer transition-colors duration-150"
                                onClick={() => handleRowClick(shareholder.shareholderId)}
                            >
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{shareholder.shareholderId}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{shareholder.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{shareholder.totalProperties}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {shareholder.checkedInProperties === shareholder.totalProperties ? (
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                            {shareholder.checkedInProperties} / {shareholder.totalProperties} Checked In
                                        </span>
                                    ) : (
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                            {shareholder.checkedInProperties} / {shareholder.totalProperties} Checked In
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex gap-2">
                    <button
                        onClick={() => router.push(`/shareholders?page=${currentPage - 1}&itemsPerPage=${itemsPerPage}`)}
                        disabled={currentPage === 1}
                        className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50"
                    >
                        Previous
                    </button>
                    <button
                        onClick={() => router.push(`/shareholders?page=${currentPage + 1}&itemsPerPage=${itemsPerPage}`)}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50"
                    >
                        Next
                    </button>
                </div>
                <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                </span>
                <select
                    value={itemsPerPage}
                    onChange={(e) => router.push(`/shareholders?page=1&itemsPerPage=${e.target.value}`)}
                    className="px-4 py-2 border border-gray-300 rounded-md"
                >
                    <option value="10">10 per page</option>
                    <option value="25">25 per page</option>
                    <option value="50">50 per page</option>
                    <option value="100">100 per page</option>
                </select>
            </div>
        </div>
    )
}

export default ShareholderList