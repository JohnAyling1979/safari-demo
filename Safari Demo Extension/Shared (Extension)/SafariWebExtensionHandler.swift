//
//  SafariWebExtensionHandler.swift
//  Shared (Extension)
//
//  Created by John Ayling on 2/9/26.
//

import SafariServices
import os.log

private let appGroupSuiteName = "group.com.powernotes.safari-demo-extension"
private let lastSharedFileNameKey = "lastSharedFileName"
private let lastSharedFileSizeKey = "lastSharedFileSize"

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let profile: UUID?
        if #available(iOS 17.0, macOS 14.0, *) {
            profile = request?.userInfo?[SFExtensionProfileKey] as? UUID
        } else {
            profile = request?.userInfo?["profile"] as? UUID
        }

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        os_log(.default, "Received message from browser.runtime.sendNativeMessage: %@ (profile: %@)", String(describing: message), profile?.uuidString ?? "none")

        var responsePayload: [String: Any] = [:]

        if let msg = message as? [String: Any], msg["type"] as? String == "getSharedFile" {
            let defaults = UserDefaults(suiteName: appGroupSuiteName)
            let name = defaults?.string(forKey: lastSharedFileNameKey)
            let size = defaults?.integer(forKey: lastSharedFileSizeKey) ?? 0
            if let name = name {
                responsePayload["name"] = name
                responsePayload["size"] = size
            } else {
                responsePayload["name"] = NSNull()
                responsePayload["size"] = 0
            }
        } else {
            responsePayload["echo"] = message ?? NSNull()
        }

        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [ SFExtensionMessageKey: responsePayload ]
        } else {
            response.userInfo = [ "message": responsePayload ]
        }

        context.completeRequest(returningItems: [ response ], completionHandler: nil)
    }

}
