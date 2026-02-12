# PDF Upload Feature — Implementation Spec

This spec describes the PDF upload flow implemented in the Safari Demo extension so it can be reimplemented in another extension (e.g., by another AI agent). It covers: (1) **upload from the current browser tab** (content script → background → server + native host), and (2) **upload from a Share Extension** (native app → server + app group). Optional **native messaging** stores the resulting PDF URL for the host app to use.

---

## 1. Overview

- **Tab upload**: User has a PDF open in a tab. Popup sends a message to background; background asks the content script in that tab to fetch the PDF, chunk it, and send chunks to the background. Background reassembles, POSTs to upload API, then metadata API, then (optionally) stores the view URL via native messaging.
- **Share extension upload**: User shares a PDF from the OS. Share extension uploads the file in one request, calls metadata, then stores the view URL in App Group user defaults (no native messaging from the share extension).
- **Backend**: Two endpoints — upload (binary) and metadata (JSON). View URL is `{VIEW_URL_BASE}/{sha256}`.

---

## 2. Backend API Contract

All requests require authentication via header: `X-ACCESS-TOKEN: <token>`.

### 2.1 Upload endpoint

- **URL**: Configurable; example:  
  `http://files.powernotes.local:8006/v1/projects/{projectId}/documents/uploads`
- **Method**: `POST`
- **Request**:
  - **Headers**:
    - `Content-Type: multipart/form-data; boundary={boundary}`
    - `X-ACCESS-TOKEN: {ACCESS_TOKEN}`
  - **Body**: One multipart part:
    - `name`: `"file"`
    - `filename`: original filename (e.g. `"document.pdf"`)
    - `Content-Type`: `application/pdf`
    - Body: raw PDF bytes (no encoding)
- **Response**: JSON, e.g. `{ "sha256": "<hex string>", "size": number }`
  - **Required**: `sha256` — used to build the view URL and to call the metadata endpoint.
  - Non-2xx or missing `sha256` → treat as upload failure.

### 2.2 Metadata endpoint

- **URL**: Configurable; example:  
  `http://files.powernotes.local:8006/v1/projects/{projectId}/documents/metadata`
- **Method**: `POST`
- **Request**:
  - **Headers**:
    - `Content-Type: application/json`
    - `X-ACCESS-TOKEN: {ACCESS_TOKEN}`
  - **Body**: JSON:
    ```json
    {
      "sha256": "<from upload response>",
      "filename": "<original filename>",
      "headers": { "Content-Type": "application/pdf" }
    }
    ```
- **Response**: 2xx = success. Non-2xx = metadata failure (upload already succeeded).

### 2.3 View URL

- **Format**: `{VIEW_URL_BASE}/{sha256}`  
  Example: `http://files.powernotes.local:8006/v1/projects/{projectId}/documents/files/{sha256}`

---

## 3. Tab PDF Upload (Content Script + Background)

Used when the user triggers “Upload current PDF” from the popup while viewing a PDF in the active tab.

### 3.1 Permissions and host access

- Extension must have:
  - `tabs`, `activeTab` (or equivalent) to get the active tab and send messages to it.
  - Host permission for the page URL (e.g. `*://*/*`) so the content script can `fetch(window.location.href)`.
  - Host permission for the upload/metadata base (e.g. `http://files.powernotes.local:8006/*`) so the background can `fetch()` the APIs.
- Optional: `nativeMessaging` if you want to store the result in the native host.

### 3.2 Message flow (high level)

1. **Popup** → **Background**: `{ type: "uploadCurrentTabPdf" }` (no payload).
2. **Background** resolves active tab; sends to that tab’s content script: `{ type: "uploadPagePdf" }`.
3. **Content script**:
   - Fetches the page URL with `fetch(url, { cache: 'force-cache' })`.
   - Validates PDF (Content-Type or URL path `.pdf`).
   - Derives filename from URL path (last path segment ending in `.pdf`, else `"upload.pdf"`).
   - Splits PDF into chunks, sends **synchronous** response with `uploadId`, `totalChunks`, `filename`, then streams **async** chunk messages to background.
