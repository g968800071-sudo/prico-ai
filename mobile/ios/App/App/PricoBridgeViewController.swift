import UIKit
import Capacitor
import WebKit

class PricoBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(PricoExportPlugin())
        if #available(iOS 16.4, *) { webView?.isInspectable = true }
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        guard FileManager.default.fileExists(atPath: docs.appendingPathComponent("prico-smoke").path) else { return }
        var lines = ["try{localStorage.setItem('prico.onb','1');localStorage.setItem('prico.smoke','1');}catch(e){}"]
        if let raw = try? String(contentsOf: docs.appendingPathComponent("prico-online"), encoding: .utf8) {
            let url = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            if url.hasPrefix("http") {
                let escaped = url.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "'", with: "\\'")
                lines.append("try{localStorage.setItem('prico.server', '\(escaped)');}catch(e){}")
            }
        }
        let script = WKUserScript(source: lines.joined(separator: "\n"), injectionTime: .atDocumentStart, forMainFrameOnly: true)
        webView?.configuration.userContentController.addUserScript(script)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        guard FileManager.default.fileExists(atPath: docs.appendingPathComponent("prico-smoke").path) else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            self?.pollSmoke(docs: docs, left: 45)
        }
    }

    private func pollSmoke(docs: URL, left: Int) {
        guard let webView else { return }
        webView.evaluateJavaScript("typeof window.__pricoDeviceSmoke") { [weak self] value, _ in
            if value as? String == "function" {
                self?.runSmoke(docs: docs)
            } else if left > 0 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1) { self?.pollSmoke(docs: docs, left: left - 1) }
            } else {
                try? Data("{\"ok\":false,\"error\":\"smoke timeout\"}".utf8).write(to: docs.appendingPathComponent("prico-smoke.json"))
            }
        }
    }

    private func runSmoke(docs: URL) {
        guard let webView else { return }
        webView.callAsyncJavaScript("return await window.__pricoDeviceSmoke()", arguments: [:], in: nil, in: .page) { result in
            let payload: Any
            switch result {
            case .success(let value): payload = value
            case .failure(let error): payload = ["ok": false, "error": error.localizedDescription]
            }
            let data = (try? JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted])) ?? Data("{\"ok\":false,\"error\":\"unserializable\"}".utf8)
            try? data.write(to: docs.appendingPathComponent("prico-smoke.json"))
            NSLog("PRICO_SMOKE %@", String(data: data, encoding: .utf8) ?? "")
        }
    }
}
