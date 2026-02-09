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
private let lastSharedFileNameKey = "lastSharedFileName"
private let lastSharedFileSizeKey = "lastSharedFileSize"
private let lastSharedTextKey = "lastSharedText"
private let lastSharedImagePathKey = "lastSharedImagePath"
private let sharedImageFileName = "lastSharedImage.jpg"

class ShareViewController: PlatformViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        showStatus("Saving…")
        processSharedItems()
    }

    private func processSharedItems() {
        guard let extensionContext = extensionContext,
              let inputItems = extensionContext.inputItems as? [NSExtensionItem] else {
            completeRequest()
            return
        }

        let fileURLType = UTType.fileURL.identifier
        let urlType = UTType.url.identifier
        let plainTextType = UTType.plainText.identifier
        let imageType = UTType.image.identifier
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
                            self?.saveFileInfo(url: url)
                        }
                    }
                    break
                }
                if provider.hasItemConformingToTypeIdentifier(urlType) {
                    foundProvider = true
                    group.enter()
                    provider.loadItem(forTypeIdentifier: urlType, options: nil) { [weak self] item, _ in
                        defer { group.leave() }
                        if let url = item as? URL {
                            self?.saveURLInfo(url: url)
                        }
                    }
                    break
                }
                if provider.hasItemConformingToTypeIdentifier(imageType) {
                    foundProvider = true
                    group.enter()
                    provider.loadItem(forTypeIdentifier: imageType, options: nil) { [weak self] item, _ in
                        defer { group.leave() }
                        self?.saveImageItem(item)
                    }
                    break
                }
                if provider.hasItemConformingToTypeIdentifier(plainTextType) {
                    foundProvider = true
                    group.enter()
                    provider.loadItem(forTypeIdentifier: plainTextType, options: nil) { [weak self] item, _ in
                        defer { group.leave() }
                        if let text = item as? String {
                            self?.saveTextInfo(text: text)
                        }
                    }
                    break
                }
            }
            if foundProvider { break }
        }

        if foundProvider {
            group.notify(queue: .main) { [weak self] in
                self?.showStatus("Saved")
                self?.completeRequest(afterDelay: 0.6)
            }
        } else {
            showStatus("Unsupported type")
            completeRequest(afterDelay: 0.8)
        }
    }

    private func saveFileInfo(url: URL) {
        let name = url.lastPathComponent
        var size: Int = 0
        if let value = try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize {
            size = value
        }
        UserDefaults(suiteName: appGroupSuiteName)?.set(name, forKey: lastSharedFileNameKey)
        UserDefaults(suiteName: appGroupSuiteName)?.set(size, forKey: lastSharedFileSizeKey)
        UserDefaults(suiteName: appGroupSuiteName)?.removeObject(forKey: lastSharedImagePathKey)
        UserDefaults(suiteName: appGroupSuiteName)?.synchronize()
    }

    private func saveURLInfo(url: URL) {
        UserDefaults(suiteName: appGroupSuiteName)?.set(url.absoluteString, forKey: lastSharedFileNameKey)
        UserDefaults(suiteName: appGroupSuiteName)?.set(0, forKey: lastSharedFileSizeKey)
        UserDefaults(suiteName: appGroupSuiteName)?.removeObject(forKey: lastSharedImagePathKey)
        UserDefaults(suiteName: appGroupSuiteName)?.synchronize()
    }

    private func saveTextInfo(text: String) {
        UserDefaults(suiteName: appGroupSuiteName)?.set(text, forKey: lastSharedTextKey)
        let preview = String(text.prefix(200))
        UserDefaults(suiteName: appGroupSuiteName)?.set(preview, forKey: lastSharedFileNameKey)
        UserDefaults(suiteName: appGroupSuiteName)?.set(text.count, forKey: lastSharedFileSizeKey)
        UserDefaults(suiteName: appGroupSuiteName)?.removeObject(forKey: lastSharedImagePathKey)
        UserDefaults(suiteName: appGroupSuiteName)?.synchronize()
    }

    private func saveImageItem(_ item: NSSecureCoding?) {
        guard let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupSuiteName) else { return }
        let destURL = containerURL.appendingPathComponent(sharedImageFileName)

        if let url = item as? URL, url.isFileURL {
            do {
                let data = try Data(contentsOf: url)
                try data.write(to: destURL)
                saveImageInfo(fileURL: destURL, size: data.count)
            } catch {}
            return
        }

        #if os(iOS)
        if let image = item as? UIImage, let data = image.jpegData(compressionQuality: 0.9) {
            try? data.write(to: destURL)
            saveImageInfo(fileURL: destURL, size: data.count)
        }
        #elseif os(macOS)
        if let image = item as? NSImage,
           let tiff = image.tiffRepresentation,
           let bitmap = NSBitmapImageRep(data: tiff),
           let data = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.9]) {
            try? data.write(to: destURL)
            saveImageInfo(fileURL: destURL, size: data.count)
        }
        #endif
    }

    private func saveImageInfo(fileURL: URL, size: Int) {
        UserDefaults(suiteName: appGroupSuiteName)?.set(sharedImageFileName, forKey: lastSharedFileNameKey)
        UserDefaults(suiteName: appGroupSuiteName)?.set(size, forKey: lastSharedFileSizeKey)
        UserDefaults(suiteName: appGroupSuiteName)?.set(fileURL.path, forKey: lastSharedImagePathKey)
        UserDefaults(suiteName: appGroupSuiteName)?.removeObject(forKey: lastSharedTextKey)
        UserDefaults(suiteName: appGroupSuiteName)?.synchronize()
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
