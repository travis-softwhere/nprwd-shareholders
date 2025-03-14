"use client";
export const dynamic = "force-dynamic";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

export default function ResetPasswordPage() {
  const router = useRouter();
  
  // Wrap useSearchParams in Suspense
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SearchParamsComponent router={router} />
    </Suspense>
  );
}

function SearchParamsComponent({ router }: { router: ReturnType<typeof useRouter> }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
        setMessage("Password reset successfully!");
        setTimeout(() => router.push("/login"), 2000);
      }
    } catch (error) {
      console.error("Error resetting password:", error);
      setMessage("An error occurred while resetting the password.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "40px auto", textAlign: "center" }}>
      <h1>Reset Password</h1>
      {!token ? (
        <p style={{ color: "red" }}>Invalid or expired token.</p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input
            type="password"
            placeholder="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: "10px", border: "1px solid #ccc", borderRadius: "4px" }}
          />
          <input
            type="password"
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            style={{ padding: "10px", border: "1px solid #ccc", borderRadius: "4px" }}
          />
          <button
            type="submit"
            disabled={isLoading}
            style={{
              padding: "10px 16px",
              backgroundColor: "#0070f3",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            {isLoading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      )}
      {message && <p style={{ marginTop: "16px", fontWeight: "bold", color: message.includes("successfully") ? "green" : "red" }}>{message}</p>}
    </div>
  );
}
