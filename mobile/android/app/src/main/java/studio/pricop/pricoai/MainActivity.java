package studio.pricop.pricoai;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private boolean smokeArmed;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(PricoExportPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        if (smokeArmed) return;
        File flag = new File(getFilesDir(), "prico-smoke");
        if (!flag.exists()) return;
        smokeArmed = true;
        WebView view = getBridge().getWebView();
        view.postDelayed(() -> prepareSmoke(view), 1200);
    }

    private void prepareSmoke(WebView view) {
        String online = readText(new File(getFilesDir(), "prico-online")).trim();
        String js = online.startsWith("http")
            ? "localStorage.setItem('prico.server', " + JSONObject.quote(online) + "); localStorage.setItem('prico.onb','1'); localStorage.setItem('prico.smoke','1'); location.reload();"
            : "localStorage.setItem('prico.onb','1'); localStorage.setItem('prico.smoke','1');";
        view.evaluateJavascript(js, value -> view.postDelayed(() -> runSmoke(view, 0), online.startsWith("http") ? 2500 : 1500));
    }

    private void runSmoke(WebView view, int attempt) {
        String kick = "(function(){"
            + "if (window.__pricoSmokeResult) return window.__pricoSmokeResult;"
            + "if (typeof window.__pricoDeviceSmoke!=='function') return '';"
            + "if (!window.__pricoSmokeKick) {"
            + " window.__pricoSmokeKick=1;"
            + " Promise.resolve(window.__pricoDeviceSmoke()).then(function(r){ window.__pricoSmokeResult=JSON.stringify(r); }).catch(function(e){ window.__pricoSmokeResult=JSON.stringify({ok:false,error:String(e&&(e.code||e.message)||e)}); });"
            + "}"
            + "return window.__pricoSmokeResult || '';"
            + "})()";
        view.evaluateJavascript(kick, value -> {
            String json = unquote(value);
            if (json == null || json.isEmpty() || "{}".equals(json)) {
                if (attempt < 150) view.postDelayed(() -> runSmoke(view, attempt + 1), 1000);
                else writeText(new File(getFilesDir(), "prico-smoke.json"), "{\"ok\":false,\"error\":\"smoke timeout\"}");
                return;
            }
            writeText(new File(getFilesDir(), "prico-smoke.json"), json);
        });
    }

    private static String unquote(String value) {
        if (value == null || "null".equals(value)) return null;
        try {
            if (value.startsWith("\"")) return new JSONObject("{\"v\":" + value + "}").getString("v");
            return value;
        } catch (Exception e) { return value; }
    }

    private static String readText(File f) {
        if (!f.exists()) return "";
        try (FileInputStream in = new FileInputStream(f)) {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) >= 0) bos.write(buf, 0, n);
            return bos.toString(StandardCharsets.UTF_8.name());
        } catch (Exception e) { return ""; }
    }

    private static void writeText(File f, String text) {
        try (FileOutputStream out = new FileOutputStream(f)) {
            out.write((text == null ? "" : text).getBytes(StandardCharsets.UTF_8));
        } catch (Exception ignored) {}
    }
}
