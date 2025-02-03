"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart, Users, Settings, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { useMeeting } from "@/contexts/MeetingContext"

const Navigation = () => {
    const pathname = usePathname()
    const { selectedMeeting, isDataLoaded } = useMeeting()

    const navigation = [
        {
            name: "Dashboard",
            href: "/",
            icon: BarChart,
            disabled: !isDataLoaded,
        },
        {
            name: "Shareholder List",
            href: "/shareholders",
            icon: Users,
            disabled: !isDataLoaded,
        },
        {
            name: "Admin",
            href: "/admin",
            icon: Settings,
            disabled: false,
        },
    ]

    return (
        <div className="flex h-full w-[64px] flex-col items-center border-r bg-white">
            <div className="flex h-16 shrink-0 items-center">
                <Image src="/logo.png" alt="NPRWD Logo" width={40} height={40} className="rounded-lg" />
            </div>
            <nav className="flex flex-1 flex-col gap-4 p-3">
                {navigation.map((item) => {
                    const isActive = pathname === item.href
                    return (
                        <Link
                            key={item.name}
                            href={item.disabled ? "#" : item.href}
                            className={cn(
                                "group relative flex h-11 w-11 items-center justify-center rounded-lg outline-none",
                                isActive && !item.disabled && "bg-gray-100",
                                item.disabled
                                    ? "cursor-not-allowed opacity-50"
                                    : "hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-gray-400",
                            )}
                            title={item.disabled ? `Select a meeting first` : item.name}
                            onClick={(e) => {
                                if (item.disabled) {
                                    e.preventDefault()
                                }
                            }}
                        >
                            <item.icon
                                className={cn(
                                    "h-6 w-6 text-gray-400 group-hover:text-gray-600",
                                    isActive && !item.disabled && "text-blue-600",
                                )}
                            />
                        </Link>
                    )
                })}
            </nav>
            {selectedMeeting && (
                <div className="mb-4 flex flex-col items-center gap-1 p-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <span className="text-xs font-medium text-gray-600">{selectedMeeting.year}</span>
                </div>
            )}
        </div>
    )
}

export default Navigation