'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, X, Clock, RefreshCw, MessageSquare, ExternalLink } from "lucide-react"
import Link from "next/link"
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
import { AdminRequest } from "@/types/adminRequest"

export default function AdminRequestsList() {
  const [requests, setRequests] = useState<AdminRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<AdminRequest | null>(null)
  const [pendingAction, setPendingAction] = useState<'complete' | 'reject' | null>(null)

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin-requests')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch requests')
      }
      
      setRequests(data.requests || [])
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch admin requests",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  const handleAction = (request: AdminRequest, action: 'complete' | 'reject') => {
    setSelectedRequest(request)
    setPendingAction(action)
    setShowConfirmDialog(true)
  }

  const confirmAction = async () => {
    if (!selectedRequest || !pendingAction) return

    try {
      const response = await fetch(`/api/admin-requests/${selectedRequest.id}`, {
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
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800"><Check className="w-3 h-3 mr-1" />Completed</Badge>
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Admin Requests
          </CardTitle>
          <CardDescription>
            Requests from benefit unit owner details pages that require admin attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
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
            <div className="text-sm text-muted-foreground">
              {requests.length} total requests
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading requests...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pending Requests */}
              {pendingRequests.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Pending Requests ({pendingRequests.length})</h3>
                  <div className="space-y-3">
                                         {pendingRequests.map((request) => (
                       <div key={request.id} className="border rounded-lg p-4 bg-card">
                         <div className="flex items-start justify-between">
                           <div className="flex-1">
                             <div className="flex items-center gap-2 mb-2">
                               <Link 
                                 href={`/shareholders/${request.shareholderId}`}
                                 className="flex items-center gap-2 hover:text-primary transition-colors"
                               >
                                 <h4 className="font-medium">{request.shareholderName}</h4>
                                 <ExternalLink className="w-4 h-4" />
                               </Link>
                               <span className="text-sm text-muted-foreground">({request.shareholderId})</span>
                               {getStatusBadge(request.status)}
                             </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              Requested by: {request.requestedBy} on {new Date(request.requestedAt).toLocaleString()}
                            </p>
                            <div className="bg-muted p-3 rounded-md">
                              <p className="text-sm font-medium mb-1">Request:</p>
                              <p className="text-sm whitespace-pre-wrap">{request.reason}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <Button
                              size="sm"
                              onClick={() => handleAction(request, 'complete')}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Complete
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
                </div>
              )}

              {/* Processed Requests */}
              {processedRequests.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Processed Requests ({processedRequests.length})</h3>
                  <div className="space-y-3">
                                         {processedRequests.map((request) => (
                       <div key={request.id} className="border rounded-lg p-4 bg-muted/50">
                         <div className="flex items-start justify-between">
                           <div className="flex-1">
                             <div className="flex items-center gap-2 mb-2">
                               <Link 
                                 href={`/shareholders/${request.shareholderId}`}
                                 className="flex items-center gap-2 hover:text-primary transition-colors"
                               >
                                 <h4 className="font-medium">{request.shareholderName}</h4>
                                 <ExternalLink className="w-4 h-4" />
                               </Link>
                               <span className="text-sm text-muted-foreground">({request.shareholderId})</span>
                               {getStatusBadge(request.status)}
                             </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              Requested by: {request.requestedBy} on {new Date(request.requestedAt).toLocaleString()}
                            </p>
                            {request.completedBy && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {request.status === 'completed' ? 'Completed' : 'Rejected'} by: {request.completedBy} on {new Date(request.completedAt!).toLocaleString()}
                              </p>
                            )}
                            <div className="bg-background p-3 rounded-md">
                              <p className="text-sm font-medium mb-1">Request:</p>
                              <p className="text-sm whitespace-pre-wrap">{request.reason}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {requests.length === 0 && (
                <div className="text-center py-8">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No admin requests found</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction === 'complete' ? 'Complete Request' : 'Reject Request'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {pendingAction} this admin request for {selectedRequest?.shareholderName}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction}>
              {pendingAction === 'complete' ? 'Complete' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
