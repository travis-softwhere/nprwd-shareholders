"use client"

import React, { useRef, useState } from "react";
import SignaturePad from "react-signature-canvas";

export default function SignaturePage() {
  const sigPadRef = useRef<SignaturePad>(null);
  const [ownerId, setOwnerId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearSignature = () => {
    sigPadRef.current?.clear();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!ownerId.trim()) {
      setError("Benefit Unit Owner ID is required.");
      return;
    }
    if (sigPadRef.current?.isEmpty()) {
      setError("Signature is required.");
      return;
    }
    setIsSubmitting(true);
    try {
      const signatureData = sigPadRef.current?.getTrimmedCanvas().toDataURL("image/png");
      // TODO: Send ownerId and signatureData to your API
      // await fetch(...)
      setSuccess("Signature submitted successfully!");
      setOwnerId("");
      clearSignature();
    } catch (err) {
      setError("Failed to submit signature.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6 text-center">Sign for Meeting Attendance</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="ownerId" className="block text-sm font-medium text-gray-700 mb-1">
            Benefit Unit Owner ID
          </label>
          <input
            id="ownerId"
            type="text"
            value={ownerId}
            onChange={e => setOwnerId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter Owner ID"
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Signature</label>
          <div className="border border-gray-300 rounded-md bg-gray-50 p-2 flex flex-col items-center">
            <SignaturePad
              ref={sigPadRef}
              canvasProps={{
                width: 400,
                height: 180,
                className: "bg-white rounded shadow border border-gray-200"
              }}
              penColor="black"
            />
            <button
              type="button"
              onClick={clearSignature}
              className="mt-2 px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
              disabled={isSubmitting}
            >
              Clear
            </button>
          </div>
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        {success && <div className="text-green-600 text-sm">{success}</div>}
        <button
          type="submit"
          className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Submitting..." : "Submit Signature"}
        </button>
      </form>
    </div>
  );
}
