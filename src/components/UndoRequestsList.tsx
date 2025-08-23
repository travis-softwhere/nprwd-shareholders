'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, X, Clock, RefreshCw } from "lucide-react"
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

interface UndoRequest {
  id: number
  shareholderId: string
  shareholderName: string
  requestedBy: string
  requestedAt: string
  status: 'pending' | 'approved' | 'rejected'
  approvedBy?: string
  approvedAt?: string
  reason?: string
}

export default function UndoRequestsList() {
  const [requests, setRequests] = useState<UndoRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<UndoRequest | null>(null)
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null)

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/undo-requests')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch requests')
      }
      
      setRequests(data.requests || [])
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch undo requests",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  const handleAction = (request: UndoRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request)
    setPendingAction(action)
    setShowConfirmDialog(true)
  }

  const confirmAction = async () => {
    if (!selectedRequest || !pendingAction) return

    try {
      const response = await fetch(`/api/undo-requests/${selectedRequest.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: pendingAction }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process request')
      }

      toast({
        title: "Success",
        description: data.message,
      })

      fetchRequests()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process request",
        variant: "destructive"
      })
    } finally {
      setShowConfirmDialog(false)
      setSelectedRequest(null)
      setPendingAction(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
      case 'approved':
        return <Badge variant="default" className="bg-green-100 text-green-800"><Check className="w-3 h-3 mr-1" />Approved</Badge>
      case 'rejected':
        return <Badge variant="destructive" className="bg-red-100 text-red-800"><X className="w-3 h-3 mr-1" />Rejected</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const pendingRequests = requests.filter(r => r.status === 'pending')
  const processedRequests = requests.filter(r => r.status !== 'pending')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Undo Check-in Requests</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchRequests}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Pending Requests
            <Badge variant="secondary">{pendingRequests.length}</Badge>
          </CardTitle>
          <CardDescription>
            Requests waiting for admin approval
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No pending requests</p>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium">{request.shareholderName}</h3>
                        <span className="text-sm text-gray-500">({request.shareholderId})</span>
                        {getStatusBadge(request.status)}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        Requested by: {request.requestedBy}
                      </p>
                      <p className="text-sm text-gray-600 mb-2">
                        Requested: {new Date(request.requestedAt).toLocaleString()}
                      </p>
                      {request.reason && (
                        <p className="text-sm text-gray-600">
                          Reason: {request.reason}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleAction(request, 'approve')}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleAction(request, 'reject')}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Processed Requests</CardTitle>
          <CardDescription>
            Recently approved or rejected requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {processedRequests.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No processed requests</p>
          ) : (
            <div className="space-y-4">
              {processedRequests.slice(0, 10).map((request) => (
                <div key={request.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium">{request.shareholderName}</h3>
                        <span className="text-sm text-gray-500">({request.shareholderId})</span>
                        {getStatusBadge(request.status)}
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        Requested by: {request.requestedBy}
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        Requested: {new Date(request.requestedAt).toLocaleString()}
                      </p>
                      {request.approvedBy && (
                        <p className="text-sm text-gray-600 mb-1">
                          {request.status === 'approved' ? 'Approved' : 'Rejected'} by: {request.approvedBy}
                        </p>
                      )}
                      {request.approvedAt && (
                        <p className="text-sm text-gray-600 mb-1">
                          {request.status === 'approved' ? 'Approved' : 'Rejected'}: {new Date(request.approvedAt).toLocaleString()}
                        </p>
                      )}
                      {request.reason && (
                        <p className="text-sm text-gray-600">
                          Reason: {request.reason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction === 'approve' ? 'Approve' : 'Reject'} Undo Request
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {pendingAction} the undo request for{' '}
              <strong>{selectedRequest?.shareholderName}</strong> ({selectedRequest?.shareholderId})?
              {pendingAction === 'approve' && ' This will immediately undo the check-in and clear the signature.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              className={pendingAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {pendingAction === 'approve' ? 'Approve' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
