import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TopazDiagnostic() {
  const [diagnostics, setDiagnostics] = useState<any>({});
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const results: any = {};

    // 1. Check for SigPlusExtLite global object
    results.sigPlusExtLite = typeof window.SigPlusExtLite !== 'undefined';
    if (results.sigPlusExtLite) {
      results.sigPlusExtLiteObject = window.SigPlusExtLite;
    }

    // 2. Check for SigCapture attribute
    results.sigCaptureAttribute = document.documentElement.hasAttribute('SigCapture');

    // 3. Check for related properties
    results.hasProperties = 'SigPlusExtLite' in window || 'sigPlusExtLite' in window;

    // 4. Check browser information
    results.userAgent = navigator.userAgent;
    results.platform = navigator.platform;

    // 5. Check for USB devices (if possible)
    try {
      if ('usb' in navigator) {
        results.usbSupported = true;
        // Note: This requires HTTPS and user permission
      } else {
        results.usbSupported = false;
      }
    } catch (e) {
      results.usbSupported = false;
      results.usbError = e.message;
    }

    // 6. Test event dispatching
    let eventReceived = false;
    const testEvent = new CustomEvent('TestEvent', { detail: 'test' });
    
    const eventListener = () => {
      eventReceived = true;
    };
    
    document.addEventListener('TestEvent', eventListener);
    document.dispatchEvent(testEvent);
    document.removeEventListener('TestEvent', eventListener);
    
    results.eventDispatching = eventReceived;

    // 7. Check for any existing event listeners
    results.existingListeners = [];
    try {
      // This is a bit of a hack to check if there are any listeners
      const originalAddEventListener = EventTarget.prototype.addEventListener;
      let listenerCount = 0;
      
      EventTarget.prototype.addEventListener = function(type, listener, options) {
        listenerCount++;
        return originalAddEventListener.call(this, type, listener, options);
      };
      
      // Trigger a test
      const testEvent2 = new CustomEvent('SignStartEvent', { detail: 'test' });
      document.dispatchEvent(testEvent2);
      
      EventTarget.prototype.addEventListener = originalAddEventListener;
      results.listenerCount = listenerCount;
    } catch (e) {
      results.listenerError = e.message;
    }

    setDiagnostics(results);
    setIsRunning(false);
  };

  const testDirectCall = () => {
    if (typeof window.SigPlusExtLite !== 'undefined') {
      try {
        console.log('Attempting direct SigPlusExtLite call...');
        window.SigPlusExtLite.startCapture({
          imageFormat: 'png',
          imageX: 500,
          imageY: 100,
          imageTransparency: false,
          imageScaling: false,
          maxUp: 0,
          rawDataFormat: 'ENC',
          minSigPoints: 25,
          returnFormat: 'base64'
        });
        alert('Direct call made successfully. Check console for any errors.');
      } catch (error) {
        alert(`Direct call failed: ${error.message}`);
      }
    } else {
      alert('SigPlusExtLite not available');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Topaz Signature Pad Diagnostics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={runDiagnostics} 
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? "Running Diagnostics..." : "Run Diagnostics"}
          </Button>

          <Button 
            onClick={testDirectCall}
            variant="outline"
            className="w-full"
          >
            Test Direct SigPlusExtLite Call
          </Button>

          {Object.keys(diagnostics).length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Diagnostic Results:</h3>
              <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
                {JSON.stringify(diagnostics, null, 2)}
              </pre>
            </div>
          )}

          <div className="mt-4 p-4 bg-blue-50 rounded">
            <h3 className="font-semibold mb-2">Troubleshooting Steps:</h3>
            <ol className="text-sm space-y-1">
              <li>1. Ensure Topaz signature pad is connected via USB</li>
              <li>2. Verify SigPlusExtLite browser extension is installed and enabled</li>
              <li>3. Try refreshing the page after connecting the device</li>
              <li>4. Check if the extension requires specific permissions</li>
              <li>5. Try a different USB port</li>
              <li>6. Check Windows Device Manager for the signature pad</li>
              <li>7. Try a different browser (Chrome, Firefox, Edge)</li>
              <li>8. Restart the browser after connecting the device</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 