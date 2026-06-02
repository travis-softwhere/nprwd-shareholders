"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";

export type SignaturePadContext = {
  shareholderName?: string;
  shareholderId?: string;
  designeeName?: string | null;
  mailingAddress?: string | null;
  cityStateZip?: string | null;
  /** When checking in a single property, show its service address. */
  propertyServiceAddress?: string | null;
  totalProperties?: number;
  checkedInProperties?: number;
};

interface SignaturePadProps extends SignaturePadContext {
  onSignatureComplete: (signatureImage: string, signatureHash: string) => void | Promise<void>;
  onCancel: () => void;
}

function formatMailingLines(mailingAddress?: string | null, cityStateZip?: string | null): string | null {
  const line1 = mailingAddress?.trim();
  const line2 = cityStateZip?.trim();
  if (line1 && line2) return `${line1}\n${line2}`;
  return line1 || line2 || null;
}

function ShareholderContextPanel({
  shareholderName,
  designeeName,
  designeeLoading,
  mailingLines,
  propertyServiceAddress,
  totalProperties,
  checkedInProperties,
}: {
  shareholderName?: string;
  designeeName: string | null;
  designeeLoading?: boolean;
  mailingLines: string | null;
  propertyServiceAddress?: string | null;
  totalProperties?: number;
  checkedInProperties?: number;
}) {
  return (
    <div className="mb-4 space-y-3 rounded-md border border-blue-100 bg-blue-50/80 p-3 text-sm">
      {shareholderName ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Benefit unit owner
          </p>
          <p className="text-base font-semibold text-foreground">{shareholderName}</p>
          {typeof totalProperties === "number" && totalProperties > 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{totalProperties}</span>{" "}
              {totalProperties === 1 ? "property" : "properties"}
              {typeof checkedInProperties === "number" && checkedInProperties > 0
                ? ` · ${checkedInProperties} already checked in`
                : null}
            </p>
          ) : null}
        </div>
      ) : null}
      {mailingLines ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Mailing address
          </p>
          <p className="whitespace-pre-line text-foreground">{mailingLines}</p>
        </div>
      ) : null}
      {propertyServiceAddress?.trim() ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Property
          </p>
          <p className="text-foreground">{propertyServiceAddress.trim()}</p>
        </div>
      ) : null}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Designee (ballot holder)
        </p>
        <p
          className={
            designeeLoading
              ? "text-muted-foreground"
              : designeeName
                ? "font-medium text-foreground"
                : "text-muted-foreground italic"
          }
        >
          {designeeLoading
            ? "Loading…"
            : designeeName ?? "Not set — owner signs for themself"}
        </p>
      </div>
    </div>
  );
}

type PadPhase =
  | "initializing"
  | "waiting"
  | "capturing"
  | "review"
  | "submitting"
  | "unavailable"
  | "error";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage: string,
): Promise<T> {
  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(timeoutMessage)), ms);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

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

function getTopazGlobal(): TopazGlobal | null {
  return (window as unknown as { Topaz?: { Global?: TopazGlobal } }).Topaz?.Global ?? null;
}

async function waitForTopazGlobal(maxMs = 10_000): Promise<TopazGlobal> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const global = getTopazGlobal();
    if (global) return global;
    await delay(150);
  }
  throw new Error(
    "Topaz API did not become available. Wait a few seconds, then tap Retry.",
  );
}

async function loadTopazWrapper(wrapperUrl: string): Promise<void> {
  let script = document.getElementById("topaz-wrapper-script") as HTMLScriptElement | null;
  if (!script) {
    await new Promise<void>((resolve, reject) => {
      script = document.createElement("script");
      script.id = "topaz-wrapper-script";
      script.src = wrapperUrl;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load SigPlus wrapper."));
      document.head.appendChild(script);
    });
  }
  await waitForTopazGlobal(15_000);
}

