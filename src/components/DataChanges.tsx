"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { History, UserPlus, UserMinus, UserCog } from "lucide-react"

interface Change {
    type: "add" | "remove" | "modify"
    shareholderId: string
    ownerName: string
    details: string
    timestamp: string
}

interface DataChangesProps {
    meetingId: string
}

export function DataChanges({ meetingId }: DataChangesProps) {
    const [changes, setChanges] = useState<Change[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchChanges = async () => {
            try {
                const response = await fetch(`/api/changes?meetingId=${meetingId}`)
                const data = await response.json()
                setChanges(data.changes)
            } catch (error) {
                console.error("Failed to fetch changes:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchChanges()
    }, [meetingId])

    const getChangeIcon = (type: string) => {
        switch (type) {
            case "add":
                return <UserPlus className="h-4 w-4 text-green-500" />
            case "remove":
                return <UserMinus className="h-4 w-4 text-red-500" />
            case "modify":
                return <UserCog className="h-4 w-4 text-yellow-500" />
            default:
                return null
        }
    }

    const getChangeBadge = (type: string) => {
        switch (type) {
            case "add":
                return <Badge variant="success">Added</Badge>
            case "remove":
                return <Badge variant="destructive">Removed</Badge>
            case "modify":
                return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">Modified</Badge>
            default:
                return null
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Data Changes
                </CardTitle>
                <CardDescription>Track changes in shareholder data since mailer generation</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <p className="text-sm text-muted-foreground">Loading changes...</p>
                ) : changes.length === 0 ? (
                    <Alert>
                        <AlertDescription>No changes detected since mailer generation.</AlertDescription>
                    </Alert>
                ) : (
                    <ScrollArea className="h-[300px] pr-4">
                        <div className="space-y-4">
                            {changes.map((change, index) => (
                                <div key={index} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                                    <div className="mt-1">{getChangeIcon(change.type)}</div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <p className="font-medium">{change.ownerName}</p>
                                            {getChangeBadge(change.type)}
                                        </div>
                                        <p className="text-sm text-muted-foreground">{change.details}</p>
                                        <p className="text-xs text-muted-foreground">{new Date(change.timestamp).toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    )
}