4. **Background**:
   - Registers a pending upload for `uploadId` (with resolve, `totalChunks`, `chunks` map, `filename`).
   - For each `pdfChunk` message: stores decoded chunk by index; when all chunks received, reassembles, POSTs to upload then metadata, then (optional) native `setSharedPdfUrl`; resolves the promise and returns `{ ok: true, pdfUrl }` or `{ error }` to the original `uploadCurrentTabPdf` caller.

### 3.3 Content script: “uploadPagePdf”

- **Trigger**: Message `{ type: "uploadPagePdf" }`.
- **Context**: Must run in the tab whose URL is the PDF (same-origin fetch).
- **Steps**:
  1. `url = window.location.href`.
  2. `res = await fetch(url, { cache: 'force-cache' })`. If `!res.ok`, respond `{ error: "Fetch failed: " + res.status }`.
  3. PDF check:  
     `contentType = (res.headers.get("Content-Type") ?? "").toLowerCase()`;  
     `isPdf = contentType.includes("application/pdf") || url.toLowerCase().endsWith(".pdf")`.  
     If `!isPdf`, respond `{ error: "Not a PDF" }`.
  4. Filename: from URL pathname, last segment ending in `.pdf`, else `"upload.pdf"`.
  5. `arrayBuffer = await res.arrayBuffer()`, `bytes = new Uint8Array(arrayBuffer)`.
  6. Chunking constants:
    - **CHUNK_RAW_SIZE** = `12 * 1024 * 1024` (12 MiB). Reason: base64 in messages stays under typical message size limits (~32 MB).
  7. `totalChunks = Math.ceil(bytes.length / CHUNK_RAW_SIZE)`.
  8. `uploadId = crypto.randomUUID()`.
  9. **Send response once**: `sendResponse({ uploadId, totalChunks, filename })`. Return `true` so the channel stays open for async chunk messages.
  10. Encode chunks as base64 in sub-chunks to avoid stack issues: for each chunk, use a helper that converts `Uint8Array` → base64 string in 8192-byte sub-chunks (e.g. build a binary string from `String.fromCharCode.apply(null, Array.from(sub))` then `btoa(binary)`).
  11. For `i = 0 .. totalChunks - 1`:
      - `chunk = bytes.subarray(i * CHUNK_RAW_SIZE, min((i+1) * CHUNK_RAW_SIZE, bytes.length))`.
      - `chunkBase64 = bytesToBase64(chunk)`.
      - `await browser.runtime.sendMessage({ type: "pdfChunk", uploadId, chunkIndex: i, totalChunks, chunkBase64 })`.
  12. On any error, call `sendResponse({ error: String(err) })`.

### 3.4 Background: “pdfChunk”

- **Trigger**: Message `{ type: "pdfChunk", uploadId, chunkIndex, totalChunks, chunkBase64? }`.
- **State**: Keep a map `pendingUploads[uploadId]` with:
  - `resolve` / `reject` (Promise for the “upload current tab” flow),
  - `totalChunks`,
  - `chunks: Record<number, Uint8Array>`,
  - `filename`.
- **Behavior**:
  1. Look up `pending = pendingUploads[uploadId]`. If none, return (ignore stray chunk).
  2. Decode: if `chunkBase64` is missing or empty, store `pending.chunks[chunkIndex] = new Uint8Array(0)`; else `atob(chunkBase64)` and copy to `Uint8Array`, store in `pending.chunks[chunkIndex]`.
  3. When **every** index `0 .. totalChunks - 1` is present in `pending.chunks`:
     - Reassemble: concatenate `pending.chunks[0]`, `pending.chunks[1]`, … in order into one `Uint8Array`.
     - If length is 0, resolve with `{ error: "Reassembled PDF is empty (chunks may not have been received correctly)" }`, delete `pendingUploads[uploadId]`, return.
     - Build multipart body: boundary (e.g. `Boundary-${crypto.randomUUID()}`), one part `name="file"`, `filename` (escape backslashes and double quotes for the header), `Content-Type: application/pdf`, then raw bytes, then closing boundary.
     - `fetch(UPLOAD_URL, { method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=...", "X-ACCESS-TOKEN": ACCESS_TOKEN }, body })`.
     - If !res.ok: resolve `{ error: "Upload failed: " + res.status }`, delete pending, return.
     - Parse JSON; if missing `sha256`, resolve `{ error: "Upload failed: no sha256 in response" }`, delete pending, return.
     - POST to METADATA_URL with JSON `{ sha256, filename, headers: { "Content-Type": "application/pdf" } }`. If !metadataRes.ok, resolve `{ error: "Metadata failed: " + metadataRes.status }`, delete pending, return.
     - Compute `pdfUrl = VIEW_URL_BASE + "/" + sha256`.
     - Optional: `sendNativeMessage(nativeHostAppId, { type: "setSharedPdfUrl", pdfUrl })`. If response is not `{ ok: true }`, resolve `{ error: response?.error ?? "Failed to store PDF URL" }`; else resolve `{ ok: true, pdfUrl }`.
     - In all cases, `delete pendingUploads[uploadId]`.
  4. Return `false` (no async sendResponse for this handler).

