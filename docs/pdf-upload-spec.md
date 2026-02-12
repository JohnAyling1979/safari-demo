# PDF Upload – Specification for Extension Reimplementation

This spec describes the PDF upload feature so it can be recreated in another extension. Configure the following variables for your environment:

| Variable | Description | Example value |
|----------|-------------|---------------|
| **UPLOAD_URL** | Full URL of the upload endpoint | `http://files.powernotes.local:8006/v1/projects/<projectId>/documents/uploads` |
| **METADATA_URL** | Full URL of the metadata endpoint (POST after upload) | `http://files.powernotes.local:8006/v1/projects/<projectId>/documents/metadata` |
| **VIEW_URL_BASE** | Base URL for viewing an uploaded PDF (no trailing slash). Full view URL = `VIEW_URL_BASE + '/' + <sha256>` | `http://files.powernotes.local:8006/v1/projects/<projectId>/documents/files` |
| **ACCESS_TOKEN** | Value for the `X-ACCESS-TOKEN` header on upload and metadata requests | (set per environment) |

---

## 1. Overview

The feature supports **two ways** to upload a PDF and store a “shared PDF” view URL:

1. **Share Extension (native)** – User shares a **local** PDF from the system share sheet. The Share Extension POSTs the file to **UPLOAD_URL** (with **X-ACCESS-TOKEN**), then POSTs to **METADATA_URL** with `{ sha256, filename }`, then writes the view URL to shared storage.
2. **Web Extension (popup)** – When the current tab is an **online** PDF, the user can click “Upload current PDF”. The content script reads the PDF from cache, sends it to the background in chunks; the background POSTs to **UPLOAD_URL**, then to **METADATA_URL**, then stores the view URL via native messaging.

---

## 2. Upload and Metadata API

### 2.1 Upload endpoint

- **Method:** `POST`
- **URL:** **UPLOAD_URL**
- **Headers:**
  - `Content-Type: multipart/form-data; boundary=<boundary>`
  - `X-ACCESS-TOKEN: <ACCESS_TOKEN>`
- **Body:** Multipart form with one file part: field name `file`, filename (e.g. `upload.pdf` or original name), `Content-Type: application/pdf`, raw PDF bytes.

- **Success response (2xx):** JSON, e.g. `{ "sha256": "<hex>", "size": <number> }`. `sha256` is required for the next step and for building the view URL.

### 2.2 Metadata endpoint (call after upload)

- **Method:** `POST`
- **URL:** **METADATA_URL**
- **Headers:**
  - `Content-Type: application/json`
  - `X-ACCESS-TOKEN: <ACCESS_TOKEN>`
- **Body:** `{ "sha256": "<from upload response>", "filename": "<actual filename when available>", "headers": { "Content-Type": "application/pdf" } }`  
  Use the real filename when available: Share Extension uses the file’s name (e.g. `url.lastPathComponent`) or `"upload.pdf"`; Web Extension uses the last path segment of the tab URL (e.g. `PDF_TestPage.pdf`) or `"upload.pdf"`.

- **Success:** 2xx. After this, the view URL is valid.

### 2.3 View URL

- **Format:** `VIEW_URL_BASE + '/' + sha256`  
  Example: `http://files.powernotes.local:8006/v1/projects/C0KHpxVnR8CYYFictWe0Lg/documents/files/5e69dfee4649a9e474ded04548d97c8ec6667a52699415dc0d468f77268746c5`

---

## 3. Share Extension (Native)

- **Flow:** Resolve PDF data → validate PDF → POST to **UPLOAD_URL** with **X-ACCESS-TOKEN** and multipart body → on 2xx parse `sha256` → POST to **METADATA_URL** with `{ sha256, filename }` (filename from file URL when available, else `upload.pdf`) and **X-ACCESS-TOKEN** → on 2xx set view URL = `VIEW_URL_BASE + '/' + sha256` in App Group → dismiss.
- **App Group:** Same suite/key as in section 6. No message to Web Extension on success.

---

## 4. Web Extension – Upload from Current Tab

- **Background:** On `uploadCurrentTabPdf`, get active tab, send `uploadPagePdf` to content script; collect chunks; reassemble; POST to **UPLOAD_URL** with headers `Content-Type: multipart/form-data; boundary=...` and `X-ACCESS-TOKEN: ACCESS_TOKEN`; on success POST to **METADATA_URL** with `{ sha256, filename: "upload.pdf" }` and `X-ACCESS-TOKEN`; on success set `pdfUrl = VIEW_URL_BASE + '/' + sha256` and call native `setSharedPdfUrl`; respond to popup with `{ ok: true, pdfUrl }` or `{ error }`.
- **Chunking:** Chunk size 12 MiB raw; chunks sent as base64 in `pdfChunk` messages. Other behavior as in the existing implementation (uploadId, totalChunks, reassembly, etc.).

---

## 5. Native Messaging & App Group

Unchanged: `getSharedFile`, `setSharedPdfUrl`, `clearSharedFile`; App Group suite and key; popup reads/displays the stored view URL and has Upload current PDF / Refresh / Clear URL.

---

## 6. Constants Summary

| Constant        | Value / Variable |
|-----------------|------------------|
| Upload URL      | **UPLOAD_URL** |
| Metadata URL    | **METADATA_URL** |
| View URL base   | **VIEW_URL_BASE** |
| Access token    | **ACCESS_TOKEN** (header `X-ACCESS-TOKEN`) |
| Chunk size      | `12 * 1024 * 1024` (12 MiB) |
| Multipart field | `file` |
| App group key   | `lastSharedPdfUrl` |

---

## 7. Host permissions

Include the host used in **UPLOAD_URL**, **METADATA_URL**, and **VIEW_URL_BASE** (e.g. `http://files.powernotes.local:8006/*`).
