# PDF upload – message flow

**Endpoints:** Upload → `UPLOAD_URL` (with header `X-ACCESS-TOKEN`); then POST to metadata URL with `{ sha256, filename }`; view URL = `VIEW_URL_BASE/{sha256}`. See `pdf-upload-spec.md` for variable definitions and full API.

When a PDF is shared and uploaded, the Share Extension and Web Extension run in **separate processes**. The Share Extension never sends a message to the Web Extension. The Web Extension learns about the new URL only when something triggers a read from the app group.

**Where the PDF URL is shown:** Only in the **popup** (Shared PDF section). The content overlay does **not** display the PDF URL.

**Share Extension:** Handles **local PDFs only** (file URL and PDF type from the system share sheet). It does **not** handle web URLs or fetch PDFs from the network.

---

## 1. PDF upload (Share Extension – local PDFs only)

```
┌─────────────────┐     POST /upload      ┌──────────────┐
│  User shares    │ ──────────────────►   │ Local server │
│  PDF (system    │     multipart PDF     │ :5001        │
│  share sheet)   │                       └──────┬───────┘
└────────┬────────┘                              │
         │                                       │ 201 + { sha256 }
         ▼                                       ▼
┌─────────────────────────┐              ┌────────────────────────┐
│  Share Extension        │              │  Build view URL        │
│  (ShareViewController)  │ ◄─────────── │  Save to App Group     │
│  separate process       │   in memory  │  UserDefaults          │
└─────────────────────────┘              │  key: lastSharedPdfUrl │
         │                               └────────────────────────┘
         │  (no message to Web Extension)
         ▼
   Dismiss share UI
   User returns to Safari
```

The Web Extension (background, popup) is **not** notified when the upload succeeds.

---

## 2. PDF upload (Popup – online PDFs from cache)

When the current tab is an online PDF, the user can click **Upload current PDF** in the popup. The extension uses the **cached** response (no re-request of the PDF):

```
Popup                    Background                   Content script (tab)     Native
  │                          │                              │                    │
  │  uploadCurrentTabPdf      │                              │                    │
  │ ───────────────────────► │  getPagePdfFromCache          │                    │
  │                          │ ───────────────────────────► │ fetch(force-cache)  │
  │                          │  { pdfBase64 }                │                    │
  │                          │ ◄────────────────────────────│                    │
  │                          │  POST /upload (multipart)     │                    │
  │                          │ ───────────────────────────► Server :5001         │
  │                          │  { sha256 }                   │                    │
  │                          │  setSharedPdfUrl { pdfUrl }   │                    │
  │                          │ ───────────────────────────────────────────────► │ UserDefaults set
  │                          │  { ok }                      │                    │
  │  { ok, pdfUrl }           │ ◄─────────────────────────────────────────────── │
  │ ◄─────────────────────── │                              │                    │
  │  refresh Shared PDF UI   │                              │                    │
```

The popup then shows the new URL in the Shared PDF section (same as after a share-extension upload). The app group key `lastSharedPdfUrl` is written by the **native handler** when it receives `setSharedPdfUrl` from the background (after the background has uploaded the PDF to the local server).

---

## 3. How the Web Extension gets the PDF URL

All reads go through the **native message handler**, which reads from the **App Group**. Only the **popup** requests and displays the PDF URL.

### 3a. Popup opens or clicks “Refresh”

```
Popup                    Background                   Native (Safari app)
  │                          │                              │
  │  sendMessage             │                              │
  │  { type: 'getSharedFile' }                              │
  │ ───────────────────────► │  sendNativeMessage           │
  │                          │  { type: 'getSharedFile' }   │
  │                          │ ───────────────────────────► │ SafariWebExtensionHandler
  │                          │                              │   reads UserDefaults(suite: appGroup)
  │                          │  { pdfUrl }                  │   key: lastSharedPdfUrl
  │                          │ ◄────────────────────────────│
  │  { pdfUrl }              │                              │
  │ ◄─────────────────────── │  sendResponse                │
  │  popup shows URL or "—"  │                              │
```

### 3b. User clicks “Clear URL”