### 3.5 Background: “uploadCurrentTabPdf”

- **Trigger**: Message `{ type: "uploadCurrentTabPdf" }`.
- **Steps**:
  1. Get active tab (e.g. `tabs.query({ active: true, currentWindow: true })[0]`). If no tab or no URL, respond `{ error: "No active tab" }`.
  2. If tab URL is not `http://` or `https://`, respond `{ error: "Current tab is not a PDF" }`.
  3. Send to tab: `{ type: "uploadPagePdf" }`. Await response (content script’s first sendResponse).
  4. If response has `error`, respond with `{ error: response.error }`.
  5. From response take `uploadId`, `totalChunks`, `filename`. If !uploadId or totalChunks <= 0, respond `{ error: "No PDF data from page" }`.
  6. Create a Promise and store in `pendingUploads[uploadId]` with `resolve`, `reject`, `totalChunks`, `chunks: {}`, `filename`. The content script will send `pdfChunk` messages; when all chunks are in, the `pdfChunk` handler (above) will resolve this promise.
  7. Await the promise. Then respond to the caller with either `{ ok: true, pdfUrl }` or `{ error }`.
  8. Return `true` (async response).

---

## 4. Checking if the current tab is a PDF

Used to enable/disable “Upload current PDF” in the popup.

- **Message**: `{ type: "checkCurrentTabIsPdf", tabId?: number }` (tabId optional; if omitted, use active tab).
- **Handler (background)**:
  - Resolve tab (by tabId or active/current).
  - If no tab or URL not http(s), respond `{ isPdf: false }`.
  - If `tab.url.toLowerCase().endsWith(".pdf")`, respond `{ isPdf: true }` (Safari’s native PDF viewer may not run content scripts).
  - Otherwise send to tab `{ type: "checkIsPdf" }`. Content script responds with `{ isPdf: true/false }` (e.g. HEAD request and check Content-Type or URL). Forward that as `{ isPdf }`.

Content script **checkIsPdf**: `fetch(url, { method: "HEAD", cache: "force-cache" })`, then same PDF check as above; respond `{ isPdf }`.

---

## 5. Native messaging (optional)

Used so the **host app** (Safari app container) can read or clear the last-uploaded PDF URL. The extension calls `browser.runtime.sendNativeMessage(appName, payload)`.

- **Application name**: Must match the native host’s registered name (e.g. `com.powernotes.safari-demo-extension`). The host receives the message and can read/write App Group UserDefaults.
- **Messages from extension to native host**:
  - **getSharedFile**: `{ type: "getSharedFile" }`  
    → Host returns `{ pdfUrl: string | null }`.
  - **clearSharedFile**: `{ type: "clearSharedFile" }`  
    → Host removes stored URL; returns `{ ok: true }`. Extension may then notify tabs (e.g. `sharedFileUpdated`) so UI updates.
  - **setSharedPdfUrl**: `{ type: "setSharedPdfUrl", pdfUrl: string }`  
    → Host stores `pdfUrl` (e.g. in UserDefaults with key `lastSharedPdfUrlKey` in App Group). Returns `{ ok: true }` or `{ ok: false, error: string }`.

If you do **not** use native messaging, after upload + metadata you can still return `{ ok: true, pdfUrl }` to the popup and let the popup/store the URL in extension storage or display it only in-session.

