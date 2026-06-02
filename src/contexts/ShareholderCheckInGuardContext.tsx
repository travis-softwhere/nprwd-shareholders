"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
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

type PendingNavigation =
  | { type: "href"; href: string }
  | { type: "callback"; run: () => void }

type ShareholderCheckInGuardContextValue = {
  setPendingConfirmation: (pending: boolean) => void
  requestNavigation: (nav: PendingNavigation) => void
}

const ShareholderCheckInGuardContext =
  createContext<ShareholderCheckInGuardContextValue | null>(null)

export function ShareholderCheckInGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [pendingConfirmation, setPendingConfirmation] = useState(false)
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)
  const pendingNavRef = useRef<PendingNavigation | null>(null)

  const runNavigation = useCallback(
    (nav: PendingNavigation) => {
      if (nav.type === "href") {
        router.push(nav.href)
      } else {
        nav.run()
      }
    },
    [router],
  )

  const requestNavigation = useCallback(
    (nav: PendingNavigation) => {
      if (!pendingConfirmation) {
        runNavigation(nav)
        return
      }
      pendingNavRef.current = nav
      setLeaveDialogOpen(true)
    },
    [pendingConfirmation, runNavigation],
  )

  const handleStayOnPage = () => {
    pendingNavRef.current = null
    setLeaveDialogOpen(false)
  }

  const handleLeaveAnyway = () => {
    const nav = pendingNavRef.current
    pendingNavRef.current = null
    setLeaveDialogOpen(false)
    setPendingConfirmation(false)
    if (nav) runNavigation(nav)
  }

  useEffect(() => {
    if (!pendingConfirmation) return

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }

    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [pendingConfirmation])

  return (
    <ShareholderCheckInGuardContext.Provider
      value={{ setPendingConfirmation, requestNavigation }}
    >
      {children}

      <AlertDialog open={leaveDialogOpen} onOpenChange={(open) => !open && handleStayOnPage()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Check-in not finished</AlertDialogTitle>
            <AlertDialogDescription>
              A signature was captured but check-in has not been saved yet. Tap{" "}
              <span className="font-medium text-foreground">Confirm &amp; check in</span> on the
              signature panel to finish. If you leave now, this benefit unit owner will not be
              checked in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleStayOnPage}>Stay and finish check-in</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveAnyway}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Leave without saving
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ShareholderCheckInGuardContext.Provider>
  )
}

export function useShareholderCheckInGuard(): ShareholderCheckInGuardContextValue {
  const ctx = useContext(ShareholderCheckInGuardContext)
  if (!ctx) {
    throw new Error("useShareholderCheckInGuard must be used within ShareholderCheckInGuardProvider")
  }
  return ctx
}

export function useShareholderCheckInGuardOptional(): ShareholderCheckInGuardContextValue | null {
  return useContext(ShareholderCheckInGuardContext)
}
