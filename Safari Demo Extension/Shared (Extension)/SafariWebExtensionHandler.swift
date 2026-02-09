//
//  SafariWebExtensionHandler.swift
//  Shared (Extension)
//
//  Created by John Ayling on 2/9/26.
//

import SafariServices
import os.log

private let appGroupSuiteName = "group.com.powernotes.safari-demo-extension"
private let lastSharedPdfUrlKey = "lastSharedPdfUrl"

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

        os_log(.default, "safari-demo:SafariWebExtensionHandler: Received message from browser.runtime.sendNativeMessage: %@ (profile: %@)", String(describing: message), profile?.uuidString ?? "none")

        var responsePayload: [String: Any] = [:]

        if let msg = message as? [String: Any], msg["type"] as? String == "getSharedFile" {
            let defaults = UserDefaults(suiteName: appGroupSuiteName)
            if let pdfUrl = defaults?.string(forKey: lastSharedPdfUrlKey) {
                responsePayload["pdfUrl"] = pdfUrl
                os_log(.default, "safari-demo:SafariWebExtensionHandler: getSharedFile: returning pdfUrl from app group: %@", pdfUrl)
            } else {
                responsePayload["pdfUrl"] = NSNull()
                os_log(.default, "safari-demo:SafariWebExtensionHandler: getSharedFile: no pdfUrl in app group (suite: %@)", appGroupSuiteName)
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
