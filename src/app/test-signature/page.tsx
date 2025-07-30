"use client";

import { useState } from "react";
import SignaturePad from "@/components/SignaturePad";
import TopazDiagnostic from "@/components/TopazDiagnostic";
import { Button } from "@/components/ui/button";

export default function TestSignaturePage() {
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [lastSignature, setLastSignature] = useState<string | null>(null);
  const [lastHash, setLastHash] = useState<string | null>(null);

  const handleSignatureComplete = (signatureImage: string, signatureHash: string) => {
    console.log("Signature completed:", { signatureImage: signatureImage.substring(0, 50) + "...", signatureHash });
    setLastSignature(signatureImage);
    setLastHash(signatureHash);
    setShowSignaturePad(false);
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Signature Pad Test</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <Button 
            onClick={() => setShowSignaturePad(true)}
            className="bg-blue-600 hover:bg-blue-700 w-full"
          >
            Test Signature Capture
          </Button>

          {lastSignature && (
            <div className="p-4 border rounded">
              <h2 className="text-lg font-semibold mb-2">Last Captured Signature:</h2>
              <div className="space-y-2">
                <div>
                  <strong>Hash:</strong> <span className="font-mono text-sm">{lastHash}</span>
                </div>
                <div>
                  <strong>Image Data:</strong> 
                  <div className="mt-2">
                    <img 
                      src={lastSignature} 
                      alt="Captured signature" 
                      className="border rounded max-w-xs"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Data length: {lastSignature.length} characters
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 bg-gray-100 rounded">
            <h3 className="font-semibold mb-2">Debugging Tips:</h3>
            <ul className="text-sm space-y-1">
              <li>• Make sure the Topaz signature pad is connected via USB</li>
              <li>• Ensure the SigPlusExtLite browser extension is installed and active</li>
              <li>• Check the browser console for debug messages</li>
              <li>• Try refreshing the page if the extension doesn't respond</li>
              <li>• Check the "Debug Info" section in the signature pad modal</li>
            </ul>
          </div>
        </div>

        <div>
          <TopazDiagnostic />
        </div>
      </div>

      {showSignaturePad && (
        <SignaturePad
          onSignatureComplete={handleSignatureComplete}
          onCancel={() => setShowSignaturePad(false)}
          shareholderName="Test User"
        />
      )}
    </div>
  );
} 