import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Session } from "next-auth"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isAdminUser(session: Session | null) {
  return session?.user?.isAdmin === true;
}