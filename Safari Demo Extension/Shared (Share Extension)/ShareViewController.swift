//
//  ShareViewController.swift
//  Shared (Share Extension)
//

import UniformTypeIdentifiers

#if os(iOS)
import UIKit
typealias PlatformViewController = UIViewController
#elseif os(macOS)
import Cocoa
typealias PlatformViewController = NSViewController
#endif

private let appGroupSuiteName = "group.com.powernotes.safari-demo-extension"
private let lastSharedPdfUrlKey = "lastSharedPdfUrl"
private let uploadURLString = "http://127.0.0.1:5001/upload"
private let pdfViewURLBase = "http://localhost:5001/view"

class ShareViewController: PlatformViewController {

    #if os(iOS)
    private var statusLabel: UILabel?
    #elseif os(macOS)
    private var statusLabel: NSTextField?
    #endif

    override func viewDidLoad() {
        super.viewDidLoad()
        showStatus("Saving…")
        processSharedItems()
    }

    private func processSharedItems() {
        guard let extensionContext = extensionContext,
              let inputItems = extensionContext.inputItems as? [NSExtensionItem] else {
            showStatus("Upload failed")
            completeRequest(afterDelay: 0.8)
            return
        }

        let fileURLType = UTType.fileURL.identifier
        let pdfType = UTType.pdf.identifier
        let group = DispatchGroup()
        var foundProvider = false

        for item in inputItems {
            guard let attachments = item.attachments else { continue }
            for provider in attachments {
                if provider.hasItemConformingToTypeIdentifier(fileURLType) {
                    foundProvider = true
                    group.enter()
                    provider.loadItem(forTypeIdentifier: fileURLType, options: nil) { [weak self] item, _ in
                        defer { group.leave() }
                        if let url = item as? URL {
                            self?.handleFileURL(url)
                        } else if let data = item as? Data {
                            self?.handleFileURLItemAsData(data)
                        } else {
                            self?.finishWithFailure("Not a PDF")
                        }
                    }
                    break
                }
                if provider.hasItemConformingToTypeIdentifier(pdfType) {
                    foundProvider = true
                    group.enter()
                    provider.loadItem(forTypeIdentifier: pdfType, options: nil) { [weak self] item, _ in
                        defer { group.leave() }
                        if let data = item as? Data {
                            self?.uploadPDF(data)
                        } else if let url = item as? URL {
                            self?.handleFileURL(url)
                        } else {
                            self?.finishWithFailure("Not a PDF")
                        }
                    }
                    break
                }
            }
            if foundProvider { break }
        }

        if !foundProvider {
            showStatus("Unsupported type")
            completeRequest(afterDelay: 0.8)
        }
    }

    /// Handle Data from fileURL loadItem: macOS may give path as UTF-8 bytes, file URL string, or file contents.
    private func handleFileURLItemAsData(_ data: Data) {
        if data.prefix(4).elementsEqual("%PDF".utf8) {
            uploadPDF(data)
            return
        }
        guard let str = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
              !str.isEmpty else {
            finishWithFailure("Not a PDF")
            return
        }
        let url: URL?
        if str.hasPrefix("/") && !str.contains("://") {
            url = URL(fileURLWithPath: str)
        } else if let u = URL(string: str), u.isFileURL {
            url = u
        } else {
            finishWithFailure("Not a PDF")
            return
        }
        guard let url = url else {
            finishWithFailure("Not a PDF")
            return
        }
        handleFileURL(url)
    }

    private func isPDFFile(_ url: URL) -> Bool {
        if url.pathExtension.lowercased() == "pdf" { return true }
        if (try? url.resourceValues(forKeys: [.typeIdentifierKey]).typeIdentifier)
            .map({ UTType($0)?.conforms(to: .pdf) ?? false }) ?? false { return true }
        // macOS share extension may give temp files without .pdf extension or typeIdentifier; check magic bytes
        guard url.isFileURL, let data = try? Data(contentsOf: url, options: .mappedIfSafe).prefix(5) else { return false }
        return data.starts(with: "%PDF".utf8)
    }

    private func handleFileURL(_ url: URL) {
        guard url.isFileURL, isPDFFile(url) else {
            finishWithFailure("Not a PDF")
            return
        }
        do {
            let data = try Data(contentsOf: url)
            uploadPDF(data)
        } catch {
            finishWithFailure("Upload failed")
        }
    }

    private func uploadPDF(_ data: Data) {
        guard let url = URL(string: uploadURLString) else {
            finishWithFailure("Upload failed")
            return
        }
        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"upload.pdf\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: application/pdf\r\n\r\n".data(using: .utf8)!)
        body.append(data)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        request.httpBody = body

        let task = URLSession.shared.dataTask(with: request) { [weak self] responseData, response, error in
            guard let self = self else { return }
            if let _ = error {
                DispatchQueue.main.async { self.finishWithFailure("Upload failed") }
                return
            }
            guard let http = response as? HTTPURLResponse,
                  (200...299).contains(http.statusCode) else {
                DispatchQueue.main.async { self.finishWithFailure("Upload failed") }
                return
            }
            guard let data = responseData,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let sha256 = json["sha256"] as? String,
                  !sha256.isEmpty else {
                DispatchQueue.main.async { self.finishWithFailure("Upload failed") }
                return
            }
            let viewURL = "\(pdfViewURLBase)/\(sha256)"
            UserDefaults(suiteName: appGroupSuiteName)?.set(viewURL, forKey: lastSharedPdfUrlKey)
            UserDefaults(suiteName: appGroupSuiteName)?.synchronize()
            DispatchQueue.main.async { self.finishWithSuccess() }
        }
        task.resume()
    }

    private func finishWithSuccess() {
        showStatus("Saved")
        completeRequest(afterDelay: 1.2)
    }

    private func finishWithFailure(_ message: String) {
        DispatchQueue.main.async { [weak self] in
            self?.showStatus(message)
            self?.completeRequest(afterDelay: 0.8)
        }
    }

    private func showStatus(_ message: String) {
        #if os(iOS)
        if let existing = statusLabel {
            existing.text = message
            return
        }
        let label = UILabel()
        label.text = message
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        statusLabel = label
        view.backgroundColor = .systemBackground
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
        #elseif os(macOS)
        if let existing = statusLabel {
            existing.stringValue = message
            return
        }
        let label = NSTextField(labelWithString: message)
        label.alignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        statusLabel = label
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
        #endif
    }

    private func completeRequest(afterDelay delay: TimeInterval = 0) {
        func doComplete() {
            extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        }
        if delay > 0 {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { doComplete() }
        } else {
            doComplete()
        }
    }
}
