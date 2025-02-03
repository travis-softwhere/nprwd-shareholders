import type React from "react"
import Image from "next/image"
import Link from "next/link"

const Navigation: React.FC = () => {
    return (
        <nav className="bg-blue-600 text-white shadow-lg">
            <div className="container mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 relative">
                            <Image src="/logo.png" alt="NPRWD Logo" fill className="object-contain" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">AquaShare</h1>
                            <p className="text-sm text-blue-100">North Prairie Regional Water District Shareholder Management</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <Link href="/" className="hover:text-blue-200">
                            Dashboard
                        </Link>
                        <Link href="/shareholders" className="hover:text-blue-200">
                            Shareholder List
                        </Link>
                        <Link href="/admin" className="hover:text-blue-200">
                            Admin
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    )
}

export default Navigation