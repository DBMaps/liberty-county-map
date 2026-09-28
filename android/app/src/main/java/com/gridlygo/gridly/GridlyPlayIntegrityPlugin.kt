package com.gridlygo.gridly

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.StandardIntegrityManager

// A Play verdict is server evidence for app legitimacy, never paid ownership.
@CapacitorPlugin(name = "GridlyPlayIntegrity")
class GridlyPlayIntegrityPlugin : Plugin() {
    private val manager by lazy { IntegrityManagerFactory.createStandard(context) }
    private var provider: StandardIntegrityManager.StandardIntegrityTokenProvider? = null
    private var preparing = false
    private fun unavailable(call: PluginCall) { call.resolve(JSObject().put("errorCategory", "attestation_unavailable")) }

    @PluginMethod
    fun prepare(call: PluginCall) {
        bridge.executeOnMainThread {
            if (context.packageName != "com.gridlygo.gridly" || BuildConfig.GRIDLY_PLAY_INTEGRITY_PROJECT_NUMBER <= 0L || preparing) {
                unavailable(call); return@executeOnMainThread
            }
            if (provider != null) { call.resolve(JSObject().put("prepared", true)); return@executeOnMainThread }
            preparing = true
            manager.prepareIntegrityToken(
                StandardIntegrityManager.PrepareIntegrityTokenRequest.builder()
                    .setCloudProjectNumber(BuildConfig.GRIDLY_PLAY_INTEGRITY_PROJECT_NUMBER).build()
            ).addOnSuccessListener { ready ->
                preparing = false; provider = ready
                call.resolve(JSObject().put("prepared", true))
            }.addOnFailureListener {
                preparing = false; unavailable(call)
            }
        }
    }

    @PluginMethod
    fun authorize(call: PluginCall) {
        bridge.executeOnMainThread {
            val hash = call.getString("digest")
            if (context.packageName != "com.gridlygo.gridly" || BuildConfig.GRIDLY_PLAY_INTEGRITY_PROJECT_NUMBER <= 0L ||
                hash == null || !Regex("^[A-Za-z0-9_-]{43}$").matches(hash)) { unavailable(call); return@executeOnMainThread }
            val ready = provider
            if (ready == null) { unavailable(call); return@executeOnMainThread }
            ready.request(StandardIntegrityManager.StandardIntegrityTokenRequest.builder().setRequestHash(hash).build())
                .addOnSuccessListener { response ->
                    val token = response.token()
                    if (token.isEmpty() || token.length > 16384) unavailable(call)
                    else call.resolve(JSObject().put("type", "google_standard").put("token", token))
                }.addOnFailureListener {
                    provider = null; unavailable(call)
                }
        }
    }

    override fun handleOnDestroy() { provider = null; super.handleOnDestroy() }
}