/** Best-effort release; never blocks longer than a few seconds. */
async function disconnectTopazSafely() {
  const signCapture = getTopazSignCapture();
  if (signCapture) {
    try {
      await withTimeout(
        signCapture.SignComplete().catch(() => undefined),
        2_500,
        "SignComplete timed out",
      );
    } catch {
      // Continue — extension may be idle.
    }
  }

  const global = getTopazGlobal();
  if (global) {
    try {
      await withTimeout(global.Disconnect(), 2_500, "Disconnect timed out");
    } catch {
      // Pad may already be disconnected.
    }
  }

  await delay(150);
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
  shareholderId,
  designeeName: designeeNameProp,
  mailingAddress,
  cityStateZip,
  propertyServiceAddress,
  totalProperties,
  checkedInProperties,
}: SignaturePadProps) {
  const [phase, setPhase] = useState<PadPhase>("initializing");
  const [statusMessage, setStatusMessage] = useState("Connecting to signature pad…");
  const [error, setError] = useState<string | null>(null);
  const [fetchedDesignee, setFetchedDesignee] = useState<string | null | undefined>(undefined);
  const [pendingSignature, setPendingSignature] = useState<{
    image: string;
    hash: string;
  } | null>(null);
  const cancelledRef = useRef(false);

  const mailingLines = formatMailingLines(mailingAddress, cityStateZip);

  useEffect(() => {
    if (!shareholderId || designeeNameProp !== undefined) return;

    let cancelled = false;
    fetch(`/api/designee?shareholderId=${encodeURIComponent(shareholderId)}`)
      .then((res) => (res.ok ? res.json() : { designee: null }))
      .then((data: { designee?: string | null }) => {
        if (!cancelled) {
          setFetchedDesignee(data.designee?.trim() || null);
        }
      })
      .catch(() => {
        if (!cancelled) setFetchedDesignee(null);
      });

    return () => {
      cancelled = true;
    };
  }, [shareholderId, designeeNameProp]);

  const designeeLoading =
    shareholderId != null && designeeNameProp === undefined && fetchedDesignee === undefined;

  const designeeName =
    designeeNameProp !== undefined
      ? designeeNameProp?.trim() || null
      : fetchedDesignee === undefined
        ? null
        : fetchedDesignee;

  const finishCapture = useCallback(async (signCapture: TopazSignCapture) => {
    const raw = await signCapture.GetSignatureImage();
    await signCapture.SignComplete().catch(() => undefined);
    await disconnectTopazSafely();

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
    if (cancelledRef.current) return;

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

    await withTimeout(signCapture.SetImageDetails(2, 500, 100, false, false, 25), 8_000, "Timed out starting signature capture.");
    await withTimeout(signCapture.SetPenDetails("#000000", 2), 5_000, "Timed out configuring pen.");
    await withTimeout(signCapture.SetMinSigPoints(25), 5_000, "Timed out configuring signature pad.");
    await withTimeout(signCapture.StartSign(false, 1, 0, ""), 10_000, "Timed out opening the signature window. Close other SigPlus windows and tap Retry.");

    await waitForPadSignature(signCapture);
  }, [waitForPadSignature]);

  const initializeTopaz = useCallback(async () => {
    if (cancelledRef.current) return;

    const wrapperUrl = document.documentElement.getAttribute("SigPlusExtLiteWrapperURL");
    if (!wrapperUrl) {
      setPhase("unavailable");
      setError(
        "SigPlus browser extension not detected. Install it and allow this site, then try check-in again.",
      );
      return;
    }

    setPhase("initializing");
    setError(null);
    setStatusMessage("Loading SigPlus…");

    await loadTopazWrapper(wrapperUrl);
    if (cancelledRef.current) return;

    setStatusMessage("Preparing signature pad…");
    try {
      await disconnectTopazSafely();
    } catch {
      // Non-fatal — continue to connect.
    }
    if (cancelledRef.current) return;

    const global = getTopazGlobal();
    if (!global) {
      setPhase("unavailable");
      setError(
        "SigPlus wrapper loaded but Topaz API is unavailable. Wait a few seconds and tap Retry.",
      );
      return;
    }

    setStatusMessage("Checking signature pad…");
    const deviceStatus = await withTimeout(
      global.GetDeviceStatus(),
      8_000,
      "Timed out checking the signature pad. Confirm it is plugged in and tap Retry.",
    );
    if (cancelledRef.current) return;

    if (deviceStatus !== 1) {
      setPhase("unavailable");
      setError(
        deviceStatus === 0
          ? "No Topaz signature pad detected. Connect the pad via USB and try again."
          : "Topaz pad or drivers are not ready. Check the device and SigPlus installation.",
      );
      return;
    }

    setStatusMessage("Connecting to signature pad…");
    await withTimeout(
      global.Connect(),
      12_000,
      "Timed out connecting to the signature pad. Close any other SigPlus window, then tap Retry.",
    );
    if (cancelledRef.current) return;

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
      void disconnectTopazSafely();
    };
    // Run once per mount; parent remounts via key when opening check-in again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = () => {
    cancelledRef.current = true;
    void disconnectTopazSafely().finally(() => onCancel());
  };

  const handleSignAgain = async () => {
    cancelledRef.current = false;
    setPendingSignature(null);
    setError(null);
    setPhase("initializing");
    setStatusMessage("Preparing signature pad…");
    try {
      await disconnectTopazSafely();
    } catch {
      // Continue.
    }
    initializeTopaz().catch((err) => {
      if (cancelledRef.current) return;
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
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signature-pad-title"
    >
      <div className="pointer-events-auto flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl sm:max-w-lg">
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3 sm:px-6">
          <h2 id="signature-pad-title" className="text-lg font-semibold">
            {phase === "review" ? "Confirm signature" : "Sign to check in"}
          </h2>
          <Button variant="ghost" size="sm" onClick={handleCancel} disabled={!canClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <ShareholderContextPanel
            shareholderName={shareholderName}
            designeeName={designeeName}
            designeeLoading={designeeLoading}
            mailingLines={mailingLines}
            propertyServiceAddress={propertyServiceAddress}
            totalProperties={totalProperties}
            checkedInProperties={checkedInProperties}
          />

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
    </div>
  );
}
