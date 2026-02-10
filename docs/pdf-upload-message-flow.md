# PDF upload – message flow

When a PDF is shared and uploaded, the Share Extension and Web Extension run in **separate processes**. The Share Extension never sends a message to the Web Extension. The Web Extension learns about the new URL only when something triggers a read from the app group.

**Where the PDF URL is shown:** Only in the **popup** (Shared PDF section). The content overlay does **not** display the PDF URL.

---

## 1. PDF upload (Share Extension only)

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

## 2. How the Web Extension gets the PDF URL

All reads go through the **native message handler**, which reads from the **App Group**. Only the **popup** requests and displays the PDF URL.

### 2a. Popup opens or clicks “Refresh”

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

### 2b. User clicks “Clear URL”

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
| PDF uploaded (Share success) | No message to Web Ext   | —                                           |
| User opens popup             | Popup `getSharedFile`   | Popup shows URL or "—"                      |
| User clicks “Refresh”        | Same                    | Popup refreshes display                     |
| User clicks “Clear URL”      | Native clears app group | Popup shows "—"                             |

**Shared storage:** App Group `UserDefaults` (suite: `group.com.powernotes.safari-demo-extension`), key `lastSharedPdfUrl`. Written by Share Extension; read/cleared by SafariWebExtensionHandler on behalf of the Web Extension.
