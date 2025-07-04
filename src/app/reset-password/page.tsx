"use client";
export const dynamic = "force-dynamic";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { Eye, EyeOff } from "lucide-react"; // Import icons for password visibility
import Image from "next/image";
import Head from "next/head";
import { LoadingScreen } from "@/components/ui/loading-screen";

export default function ResetPasswordPage() {
  const router = useRouter();
  
  // Wrap useSearchParams in Suspense
  return (
    <>
      <Head>
        <title>Set New Password | AquaShare</title>
      </Head>
      <Suspense fallback={<LoadingScreen message="Loading..." />}>
        <SearchParamsComponent router={router} />
      </Suspense>
    </>
  );
}

function SearchParamsComponent({ router }: { router: ReturnType<typeof useRouter> }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!token) {
      setMessage("Invalid or expired token.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Failed to reset password");
      } else {
        setMessage("Password changed successfully!");
      }
    } catch (error) {
      setMessage("An error occurred while resetting the password.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-6 sm:p-8 rounded-xl shadow-md">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Image 
              src="/logo.png" 
              alt="AquaShare Logo" 
              width={100} 
              height={100} 
              className="mx-auto" 
              priority
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-1">Set New Password</h1>
          <h2 className="text-lg sm:text-xl font-medium text-gray-700 mb-2">AquaShare</h2>
          <p className="text-sm text-gray-600 max-w-sm mx-auto">
            Please enter your new password below
          </p>
        </div>
        
        {!token ? (
          <div className="p-4 bg-red-50 rounded-md text-red-700 text-center">
            <p>Invalid or expired token. Please request a new password reset link.</p>
            <button
              onClick={() => router.push("/auth/signin")}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Go to Sign In
            </button>
          </div>
        ) : (
          !message.includes("successfully") ? (
            <form onSubmit={handleSubmit} className="mt-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Processing..." : "Set New Password"}
                </button>
              </div>
            </form>
          ) : null
        )}
        
        {message && (
          <div className={`mt-4 p-4 rounded-md ${message.includes("successfully") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            <p className="text-center">{message}</p>
            {message.includes("successfully") && (
              <div className="text-center mt-4">
                <a
                  href="https://aquashare.soft-where.com"
                  className="inline-block px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Go to AquaShare Dashboard
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
