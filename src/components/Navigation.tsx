"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LogOut, Users, Home, Settings, Menu, X } from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import { useMeeting } from "@/contexts/MeetingContext"
import { useState, useEffect } from "react"
import Image from "next/image"

export default function Navigation() {
    const pathname = usePathname()
    const { data: session } = useSession()
    const { selectedMeeting } = useMeeting()
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(false)

    // Check if the screen is mobile sized
    useEffect(() => {
        const checkIfMobile = () => {
            setIsMobile(window.innerWidth < 768)
        }
        
        // Initial check
        checkIfMobile()
        
        // Add event listener for window resize
        window.addEventListener('resize', checkIfMobile)
        
        // Cleanup
        return () => window.removeEventListener('resize', checkIfMobile)
    }, [])

    const navigation = [
        { name: "Home", href: "/", icon: Home },
        { name: "Shareholders", href: "/shareholders", icon: Users },
        { name: "Settings", href: "/admin", icon: Settings, adminOnly: true },
    ]

    if (!session) return null

    // Desktop sidebar navigation
    const DesktopNavigation = () => (
        <div className="hidden md:flex h-full w-16 flex-col gap-y-4 border-r bg-white">
            <div className="flex flex-col h-16 shrink-0 items-center justify-center border-b">
                <Image className="h-8 w-auto" src="/logo.png" alt="AquaShare" width={32} height={32} />
                <p className="text-[10px]">AquaShare</p>
            </div>
            <nav className="flex flex-1 flex-col gap-y-4 px-2">
                {navigation.map((item) => {
                    const Icon = item.icon
                    const isAdminOnly = item.adminOnly
                    const isAdmin = session.user.isAdmin

                    const shouldRender = !isAdminOnly || isAdmin

                    return (
                        shouldRender && (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    pathname === item.href
                                        ? "bg-blue-50 text-blue-600"
                                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900",
                                    "group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 transition-colors",
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
                        Meeting:
                        <div className="font-medium text-gray-900">{selectedMeeting.year}</div>
                    </div>
                </div>
            )}
            <div className="flex shrink-0 justify-center px-2 pb-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                    className="text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                    <LogOut className="h-6 w-6" />
                    <span className="sr-only">Sign out</span>
                </Button>
            </div>
        </div>
    )

    // Mobile bottom navigation
    const MobileNavigation = () => (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-10">
            <div className="grid grid-cols-4 h-16">
                {navigation.map((item) => {
                    const Icon = item.icon
                    const isAdminOnly = item.adminOnly
                    const isAdmin = session.user.isAdmin
                    const shouldRender = !isAdminOnly || isAdmin

                    if (!shouldRender) return null;

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center justify-center",
                                pathname === item.href
                                    ? "text-blue-600"
                                    : "text-gray-500 hover:text-gray-900"
                            )}
                        >
                            <Icon className="h-5 w-5" />
                            <span className="text-xs mt-1">{item.name}</span>
                        </Link>
                    )
                })}
                <button
                    onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                    className="flex flex-col items-center justify-center text-gray-500 hover:text-gray-900"
                >
                    <LogOut className="h-5 w-5" />
                    <span className="text-xs mt-1">Sign Out</span>
                </button>
            </div>
            {selectedMeeting && (
                <div className="p-1 text-center border-t text-xs bg-gray-50">
                    Selected Meeting: <span className="font-medium">{selectedMeeting.year}</span>
                </div>
            )}
        </div>
    )

    // Combined return for responsive layout
    return (
        <>
            <DesktopNavigation />
            <MobileNavigation />
        </>
    )
}