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

class ShareViewController: PlatformViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        processSharedItems()
    }

    private func processSharedItems() {
        guard let extensionContext = extensionContext,
              let inputItems = extensionContext.inputItems as? [NSExtensionItem] else {
            completeRequest()
            return
        }

        let fileURLType = UTType.fileURL.identifier
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
            }
            if foundProvider { break }
        }

        if foundProvider {
            group.notify(queue: .main) { [weak self] in
                self?.completeRequest()
            }
        } else {
            completeRequest()
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
        UserDefaults(suiteName: appGroupSuiteName)?.synchronize()
    }

    private func completeRequest() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}