---

## 6. Share Extension (native iOS/macOS)

The share extension runs in the host app process; it does **not** use the web extension’s background or native messaging for the upload. It uploads the file directly and then writes the view URL into **App Group UserDefaults** so the Safari extension (via native messaging) can later read it with `getSharedFile`.

### 6.1 Input

- **Input types**: `UTType.fileURL`, `UTType.pdf`.
- **PDF detection**:
  - File URL: path extension `pdf` or type identifier conforms to `.pdf`, or first bytes are `%PDF`.
  - Data: first 4 bytes `%PDF` → treat as PDF.
  - File URL as Data: if data starts with `%PDF`, use as PDF; else decode as UTF-8 path and open as file URL.

### 6.2 Upload flow

1. Build multipart body: boundary (e.g. `Boundary-${UUID}`), one part:
   - `Content-Disposition: form-data; name="file"; filename="<filename>"`
   - `Content-Type: application/pdf`
   - Raw PDF bytes
   - Closing boundary.
2. POST to **upload URL** with headers:
   - `Content-Type: multipart/form-data; boundary=...`
   - `X-ACCESS-TOKEN: <token>`
3. On 2xx, parse JSON for `sha256`. On failure or missing `sha256`, show “Upload failed” and complete the share request with failure.
4. POST to **metadata URL** with:
   - `Content-Type: application/json`
   - `X-ACCESS-TOKEN: <token>`
   - Body: `{ "sha256": "<sha256>", "filename": "<filename>", "headers": { "Content-Type": "application/pdf" } }`
5. On metadata success: `viewURL = VIEW_URL_BASE + "/" + sha256`. Write `viewURL` to App Group UserDefaults (e.g. key `lastSharedPdfUrlKey`), then complete the share with success.

App Group must be the same as the one the Safari extension’s native host uses for `getSharedFile` / `setSharedPdfUrl` / `clearSharedFile` (e.g. `group.com.powernotes.safari-demo-extension`).

---

## 7. Constants and configuration

- **CHUNK_RAW_SIZE**: 12 MiB (`12 * 1024 * 1024`).
- **Base64 sub-chunk size**: 8192 bytes when converting bytes → base64 in the content script (avoids stack overflow on large chunks).
- **URLs**: Make upload URL, metadata URL, and view URL base configurable (env or config); same three values used in background and in share extension.
- **ACCESS_TOKEN**: Per-environment; required for both upload and metadata requests.

---

## 8. Error handling and UX

- **Content script**: Fetch failure, “Not a PDF”, or exception → `sendResponse({ error: "..." })`.
- **Background**: Upload/metadata/native failure → resolve the upload promise with `{ error: "..." }` and respond to popup with that error.
- **Popup**: On `uploadCurrentTabPdf` response, if `ok === true` show/update `pdfUrl`; else show `error` (e.g. alert). Disable “Upload current PDF” when `checkCurrentTabIsPdf` is false; show “Uploading…” and disable button during upload.

---

## 9. File and role summary

| Role | Responsibility |
|------|----------------|
| **Popup** | Calls `checkCurrentTabIsPdf` and `uploadCurrentTabPdf`; displays shared PDF URL; optional refresh/clear via `getSharedFile` / `clearSharedFile`. |
| **Background** | Handles `uploadCurrentTabPdf`, `pdfChunk`, `checkCurrentTabIsPdf`, `getSharedFile`, `clearSharedFile`; performs upload + metadata + optional native `setSharedPdfUrl`; holds `pendingUploads` keyed by `uploadId`. |
| **Content script** | Handles `checkIsPdf` (HEAD + Content-Type/URL); handles `uploadPagePdf` (fetch PDF, chunk, send first response then stream `pdfChunk` messages). |
| **Native host (Safari)** | Handles `getSharedFile`, `clearSharedFile`, `setSharedPdfUrl` via App Group UserDefaults. |
| **Share extension** | Upload PDF → metadata → write view URL to App Group; same upload/metadata contract as background. |

This spec is sufficient to reimplement the PDF upload flow in another extension (different browser or same) and to keep backend and native host contracts consistent.
