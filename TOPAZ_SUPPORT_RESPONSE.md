Subject: Re: Topaz SigPlusExtLite Extension Domain Registration Request

Hi Jeff,

Thank you for your response. I've conducted comprehensive testing using the proper Topaz extension detection methods from your documentation, and I now have clear evidence of what's happening.

DEVELOPMENT ENVIRONMENT:
- Domain: localhost:3000
- Browser: Chrome (latest version)
- Development Environment: Next.js React application running on localhost during development

TECHNICAL EVIDENCE:

Based on my application's debug logs using the proper Topaz extension detection method from your documentation, here's exactly what's happening:

EXTENSION DETECTION RESULTS:
Current domain: localhost (during development)
Current URL: http://localhost:3000/shareholders/1
User agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...
SigPlusExtLiteExtension-installed attribute: true
Topaz extension detected as installed
window.SigPlusExtLite exists: false
window.sigPlusExtLite exists: false
Requesting Topaz version information...
Requesting device status...
Topaz version info response: {"spelVersion":"3.2.5.0","status":1,"errorMsg":null}
Device status response: {"deviceStatus":1,"errorMsg":null}
Testing if Topaz extension is listening for events on this domain...
TestTopazEvent was NOT handled - Topaz extension may not be listening for events on this domain

EXTENSION INSTALLATION STATUS:
- The Topaz SigPlusExtLite browser extension is installed and enabled in Chrome
- The extension works perfectly on https://www.sigplusweb.com/SigPlusExtLite/v3/Demo/sign_chrome_ff_sigplusextlite.html
- NEW FINDING: The extension IS detected on my domain (SigPlusExtLiteExtension-installed attribute: true)
- NEW FINDING: Version 3.2.5.0 is detected and working
- NEW FINDING: Topaz signature pad is connected and detected (deviceStatus:1)
- CRITICAL ISSUE: The Topaz extension is NOT listening for events on my domain

CODE IMPLEMENTATION:
My application correctly implements the SigPlusExtLite interface using your documented methods:

// Proper extension detection (from your documentation)
var isInstalled = document.documentElement.getAttribute('SigPlusExtLiteExtension-installed');
if (!isInstalled) {
  // Extension not available
}

// Version info request (from your documentation)
var versionInfo = { "metadata": { "version": 1.0, "command": "GetVersionInfo" } };
var versionInfoData = JSON.stringify(versionInfo);
var element = document.createElement("MyExtensionDataElementVersionInfo");
element.setAttribute("msgAttributeVersionInfo", versionInfoData);
element.setAttribute("msg-Attribute-VersionInfo", versionInfoData);
document.documentElement.appendChild(element);
var evt = document.createEvent('Events');
evt.initEvent('GetVersionInfoEvent', true, false);
element.dispatchEvent(evt);

// Device status request (from your documentation)
var deviceStatus = { 
  "metadata": {"version": 1.0, "command": "GetDeviceStatus"},
  "deviceStatus": "" 
};

KEY FINDING:
The issue is now clear: The Topaz SigPlusExtLite extension IS working on my domain - it's detected, version info is retrieved, and the signature pad is connected. However, the extension is NOT listening for any events on my domain, even though these same events work on sigplusweb.com.

SPECIFIC QUESTIONS:

1. Event Listening Issue: Why is the Topaz extension not listening for events on my domain when it responds to version and device status requests?

2. Domain Restrictions: Are there specific domain restrictions that prevent the extension from listening for events, even when the extension is installed and functional?

3. Event Listening: Does the Topaz extension only listen for events on whitelisted domains?

4. Alternative Integration Methods: What are the recommended methods for integrating signature capture when the extension doesn't listen for events on custom domains?

5. Domain Registration: How do I register *.soft-where.com to have full access to event listening?

CURRENT WORKAROUND:
My application currently falls back to canvas-based signature capture when the Topaz extension doesn't listen for events, but I need the hardware signature pad functionality for production use.

REQUEST:
I would appreciate a callback to discuss the event listening issue and best practices for integrating the Topaz signature pad with custom web applications.

CONTACT INFORMATION:
- Email: travissmith@soft-where.com
- Phone: 406-740-0391
- Preferred callback time: Before 3:00 PM

Thank you for your assistance!

Best regards,
Travis Smith 