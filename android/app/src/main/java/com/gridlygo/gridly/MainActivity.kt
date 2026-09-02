package com.gridlygo.gridly

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // WebView otherwise inherits the Android accessibility font scale as
        // text zoom (the physical acceptance device exposed 138%, turning the
        // app's governed 16px root into 22.08px). Gridly retains its own
        // Standard/Large/Compact preferences; only the duplicate native zoom
        // multiplier is normalized here.
        bridge.webView.settings.textZoom = 100
    }
}
