import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface SignaturePadProps {
  onSignatureComplete: (signatureImage: string, signatureHash: string) => void;
  onCancel: () => void;
  shareholderName?: string;
}

// Topaz type declarations
interface TopazGlobal {
  Connect(): Promise<number>;
  Disconnect(): Promise<number>;
  GetSigPlusExtLiteVersion(): Promise<string>;
  GetSigPlusExtLiteNMHVersion(): Promise<string>;
  GetSigPlusActiveXVersion(): Promise<string>;
  GetDeviceStatus(): Promise<number>;
  GetLastError(): Promise<string>;
}

interface TopazSignatureCaptureWindowSign {
  SetImageDetails(format: number, width: number, height: number, transparency: boolean, scaling: boolean, maxUpScalePercent: number): Promise<number>;
  SetPenDetails(colorcode: string, thickness: number): Promise<number>;
  SetMinSigPoints(points: number): Promise<number>;
  StartSign(showCustomWindow?: boolean, sigCompressionMode?: number, encryptionMode?: number, encryptionKey?: string): Promise<void>;
  IsSigned(): Promise<boolean>;
  SignComplete(): Promise<void>;
  LoadSignatureCaptureWindow(showCustomWindow?: boolean): Promise<void>;
  GetSignatureImage(): Promise<string>;
  GetSigString(): Promise<string>;
}

interface TopazSignatureCaptureWindow {
  Sign: TopazSignatureCaptureWindowSign;
}

interface Topaz {
  Global: TopazGlobal;
  SignatureCaptureWindow: TopazSignatureCaptureWindow;
}

// Use type assertion instead of global declaration

// Module-level flag to prevent duplicate script loading
let topazWrapperLoaded = false;