```
Popup                    Background                       Native
  │                          │                              │
  │  sendMessage             │                              │
  │  { type: 'clearSharedFile' }                            │
  │ ───────────────────────► │  sendNativeMessage           │
  │                          │  { type: 'clearSharedFile' } │
  │                          │ ───────────────────────────► │ removeObject(forKey: lastSharedPdfUrl)
  │                          │  { ok: true }                │
  │  { ok }                  │ ◄────────────────────────────│
  │ ◄─────────────────────── │                              │
  │  updateSharedPdfDisplay(null)                           │
  │                          │  (Background also sends      │
  │                          │   sharedFileUpdated to tabs; │
  │                          │   no listener, no-op)        │
```

---

## Summary

| Event                        | Who reacts              | Effect                                      |
|------------------------------|-------------------------|---------------------------------------------|
| PDF uploaded (Share success)       | No message to Web Ext     | —                                           |
| User clicks "Upload current PDF"   | Popup → Background → Native | PDF from cache uploaded; URL stored in app group |
| User opens popup                   | Popup `getSharedFile`     | Popup shows URL or "—"                      |
| User clicks “Refresh”        | Same                    | Popup refreshes display                     |
| User clicks “Clear URL”      | Native clears app group | Popup shows "—"                             |

**Shared storage:** App Group `UserDefaults` (suite: `group.com.powernotes.safari-demo-extension`), key `lastSharedPdfUrl`. Written by Share Extension (local PDFs) or by SafariWebExtensionHandler when it receives `setSharedPdfUrl` (after popup upload of online PDF). Read/cleared by SafariWebExtensionHandler on behalf of the Web Extension.

---

## App Group and native messaging (macOS vs iOS)

We **do** use App Groups on macOS the same way as on iOS: the Share Extension writes the view URL to `UserDefaults(suiteName: appGroupSuiteName)`, and the native handler reads it. All three targets (main app, Safari Extension, Share Extension) have the app group entitlement.

The Web Extension side (popup/background) is **JavaScript** and has no API to read `UserDefaults` or the app group container. The only way to get the URL from the app group into the popup is for **native code** to read it and return it. So we use **native messaging**: the background script calls `sendNativeMessage`, which invokes the native handler (`SafariWebExtensionHandler`); the handler reads `UserDefaults(suiteName: appGroupSuiteName)` and returns `{ pdfUrl }`. There is no “read app group directly from the Safari extension” from JS—only the native handler can read the app group.

On **iOS**, that flow does not trigger a permission prompt. On **macOS**, when the native message is handled (whether in the extension process or the containing app), the system can show “Safari Demo Extension would like to access data from other apps,” so the prompt is from **invoking native messaging / app group access**, not from avoiding App Groups. The popup calls `getSharedFile` when it opens (so the Shared PDF section shows the URL or “—” immediately); on macOS, opening the popup can therefore trigger the permission prompt.

### Where the macOS prompt comes from (diagram)

Same architecture on both platforms; the only difference is whether the system shows a permission prompt.

```
                    ┌─────────────────────────────────────────────────────────┐
                    │  App Group (UserDefaults)                                 │
                    │  suite: group.com.powernotes.safari-demo-extension        │
                    │  key: lastSharedPdfUrl                                    │
                    └────────────▲──────────────────────────▲──────────────────┘
                                 │ write                    │ read
                    Share Extension                          Native handler
                    (after upload)                           (SafariWebExtensionHandler)
                                                             │
                                                             │ return pdfUrl
                                                             │
  Popup/Background (JS)  ──── sendNativeMessage ────────────►│
       │                         ▲                           │
       │                         │                           │
       │                    ⚠️ PROMPT ON macOS               │
       │                    ("access data from other apps")   │
       │                    Not from App Group read —        │
       │                    from this JS → native bridge.    │
       │                                                      │
       │  ◄─── response { pdfUrl } ───────────────────────────┘
```

| Platform | App Group read | JS → native (sendNativeMessage) |
|----------|----------------|---------------------------------|
| **iOS**  | No prompt      | No prompt                       |
| **macOS**| No prompt      | **Prompt shown here**           |

So: the prompt is triggered by the **JS → native bridge** when the extension calls `sendNativeMessage`, not by reading the App Group itself. Both platforms use the same App Group; only macOS surfaces a permission dialog at the bridge.
