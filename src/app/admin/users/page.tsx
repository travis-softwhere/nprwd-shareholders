"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Trash2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"

interface User {
    id: string
    username: string
    email: string
    firstName: string
    lastName: string
    enabled: boolean
}

export default function UsersPage() {
    const { data: session } = useSession()
    const { toast } = useToast()
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [newUser, setNewUser] = useState({
        fullName: "",
        email: "",
    })

    // Fetch users on component mount
    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        try {
            const response = await fetch("/api/users")
            if (!response.ok) throw new Error("Failed to fetch users")
            const data = await response.json()
            console.log("Fetched users:", data)
            setUsers(data.users)
        } catch (err) {
            console.error("Error fetching users:", err)
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to fetch users"
            })
        }
    }

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault()
        
        // Check if we have a session and if the user is an admin
        if (!session || !session.user?.isAdmin) {
            console.error("No session or user is not admin");
            toast({
                variant: "destructive",
                title: "Error",
                description: "You must be logged in as an admin to create users"
            });
            return;
        }

        console.log("Session check passed:", session);
        console.log("Form submitted with data:", newUser);
        setLoading(true);
        setError(null);

        if (!newUser.fullName.includes(" ")) {
            setError("Full name must include both first and last name");
            setLoading(false);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Full name must include both first and last name"
            });
            return;
        }

        try {
            console.log("Making API call to create employee...");
            const response = await fetch("/api/create-employee", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include", // Include cookies for authentication
                body: JSON.stringify(newUser),
            });

            console.log("API response status:", response.status);
            const responseText = await response.text();
            console.log("Raw response:", responseText);

            let responseData;
            try {
                responseData = JSON.parse(responseText);
                console.log("API response data:", responseData);
            } catch (e) {
                console.error("Failed to parse response as JSON:", e);
                throw new Error("Invalid response from server");
            }

            if (!response.ok) {
                throw new Error(responseData.error || "Failed to create user");
            }

            setUsers((prev) => [...prev, responseData.user]);
            setNewUser({ fullName: "", email: "" });
            toast({
                title: "Success",
                description: "User created successfully"
            });
            fetchUsers(); // Refresh the user list
        } catch (err) {
            console.error("Error creating user:", err);
            const message = err instanceof Error ? err.message : "Failed to create user";
            setError(message);
            toast({
                variant: "destructive",
                title: "Error",
                description: message
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: "DELETE",
            })

            if (!response.ok) {
                throw new Error("Failed to delete user")
            }

            setUsers((prev) => prev.filter((user) => user.id !== userId))
            toast({
                title: "Success",
                description: "User deleted successfully"
            })
        } catch (err) {
            console.error("Error deleting user:", err)
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to delete user"
            })
        }
    }

    // Redirect if not admin
    if (!session?.user?.isAdmin) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p className="text-lg text-gray-500">You do not have permission to access this page.</p>
            </div>
        )
    }

    return (
        <div className="container mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6">User Management</h1>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Create New User</CardTitle>
                        <CardDescription>Add a new user to the system</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="fullName">Full Name</Label>
                                <Input
                                    id="fullName"
                                    value={newUser.fullName}
                                    onChange={(e) => setNewUser((prev) => ({ ...prev, fullName: e.target.value }))}
                                    placeholder="John Doe"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                                    placeholder="john.doe@example.com"
                                    required
                                />
                            </div>
                            {error && (
                                <Alert variant="destructive">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                            <Button type="submit" disabled={loading}>
                                {loading ? "Creating..." : "Create User"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Users</CardTitle>
                        <CardDescription>Manage existing users</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {users.map((user) => (
                                <div
                                    key={user.id}
                                    className="flex items-center justify-between p-4 rounded-lg border hover:border-gray-300"
                                >
                                    <div>
                                        <p className="font-medium">{user.firstName} {user.lastName}</p>
                                        <p className="text-sm text-gray-500">{user.email}</p>
                                        <p className="text-xs text-gray-400">Username: {user.username}</p>
                                    </div>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Are you sure you want to delete this user? This action cannot be undone.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                    className="bg-red-500 hover:bg-red-600"
                                                    onClick={() => handleDeleteUser(user.id)}
                                                >
                                                    Delete
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}