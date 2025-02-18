"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LogOut, Users, Home, Settings } from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import { useMeeting } from "@/contexts/MeetingContext"

export default function Navigation() {
    const pathname = usePathname()
    const { data: session } = useSession()
    const { selectedMeeting } = useMeeting()

    const navigation = [
        { name: "Home", href: "/", icon: Home },
        { name: "Shareholders", href: "/shareholders", icon: Users },
        { name: "Settings", href: "/admin", icon: Settings, adminOnly: true },
        { name: "Users", href: "/admin/users", icon: Users },
    ]

    if (!session) return null

    return (
        <div className="flex h-full w-16 flex-col gap-y-4 border-r bg-white">
            <div className="flex flex-col h-16 shrink-0 items-center justify-center border-b">
                <img className="h-8 w-auto" src="/logo.png" alt="NPRWD" />
                <p className="text-xxs">AquaShare</p>
            </div>
            <nav className="flex flex-1 flex-col gap-y-4 px-2">
                {navigation.map((item) => {
                    const Icon = item.icon
                    const isAdminOnly = item.adminOnly
                    const shouldRender = !isAdminOnly || (session?.user && "isAdmin" in session.user && session.user.isAdmin == "true")

                    return (
                        shouldRender && (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    pathname === item.href
                                        ? "bg-gray-100 text-gray-900"
                                        : "text-gray-400 hover:bg-gray-50 hover:text-gray-900",
                                    "group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6",
                                )}
                            >
                                <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                                <span className="sr-only">{item.name}</span>
                            </Link>
                        )
                    )
                })}
            </nav>
            {selectedMeeting && (
                <div className="px-2 py-4 border-t border-gray-200">
                    <div className="text-xs text-gray-500 text-center">
                        Selected Meeting:
                        <div className="font-medium text-gray-900">{selectedMeeting.year} Annual Meeting</div>
                    </div>
                </div>
            )}
            <div className="flex shrink-0 justify-center px-2 pb-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                    className="text-gray-400 hover:bg-gray-50 hover:text-gray-900"
                >
                    <LogOut className="h-6 w-6" />
                    <span className="sr-only">Sign out</span>
                </Button>
            </div>
        </div>
    )
}