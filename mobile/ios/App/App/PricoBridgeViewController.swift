import UIKit
import Capacitor
import WebKit

class PricoBridgeViewController: CAPBridgeViewController, WKScriptMessageHandler {
    private var smokeArmed = false
    private let smokeFile = "prico-smoke.json"

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(PricoExportPlugin())
        if #available(iOS 16.4, *) { webView?.isInspectable = true }
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        guard FileManager.default.fileExists(atPath: docs.appendingPathComponent("prico-smoke").path) else { return }
        smokeArmed = true
        var lines = [
            "try{localStorage.setItem('prico.onb','1');localStorage.setItem('prico.smoke','1');}catch(e){}",
            "(function(){",
            "var tries=0;",
            "function send(v){try{window.webkit.messageHandlers.pricoSmoke.postMessage(typeof v==='string'?v:JSON.stringify(v));}catch(e){}}",
            "function tick(){",
            "if(typeof window.__pricoDeviceSmoke==='function'){",
            "Promise.resolve().then(function(){return window.__pricoDeviceSmoke();}).then(function(v){send(v);}).catch(function(e){send({ok:false,error:String(e&&(e.message||e)||e)});});",
            "}else if(++tries<100){setTimeout(tick,250);}",
            "else send({ok:false,error:'smoke missing'});",
            "}",
            "setTimeout(tick,400);",
            "})();"
        ]
        if let raw = try? String(contentsOf: docs.appendingPathComponent("prico-online"), encoding: .utf8) {
            let url = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            if url.hasPrefix("http") {
                let escaped = url.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "'", with: "\\'")
                lines.insert("try{localStorage.setItem('prico.server', '\(escaped)');}catch(e){}", at: 1)
            }
        }
        webView?.configuration.userContentController.add(self, name: "pricoSmoke")
        let script = WKUserScript(source: lines.joined(separator: "\n"), injectionTime: .atDocumentStart, forMainFrameOnly: true)
        webView?.configuration.userContentController.addUserScript(script)
        NSLog("PRICO smoke armed")
        DispatchQueue.main.asyncAfter(deadline: .now() + 780) { [weak self] in
            self?.writeWatchdog(docs: docs)
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "pricoSmoke" else { return }
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let text: String
        if let body = message.body as? String, body.contains("{") { text = body }
        else { text = "{\"ok\":false,\"error\":\"bad smoke message\"}" }
        NSLog("PRICO_SMOKE %@", String(text.prefix(600)))
        try? Data(text.utf8).write(to: docs.appendingPathComponent(smokeFile), options: .atomic)
    }

    private func writeWatchdog(docs: URL) {
        guard smokeArmed else { return }
        let dest = docs.appendingPathComponent(smokeFile)
        if FileManager.default.fileExists(atPath: dest.path) { return }
        NSLog("PRICO smoke watchdog")
        try? Data("{\"ok\":false,\"error\":\"smoke watchdog\"}".utf8).write(to: dest, options: .atomic)
    }
}
