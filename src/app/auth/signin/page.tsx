"use client";

import React, { Suspense } from "react";
import SignInContent from "@/components/SignInContent";
import { Loader2 } from "lucide-react";

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="text-center">
          <div className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-blue-400 border-r-transparent align-middle">
            <span className="sr-only">Loading...</span>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-gray-700">
            Loading AquaShare
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Please wait while we prepare your login
          </p>
        </div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
