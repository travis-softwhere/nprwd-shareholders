"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import type { Property } from "@/utils/csvParser"
import { useMeeting } from "@/contexts/MeetingContext"

interface ShareholderListProps {
    properties: Property[]
    totalProperties: number
    currentPage: number
    itemsPerPage: number
}

type SortField = "numOf" | "customerName" | "ownerName" | "account"
type SortOrder = "asc" | "desc"

const ShareholderList: React.FC<ShareholderListProps> = ({
    properties,
    totalProperties,
    currentPage,
    itemsPerPage,
}) => {
    const { isDataLoaded } = useMeeting()

    if (!isDataLoaded) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-lg text-gray-500">Please upload data in the Admin page first.</p>
            </div>
        )
    }

    const [searchTerm, setSearchTerm] = useState("")
    const [sortField, setSortField] = useState<SortField>("account")
    const [sortOrder, setSortOrder] = useState<SortOrder>("asc")
    const [barcodeInput, setBarcodeInput] = useState("")
    const [propertyFilter, setPropertyFilter] = useState<string>("all")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const router = useRouter()

    const filteredAndSortedProperties = useMemo(() => {
        return properties
            .filter((shareholder) => {
                const matchesSearch =
                    (shareholder.account?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
                    (shareholder.ownerName?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
                    (shareholder.customerName?.toLowerCase() || "").includes(searchTerm.toLowerCase())

                const matchesPropertyFilter =
                    propertyFilter === "all"
                        ? true
                        : propertyFilter === "1"
                            ? shareholder.numOf === "1"
                            : propertyFilter === "2-5"
                                ? Number.parseInt(shareholder.numOf) >= 2 && Number.parseInt(shareholder.numOf) <= 5
                                : propertyFilter === "6+"
                                    ? Number.parseInt(shareholder.numOf) >= 6
                                    : true

                const matchesStatusFilter =
                    statusFilter === "all"
                        ? true
                        : statusFilter === "checked-in"
                            ? shareholder.checkedIn
                            : statusFilter === "not-checked-in"
                                ? !shareholder.checkedIn
                                : true

                return matchesSearch && matchesPropertyFilter && matchesStatusFilter
            })
            .sort((a, b) => {
                let aValue: string | number = a[sortField]
                let bValue: string | number = b[sortField]

                if (sortField === "numOf") {
                    aValue = Number.parseInt(aValue as string) || 0
                    bValue = Number.parseInt(bValue as string) || 0
                } else {
                    aValue = String(aValue || "")
                    bValue = String(bValue || "")
                }

                if (aValue < bValue) return sortOrder === "asc" ? -1 : 1
                if (aValue > bValue) return sortOrder === "asc" ? 1 : -1
                return 0
            })
    }, [properties, searchTerm, sortField, sortOrder, propertyFilter, statusFilter])

    const handleBarcodeSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const shareholder = properties.find((p) => p.shareholderId === barcodeInput || p.account === barcodeInput)
        if (shareholder) {
            router.push(`/shareholder/${shareholder.shareholderId}`)
        } else {
            alert("Shareholder not found")
        }
        setBarcodeInput("")
    }

    const handleRowClick = (shareholderId: string) => {
        router.push(`/shareholder/${shareholderId}`)
    }

    const totalPages = Math.ceil(totalProperties / itemsPerPage)

    return (
        <div className="w-full bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Shareholder List</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <input
                    type="text"
                    placeholder="Search by account, owner name, or customer name"
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
                    <option value="account-asc">Account (A-Z)</option>
                    <option value="account-desc">Account (Z-A)</option>
                    <option value="ownerName-asc">Owner Name (A-Z)</option>
                    <option value="ownerName-desc">Owner Name (Z-A)</option>
                    <option value="customerName-asc">Customer Name (A-Z)</option>
                    <option value="customerName-desc">Customer Name (Z-A)</option>
                    <option value="numOf-asc">Properties (Low to High)</option>
                    <option value="numOf-desc">Properties (High to Low)</option>
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
                    <option value="checked-in">Checked In</option>
                    <option value="not-checked-in">Not Checked In</option>
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
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                                Account
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                                Owner Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                                Customer Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                                Properties
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                                Status
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredAndSortedProperties.map((shareholder) => (
                            <tr
                                key={shareholder.account}
                                className="hover:bg-blue-50 cursor-pointer transition-colors duration-150"
                                onClick={() => handleRowClick(shareholder.shareholderId)}
                            >
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{shareholder.account}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{shareholder.ownerName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{shareholder.customerName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{shareholder.numOf}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {shareholder.checkedIn ? (
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                            Checked In
                                        </span>
                                    ) : (
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                            Not Checked In
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
                        onClick={() => router.push(`/?page=${currentPage - 1}&itemsPerPage=${itemsPerPage}`)}
                        disabled={currentPage === 1}
                        className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50"
                    >
                        Previous
                    </button>
                    <button
                        onClick={() => router.push(`/?page=${currentPage + 1}&itemsPerPage=${itemsPerPage}`)}
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
                    onChange={(e) => router.push(`/?page=1&itemsPerPage=${e.target.value}`)}
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