export default function SignaturePad({ onSignatureComplete, onCancel, shareholderName }: SignaturePadProps) {
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingContext, setDrawingContext] = useState<CanvasRenderingContext2D | null>(null);
  const [topazAvailable, setTopazAvailable] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<string>("Unknown");

  // Add debug logging
  const logDebug = (message: string) => {
    console.log(`[SignaturePad] ${message}`);
    setDebugInfo(prev => `${prev}\n${new Date().toLocaleTimeString()}: ${message}`);
  };

  useEffect(() => {
    logDebug("SignaturePad component mounted");
    
    // Initialize canvas for drawing
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        setDrawingContext(ctx);
        logDebug("Canvas initialized for drawing");
      }
    }

    // Load the Topaz JavaScript wrapper
    loadTopazWrapper();
  }, []);

  const loadTopazWrapper = () => {
    try {
      logDebug("Loading Topaz JavaScript wrapper...");
      
      // Check module-level flag first
      if (topazWrapperLoaded) {
        logDebug("Topaz wrapper already loaded (module flag), checking availability");
        checkTopazAvailability();
        return;
      }
      
      // Get the wrapper URL from the extension
      const wrapperUrl = document.documentElement.getAttribute('SigPlusExtLiteWrapperURL');
      logDebug(`Wrapper URL: ${wrapperUrl}`);
      
      // Debug: Check all Topaz-related attributes
      const allAttributes = document.documentElement.attributes;
      logDebug("All Topaz-related attributes on document.documentElement:");
      for (let i = 0; i < allAttributes.length; i++) {
        const attr = allAttributes[i];
        if (attr.name.toLowerCase().includes('sigplus') || attr.name.toLowerCase().includes('topaz')) {
          logDebug(`  ${attr.name}: ${attr.value}`);
        }
      }
      
      if (wrapperUrl) {
        // Check if the script is already loaded to prevent duplicate injection
        const existingScript = document.getElementById('topaz-wrapper-script');
        if (existingScript) {
          logDebug("Topaz wrapper script already exists, skipping injection");
          topazWrapperLoaded = true;
          // If script exists but Topaz object isn't available yet, wait a bit and check
          if (typeof (window as any).Topaz === 'undefined') {
            setTimeout(() => {
              checkTopazAvailability();
            }, 100);
          } else {
            checkTopazAvailability();
          }
          return;
        }
        
        // Use script element approach (safer than document.write)
        logDebug(`Loading Topaz wrapper script from: ${wrapperUrl}`);
        
        try {
          const script = document.createElement('script');
          script.id = 'topaz-wrapper-script'; // Add unique ID to prevent duplicates
          script.src = wrapperUrl;
          script.onload = () => {
            logDebug("Topaz wrapper script loaded successfully");
            topazWrapperLoaded = true;
            checkTopazAvailability();
          };
          script.onerror = (error) => {
            logDebug(`Failed to load Topaz wrapper script: ${error}`);
            setTopazAvailable(false);
          };
          
          // Add the script to the head
          document.head.appendChild(script);
        } catch (scriptError) {
          logDebug(`Error creating/loading script: ${scriptError}`);
          setTopazAvailable(false);
        }
      } else {
        logDebug("No SigPlusExtLiteWrapperURL attribute found - extension may not be installed");
        setTopazAvailable(false);
      }
    } catch (err) {
      logDebug(`Error loading Topaz wrapper: ${err}`);
      setTopazAvailable(false);
    }
  };

  const checkTopazAvailability = async () => {
    try {
      logDebug("Checking Topaz availability...");
      
      // Check if Topaz object is available
      if (typeof (window as any).Topaz !== 'undefined') {
        logDebug("Topaz object found");
        setTopazAvailable(true);
        
        // Get version information
        const version = await (window as any).Topaz.Global.GetSigPlusExtLiteVersion();
        logDebug(`SigPlusExtLite version: ${version}`);
        
        // Get device status
        const status = await (window as any).Topaz.Global.GetDeviceStatus();
        logDebug(`Device status: ${status}`);
        
        // Interpret device status
        let statusText = "Unknown";
        switch (status) {
          case 0:
            statusText = "No device detected";
            break;
          case 1:
            statusText = "Topaz signature pad detected";
            break;
          case 2:
            statusText = "GemView Tablet Display detected";
            break;
          case -1:
            statusText = "Error occurred while detecting device";
            break;
          case -2:
            statusText = "SigPlusExtLite not installed";
            break;
          case -3:
            statusText = "SigPlus drivers not installed";
            break;
          case -4:
            statusText = "Older version of SigPlus installed";
            break;
        }
        setDeviceStatus(statusText);
        
        // Connect to the device
        const connectResult = await (window as any).Topaz.Global.Connect();
        logDebug(`Connection result: ${connectResult}`);
        
      } else {
        logDebug("Topaz object not found");
        setTopazAvailable(false);
      }

    } catch (err) {
      logDebug(`Error checking Topaz availability: ${err}`);
      setTopazAvailable(false);
    }
  };

  const computeHash = async (imageData: string) => {
    try {
      logDebug("Computing hash for signature image");
      const encoder = new TextEncoder();
      const data = encoder.encode(imageData);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      setHash(hashHex);
      logDebug(`Hash computed: ${hashHex.substring(0, 16)}...`);
    } catch (err) {
      logDebug(`Failed to compute hash: ${err}`);
      setError("Failed to compute signature hash");
    }
  };

  const startCapture = async () => {
    logDebug("Starting signature capture...");
    setIsCapturing(true);
    setError(null);
    
    try {
      if (topazAvailable && (window as any).Topaz) {
        logDebug("Using Topaz JavaScript wrapper for signature capture");
        
        // Use the SignatureCaptureWindow.Sign object for signature capture
        const signCapture = (window as any).Topaz.SignatureCaptureWindow.Sign;
        
        // Set image details
        await signCapture.SetImageDetails(2, 500, 100, false, false, 25); // PNG, 500x100, no transparency, no scaling, 25% max upscale
        
        // Set pen details
        await signCapture.SetPenDetails("#000000", 2); // Black pen, 2px thickness
        
        // Set minimum signature points
        await signCapture.SetMinSigPoints(25);
        
        // Start the signature capture
        await signCapture.StartSign(false, 1, 0, ""); // No custom window, lossless compression, no encryption, no key
        
        logDebug("Signature capture started - please sign on the Topaz device");
        
        // Check if signature was successful
        const isSigned = await signCapture.IsSigned();
        if (isSigned) {
          logDebug("Signature captured successfully");
          
          // Get the signature image
          const imageData = await signCapture.GetSignatureImage();
          if (imageData) {
            logDebug("Received signature image from Topaz");
            setSignatureImage(`data:image/png;base64,${imageData}`);
            computeHash(imageData);
            setIsCapturing(false);
            
            // Complete the signature process
            await signCapture.SignComplete();
            return;
          } else {
            logDebug("No signature image received");
            setError("No signature image received from device");
            setIsCapturing(false);
            await signCapture.SignComplete();
            return;
          }
        } else {
          logDebug("Signature capture was not successful");
          setError("Signature capture was not successful");
          setIsCapturing(false);
          await signCapture.SignComplete();
          return;
        }
        
      } else {
        logDebug("Topaz wrapper not available, using canvas fallback");
        // Fallback to canvas drawing
        setIsCapturing(false);
        setError(null);
      }
    } catch (err) {
      logDebug(`Signature capture failed: ${err}`);
      setError(`Signature capture failed: ${err}`);
      setIsCapturing(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingContext) return;
    
    setIsDrawing(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    drawingContext.beginPath();
    drawingContext.moveTo(x, y);
    logDebug(`Started drawing at (${x}, ${y})`);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawingContext) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    drawingContext.lineTo(x, y);
    drawingContext.stroke();
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    logDebug("Finished drawing");
    
    // Convert canvas to image data
    const canvas = canvasRef.current;
    if (canvas) {
      const imageData = canvas.toDataURL('image/png');
      setSignatureImage(imageData);
      computeHash(imageData);
      logDebug("Canvas converted to image data");
    }
  };

  const handleConfirm = () => {
    if (signatureImage && hash) {
      logDebug("Confirming signature");
      onSignatureComplete(signatureImage, hash);
    } else {
      logDebug("Cannot confirm - missing signature or hash");
      setError("Please draw a signature first");
    }
  };

  const handleClear = () => {
    logDebug("Clearing signature");
    setSignatureImage(null);
    setHash(null);
    setError(null);
    
    const canvas = canvasRef.current;
    if (canvas && drawingContext) {
      drawingContext.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Collect Signature</h2>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {shareholderName && (
          <p className="text-sm text-muted-foreground mb-4">
            Signing for: <span className="font-medium">{shareholderName}</span>
          </p>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <Button 
            onClick={startCapture} 
            disabled={isCapturing}
            className="w-full"
          >
            {isCapturing ? "Capturing Signature..." : "Start Signature Capture"}
          </Button>
          
                     {signatureImage ? (
             // Display the captured signature image
             <div className="text-center">
               <div className="text-sm text-gray-600 mb-2">
                 Captured Signature:
               </div>
               <div className="border rounded shadow bg-white p-2">
                 <img 
                   src={signatureImage} 
                   alt="Captured signature" 
                   className="w-full h-40 object-contain"
                   style={{ maxHeight: '160px' }}
                 />
               </div>
             </div>
           ) : (
             // Show canvas for drawing (fallback)
             <>
               <div className="text-center text-sm text-gray-600 mb-2">
                 Draw your signature below:
               </div>
               
               <canvas 
                 ref={canvasRef} 
                 className="border rounded shadow w-full h-40 bg-white cursor-crosshair" 
                 onMouseDown={handleMouseDown}
                 onMouseMove={handleMouseMove}
                 onMouseUp={handleMouseUp}
                 onMouseLeave={handleMouseUp}
                 width={400}
                 height={160}
               />
             </>
           )}
          
          {hash && (
            <div className="text-sm text-muted-foreground">
              Signature Hash: <span className="font-mono break-all text-xs">{hash}</span>
            </div>
          )}
          
          <div className="flex gap-2">
            <Button 
              onClick={handleClear} 
              variant="outline" 
              disabled={!signatureImage}
              className="flex-1"
            >
              Clear
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={!signatureImage || !hash}
              className="flex-1"
            >
              Confirm Signature
            </Button>
          </div>

          {/* Topaz extension status */}
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">📝 Topaz Extension Status</h3>
            <p className="text-xs text-blue-700 mb-2">
              {topazAvailable 
                ? "✅ Topaz JavaScript wrapper loaded - signature pad should be available"
                : "⚠️ Topaz JavaScript wrapper not available - using canvas drawing fallback"
              }
            </p>
            {topazAvailable && (
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• <strong>Wrapper:</strong> Topaz JavaScript wrapper loaded</li>
                <li>• <strong>Device:</strong> {deviceStatus}</li>
                <li>• <strong>Domain:</strong> {window.location.hostname}</li>
                <li>• <strong>Browser:</strong> {navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other'}</li>
              </ul>
            )}
          </div>

          {/* Debug information - remove in production */}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-gray-500">Debug Info</summary>
            <pre className="text-xs bg-gray-100 p-2 rounded mt-2 whitespace-pre-wrap max-h-32 overflow-y-auto">
              {debugInfo || "No debug info yet"}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}