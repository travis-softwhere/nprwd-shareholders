"use client";

import React, { Suspense } from "react";
import SignInContent from "@/components/SignInContent";

export default function SignInPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInContent />
    </Suspense>
  );
}
