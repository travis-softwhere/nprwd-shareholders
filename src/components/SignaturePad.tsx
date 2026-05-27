"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";

interface SignaturePadProps {
  onSignatureComplete: (signatureImage: string, signatureHash: string) => void | Promise<void>;
  onCancel: () => void;
  shareholderName?: string;
}

type PadPhase =
  | "initializing"
  | "waiting"
  | "capturing"
  | "review"
  | "submitting"
  | "unavailable"
  | "error";

let topazWrapperLoaded = false;

async function hashImageData(imageData: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(imageData);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getTopazSignCapture(): TopazSignCapture | null {
  const topaz = (window as unknown as { Topaz?: { SignatureCaptureWindow?: { Sign?: TopazSignCapture } } })
    .Topaz;
  return topaz?.SignatureCaptureWindow?.Sign ?? null;
}

function disconnectTopaz() {
  const topaz = (window as unknown as { Topaz?: { Global?: TopazGlobal } }).Topaz;
  topaz?.Global?.Disconnect().catch(() => undefined);
}

interface TopazGlobal {
  Connect(): Promise<number>;
  Disconnect(): Promise<number>;
  GetDeviceStatus(): Promise<number>;
}

interface TopazSignCapture {
  SetImageDetails(
    format: number,
    width: number,
    height: number,
    transparency: boolean,
    scaling: boolean,
    maxUpScalePercent: number,
  ): Promise<number>;
  SetPenDetails(colorcode: string, thickness: number): Promise<number>;
  SetMinSigPoints(points: number): Promise<number>;
  StartSign(
    showCustomWindow?: boolean,
    sigCompressionMode?: number,
    encryptionMode?: number,
    encryptionKey?: string,
  ): Promise<void>;
  IsSigned(): Promise<boolean>;
  SignComplete(): Promise<void>;
  GetSignatureImage(): Promise<string>;
}

export default function SignaturePad({
  onSignatureComplete,
  onCancel,
  shareholderName,
}: SignaturePadProps) {
  const [phase, setPhase] = useState<PadPhase>("initializing");
  const [statusMessage, setStatusMessage] = useState("Connecting to signature pad…");
  const [error, setError] = useState<string | null>(null);
  const [pendingSignature, setPendingSignature] = useState<{
    image: string;
    hash: string;
  } | null>(null);
  const cancelledRef = useRef(false);

  const finishCapture = useCallback(async (signCapture: TopazSignCapture) => {
    const raw = await signCapture.GetSignatureImage();
    await signCapture.SignComplete().catch(() => undefined);
    disconnectTopaz();

    if (!raw) {
      throw new Error("No signature received from the pad.");
    }

    const signatureImage = raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`;
    const signatureHash = await hashImageData(signatureImage);

    setPendingSignature({ image: signatureImage, hash: signatureHash });
    setError(null);
    setStatusMessage("Review your signature below.");
    setPhase("review");
  }, []);

  const waitForPadSignature = useCallback(
    async (signCapture: TopazSignCapture) => {
      setPhase("capturing");
      setStatusMessage("Sign on the Topaz pad now.");

      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        if (cancelledRef.current) {
          await signCapture.SignComplete().catch(() => undefined);
          return;
        }

        const signed = await signCapture.IsSigned();
        if (signed) {
          await finishCapture(signCapture);
          return;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 400));
      }

      await signCapture.SignComplete().catch(() => undefined);
      throw new Error("Signature timed out. Try again.");
    },
    [finishCapture],
  );

  const runTopazCapture = useCallback(async () => {
    const signCapture = getTopazSignCapture();
    if (!signCapture) {
      setPhase("unavailable");
      setError(
        "Topaz signature pad is not available. Install the SigPlus browser extension, connect the pad, and refresh.",
      );
      return;
    }

    setPhase("waiting");
    setStatusMessage("Ready — sign on the Topaz pad.");

    await signCapture.SetImageDetails(2, 500, 100, false, false, 25);
    await signCapture.SetPenDetails("#000000", 2);
    await signCapture.SetMinSigPoints(25);
    await signCapture.StartSign(false, 1, 0, "");

    await waitForPadSignature(signCapture);
  }, [waitForPadSignature]);

  const initializeTopaz = useCallback(async () => {
    const wrapperUrl = document.documentElement.getAttribute("SigPlusExtLiteWrapperURL");
    if (!wrapperUrl) {
      setPhase("unavailable");
      setError(
        "SigPlus browser extension not detected. Install it and allow this site, then try check-in again.",
      );
      return;
    }

    if (!topazWrapperLoaded) {
      const existing = document.getElementById("topaz-wrapper-script");
      if (!existing) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.id = "topaz-wrapper-script";
          script.src = wrapperUrl;
          script.onload = () => {
            topazWrapperLoaded = true;
            resolve();
          };
          script.onerror = () => reject(new Error("Failed to load SigPlus wrapper."));
          document.head.appendChild(script);
        });
      } else {
        topazWrapperLoaded = true;
      }
    }

    const topaz = (window as unknown as { Topaz?: { Global?: TopazGlobal } }).Topaz;
    if (!topaz?.Global) {
      setPhase("unavailable");
      setError("SigPlus wrapper loaded but Topaz API is unavailable.");
      return;
    }

    const deviceStatus = await topaz.Global.GetDeviceStatus();
    if (deviceStatus !== 1) {
      setPhase("unavailable");
      setError(
        deviceStatus === 0
          ? "No Topaz signature pad detected. Connect the pad via USB and try again."
          : "Topaz pad or drivers are not ready. Check the device and SigPlus installation.",
      );
      return;
    }

    await topaz.Global.Connect();
    setStatusMessage("Signature pad connected.");
    await runTopazCapture();
  }, [runTopazCapture]);

  useEffect(() => {
    cancelledRef.current = false;

    initializeTopaz().catch((err) => {
      if (cancelledRef.current) return;
      setPhase("error");
      setError(err instanceof Error ? err.message : "Could not start signature capture.");
    });

    return () => {
      cancelledRef.current = true;
      disconnectTopaz();
    };
  }, [initializeTopaz]);

  const handleCancel = () => {
    cancelledRef.current = true;
    const signCapture = getTopazSignCapture();
    signCapture?.SignComplete().catch(() => undefined);
    disconnectTopaz();
    onCancel();
  };

  const handleSignAgain = () => {
    cancelledRef.current = false;
    setPendingSignature(null);
    setError(null);
    setPhase("initializing");
    setStatusMessage("Connecting to signature pad…");
    initializeTopaz().catch((err) => {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Could not start signature capture.");
    });
  };

  const handleConfirm = async () => {
    if (!pendingSignature) return;

    setPhase("submitting");
    setStatusMessage("Saving check-in…");
    setError(null);

    try {
      await onSignatureComplete(pendingSignature.image, pendingSignature.hash);
    } catch (err) {
      setPhase("review");
      setStatusMessage("Review your signature below.");
      setError(err instanceof Error ? err.message : "Could not save check-in.");
    }
  };

  const showSpinner =
    phase === "initializing" ||
    phase === "waiting" ||
    phase === "capturing" ||
    phase === "submitting";

  const canClose = phase !== "submitting";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {phase === "review" ? "Confirm signature" : "Sign to check in"}
          </h2>
          <Button variant="ghost" size="sm" onClick={handleCancel} disabled={!canClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {shareholderName ? (
          <p className="mb-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{shareholderName}</span>
          </p>
        ) : null}

        {phase === "review" && pendingSignature ? (
          <div className="mb-4 flex flex-col gap-3">
            <p className="text-sm text-gray-700">
              Signature recorded on the pad. Confirm it looks correct before checking in.
            </p>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pendingSignature.image}
                alt="Captured signature"
                className="mx-auto max-h-28 w-full object-contain"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            {showSpinner ? <Loader2 className="h-10 w-10 animate-spin text-blue-600" /> : null}
            <p className="text-sm text-gray-700">{error ?? statusMessage}</p>
            {phase === "capturing" ? (
              <p className="text-xs text-muted-foreground">
                Use the physical Topaz pad only — mouse signing is disabled.
              </p>
            ) : null}
          </div>
        )}

        {error && phase === "review" ? (
          <p className="mb-3 text-center text-sm text-red-600">{error}</p>
        ) : null}

        {phase === "review" ? (
          <div className="flex flex-col gap-2">
            <Button className="w-full" onClick={handleConfirm}>
              Confirm & check in
            </Button>
            <Button variant="outline" className="w-full" onClick={handleSignAgain}>
              Sign again
            </Button>
            <Button variant="ghost" className="w-full" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        ) : phase === "error" || phase === "unavailable" ? (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setError(null);
                setPendingSignature(null);
                setPhase("initializing");
                setStatusMessage("Connecting to signature pad…");
                initializeTopaz().catch((err) => {
                  setPhase("error");
                  setError(err instanceof Error ? err.message : "Could not start signature capture.");
                });
              }}
            >
              Retry
            </Button>
          </div>
        ) : phase === "submitting" ? null : (
          <Button variant="outline" className="w-full" onClick={handleCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
