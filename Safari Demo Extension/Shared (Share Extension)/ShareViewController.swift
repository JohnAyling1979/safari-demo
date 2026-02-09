//
//  ShareViewController.swift
//  Shared (Share Extension)
//

import UniformTypeIdentifiers
import os.log

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
        let urlType = UTType.url.identifier
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
                            self?.uploadPDF(data)
                        } else {
                            self?.finishWithFailure("Not a PDF")
                        }
                    }
                    break
                }
                if provider.hasItemConformingToTypeIdentifier(urlType) {
                    foundProvider = true
                    group.enter()
                    provider.loadItem(forTypeIdentifier: urlType, options: nil) { [weak self] item, _ in
                        defer { group.leave() }
                        if let url = item as? URL, !url.isFileURL {
                            self?.handleWebURL(url)
                        } else {
                            self?.finishWithFailure("Not a PDF")
                        }
                    }
                    break
                }
            }
            if foundProvider { break }
        }

        if foundProvider {
            // Completion happens in finishWithSuccess / finishWithFailure when upload completes
            // (or from handleFileURL/handleWebURL when validation fails)
        } else {
            showStatus("Unsupported type")
            completeRequest(afterDelay: 0.8)
        }
    }

    private func isPDFFile(_ url: URL) -> Bool {
        url.pathExtension.lowercased() == "pdf" ||
        (try? url.resourceValues(forKeys: [.typeIdentifierKey]).typeIdentifier)
            .map { UTType($0)?.conforms(to: .pdf) ?? false } ?? false
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

    private func handleWebURL(_ url: URL) {
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, _ in
            guard let self = self else { return }
            guard let data = data,
                  let http = response as? HTTPURLResponse,
                  (200...299).contains(http.statusCode) else {
                DispatchQueue.main.async { self.finishWithFailure("Upload failed") }
                return
            }
            let contentType = (http.allHeaderFields["Content-Type"] as? String)?.lowercased() ?? ""
            let isPDF = contentType.contains("application/pdf") || url.path.lowercased().hasSuffix(".pdf")
            guard isPDF else {
                DispatchQueue.main.async { self.finishWithFailure("Not a PDF") }
                return
            }
            self.uploadPDF(data)
        }
        task.resume()
    }

    private func uploadPDF(_ data: Data) {
        os_log(.default, "safari-demo:ShareViewController: upload starting, payload size %{public}zu bytes", data.count)
        guard let url = URL(string: uploadURLString) else {
            os_log(.default, "safari-demo:ShareViewController: upload failed - invalid upload URL")
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
            if let error = error {
                os_log(.default, "safari-demo:ShareViewController: upload network error %{public}@", String(describing: error))
                DispatchQueue.main.async { self.finishWithFailure("Upload failed") }
                return
            }
            guard let http = response as? HTTPURLResponse else {
                os_log(.default, "safari-demo:ShareViewController: upload failed - no HTTP response")
                DispatchQueue.main.async { self.finishWithFailure("Upload failed") }
                return
            }
            os_log(.default, "safari-demo:ShareViewController: upload response status %{public}ld, body length %{public}zu", http.statusCode, responseData?.count ?? 0)
            guard (200...299).contains(http.statusCode) else {
                os_log(.default, "safari-demo:ShareViewController: upload failed - status %{public}ld", http.statusCode)
                DispatchQueue.main.async { self.finishWithFailure("Upload failed") }
                return
            }
            guard let data = responseData,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let sha256 = json["sha256"] as? String,
                  !sha256.isEmpty else {
                os_log(.default, "safari-demo:ShareViewController: upload failed - invalid or missing JSON sha256 (raw: %{public}@)", String(data: responseData ?? Data(), encoding: .utf8) ?? "")
                DispatchQueue.main.async { self.finishWithFailure("Upload failed") }
                return
            }
            os_log(.default, "safari-demo:ShareViewController: upload success sha256 %{public}@", sha256)
            let viewURL = "\(pdfViewURLBase)/\(sha256)"
            UserDefaults(suiteName: appGroupSuiteName)?.set(viewURL, forKey: lastSharedPdfUrlKey)
            UserDefaults(suiteName: appGroupSuiteName)?.synchronize()
            os_log(.default, "safari-demo:ShareViewController: saved pdfUrl to app group: %{public}@", viewURL)
            DispatchQueue.main.async { self.finishWithSuccess() }
        }
        task.resume()
    }

    private func finishWithSuccess() {
        showStatus("Saved")
        completeRequest(afterDelay: 0.6)
    }

    private func finishWithFailure(_ message: String) {
        DispatchQueue.main.async { [weak self] in
            self?.showStatus(message)
            self?.completeRequest(afterDelay: 0.8)
        }
    }

    private func showStatus(_ message: String) {
        #if os(iOS)
        let label = UILabel()
        label.text = message
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        view.backgroundColor = .systemBackground
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
        #elseif os(macOS)
        let label = NSTextField(labelWithString: message)
        label.alignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
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
