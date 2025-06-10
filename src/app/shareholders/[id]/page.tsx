// [id]/page.tsx

import { getShareholderDetails } from "@/actions/getShareholderDetails"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import ManualCheckInButton from "@/components/ManualCheckInButton"
import SetDesigneeForm from "@/components/SetDesigneeForm"
import EditableName from "@/components/EditableName"
import React from 'react';
import ShareholderCommentBox from '@/components/ShareholderCommentBox';
import { User, Home, Hash, CheckCircle, XCircle, ArrowLeft, Mail, Users, Edit2 } from 'lucide-react';

// Update to use Promise type for params, matching Next.js expectations
export default async function ShareholderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Await the params promise
  const resolvedParams = await params;
  const { id: shareholderId } = resolvedParams;

  try {
    const { shareholder: rawShareholder, properties: rawProperties } = await getShareholderDetails(shareholderId)
    if (!rawShareholder) {
      notFound()
    }

    // Map snake_case to camelCase for shareholder
    const shareholder = {
      ...rawShareholder,
      shareholderId: rawShareholder.shareholder_id,
      ownerMailingAddress: rawShareholder.owner_mailing_address,
      ownerCityStateZip: rawShareholder.owner_city_state_zip,
      isNew: rawShareholder.is_new,
    }
    // Map snake_case to camelCase for properties
    const properties = rawProperties.map((p: any) => ({
      ...p,
      serviceAddress: p.service_address,
      checkedIn: p.checked_in,
      shareholderId: p.shareholder_id,
    }))

    const checkedInCount = properties.filter((p) => p.checkedIn).length

    return (
      <div className="container mx-auto p-2 sm:p-6 max-w-full sm:max-w-4xl">
        <div className="flex items-center gap-2 mb-4">
          <Link
            href="/shareholders"
            className="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 text-sm font-medium shadow-sm transition"
          >
            <ArrowLeft className="h-4 w-4" /> Back to List
          </Link>
          <span className="flex-1 border-b border-gray-200 ml-2" />
        </div>

        {/* Responsive grid: Info/Actions left, Comment right */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Shareholder Info Card */}
          <Card className="col-span-1 md:col-span-2">
            <CardContent className="p-4 sm:p-8">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-6 w-6 text-blue-500" />
                  <EditableName 
                    initialName={shareholder.name}
                    shareholderId={shareholder.shareholderId}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Hash className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">Owner ID:</span>
                      <span className="ml-1 text-gray-900">{shareholder.shareholderId}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-yellow-400" />
                      <span className="font-medium">New since mailers:</span>
                      <Badge variant={shareholder.isNew ? "success" : "secondary"} className={shareholder.isNew ? "bg-yellow-200 text-yellow-900" : "bg-gray-100 text-gray-700"}>
                        {shareholder.isNew ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Home className="h-4 w-4 text-green-500" />
                      <span className="font-medium">Total Properties:</span>
                      <span className="ml-1 text-gray-900">{properties.length}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="font-medium">Check-in Status:</span>
                      <Badge variant={checkedInCount === properties.length ? "success" : "secondary"} className={checkedInCount === properties.length ? "bg-green-500 text-white" : "bg-gray-200 text-gray-700"}>
                        {checkedInCount} / {properties.length} Checked In
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-blue-400" />
                      <span className="font-medium">Owner Address:</span>
                      <span className="ml-1 text-gray-900">{shareholder.ownerMailingAddress}, {shareholder.ownerCityStateZip}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions Card */}
          <Card className="col-span-1 flex flex-col justify-between">
            <CardContent className="p-4 sm:p-6 flex flex-col gap-4">
              <div>
                <div className="font-semibold text-gray-800 mb-2 flex items-center gap-2"><Edit2 className="h-4 w-4 text-blue-400" /> Actions</div>
                <ManualCheckInButton
                  shareholderId={shareholder.shareholderId}
                  isFullyCheckedIn={checkedInCount === properties.length}
                />
              </div>
              <div>
                <div className="font-semibold text-gray-800 mb-2 flex items-center gap-2"><Users className="h-4 w-4 text-blue-400" /> Designee</div>
                <SetDesigneeForm shareholderId={shareholder.shareholderId} />
              </div>
            </CardContent>
          </Card>

          {/* Comment Card (full width on mobile, right column on desktop) */}
          <Card className="col-span-1 md:col-span-3">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-lg text-gray-800">Comment</span>
              </div>
              <ShareholderCommentBox shareholderId={shareholder.shareholderId} />
            </CardContent>
          </Card>
        </div>

        {/* Properties Table Card */}
        <Card className="mt-6">
          <CardContent className="p-4 sm:p-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-4 flex items-center gap-2">
              <Home className="h-5 w-5 text-blue-500" /> Properties
            </h2>
            <div className="rounded-md border overflow-x-auto bg-white">
              <Table className="min-w-[400px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Service Address</TableHead>
                    <TableHead>Benefit Unit Owner</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {properties.map((property, idx) => (
                    <TableRow key={property.id} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                      <TableCell className="font-mono text-gray-800">{property.serviceAddress}</TableCell>
                      <TableCell className="text-gray-700">{shareholder.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant={property.checkedIn ? "success" : "secondary"}
                          className={property.checkedIn ? "bg-green-500 text-white" : "bg-gray-200 text-gray-700"}
                        >
                          {property.checkedIn ? (
                            <span className="inline-flex items-center gap-1"><CheckCircle className="h-4 w-4" /> Checked In</span>
                          ) : (
                            <span className="inline-flex items-center gap-1"><XCircle className="h-4 w-4" /> Not Checked In</span>
                          )}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  } catch (error) {
    // Let Next.js error boundary handle this
    throw error
  }
}
