"use client"

import { useShareholderCheckInGuard } from "@/contexts/ShareholderCheckInGuardContext"

export default function ShareholderBackLink() {
  const { requestNavigation } = useShareholderCheckInGuard()

  return (
    <button
      type="button"
      onClick={() => requestNavigation({ type: "href", href: "/" })}
      className="text-primary hover:underline mb-2 sm:mb-4 inline-flex items-center text-left"
    >
      ← Back to benefit unit owners
    </button>
  )
}
