package com.gridlygo.gridly

import android.os.SystemClock
import android.provider.Settings
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import java.io.File
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

@CapacitorPlugin(name = "GridlyContinuity")
class GridlyContinuityPlugin : Plugin() {
    private val mutex = Any()
    private val alias = "gridly.continuity.v1"
    private val random = SecureRandom()
    private fun binding(): String = ByteArray(32).also { random.nextBytes(it) }.joinToString("") { "%02x".format(it.toInt() and 255) }
    private fun file() = AtomicFile(File(context.noBackupFilesDir, "gridly-continuity.v1"))
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        // Uninstall deletes app keys; noBackupFilesDir prevents cloud/transfer replay.
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setKeySize(256).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        return generator.generateKey()
    }
    private fun empty() = JSONObject().put("binding", binding()).put("proof", "").put("verifiedAt", 0)
        .put("utc", 0).put("wall", 0).put("uptime", 0).put("boot", -1)
        .put("blocked", false).put("recoverable", false).put("attempt", "")
    private fun save(record: JSONObject) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        cipher.updateAAD(alias.toByteArray(Charsets.UTF_8))
        val bytes = cipher.iv + cipher.doFinal(record.toString().toByteArray(Charsets.UTF_8))
        val target = file(); val output = target.startWrite()
        try { output.write(bytes); target.finishWrite(output) } catch (failure: Exception) { target.failWrite(output); throw failure }
    }
    private fun loadRecord(): JSONObject {
        val target = file()
        if (!target.baseFile.exists()) return empty().also { save(it) }
        val bytes = target.openRead().use { it.readBytes() }
        require(bytes.size in 29..16384)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
        cipher.updateAAD(alias.toByteArray(Charsets.UTF_8))
        return JSONObject(String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8))
    }
    private data class Clock(val utc: Double, val wall: Double, val uptime: Double, val boot: Int, val trusted: Boolean)
    private fun clock(record: JSONObject): Clock {
        val wall = System.currentTimeMillis().toDouble()
        val uptime = SystemClock.elapsedRealtime().toDouble()
        val boot = Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT)
        val trusted = record.getString("proof").isEmpty() || (record.getInt("boot") == boot && uptime >= record.getDouble("uptime") && wall >= record.getDouble("wall"))
        return Clock(maxOf(wall, record.getDouble("utc") + maxOf(0.0, uptime - record.getDouble("uptime"))), wall, uptime, boot, trusted)
    }
    private fun operate(call: PluginCall, operation: () -> JSObject) = synchronized(mutex) {
        try { call.resolve(operation()) } catch (_: Exception) { call.reject("continuity_unavailable") }
    }
    @PluginMethod fun beginVerification(call: PluginCall) { operate(call) {
        val record = loadRecord(); val time = clock(record)
        val ready = !record.getBoolean("blocked") && time.trusted
        val proof = if (ready) record.getString("proof") else ""
        record.put("recoverable", ready).put("blocked", true).put("attempt", binding())
        save(record)
        JSObject().put("binding", record.getString("binding")).put("attempt", record.getString("attempt"))
            .put("proof", proof).put("nowMs", time.utc).put("clockTrusted", ready)
    } }
    @PluginMethod fun commit(call: PluginCall) { operate(call) {
        val record = loadRecord(); val proof = call.getString("proof") ?: error("unavailable")
        val verified = (call.data.opt("verifiedAt") as? Number)?.toDouble() ?: error("unavailable")
        require(record.getBoolean("blocked") && call.getString("attempt") == record.getString("attempt") && proof.length in 1..4096 && verified.isFinite() && verified >= record.getDouble("verifiedAt"))
        val time = clock(record)
        record.put("proof", proof).put("verifiedAt", verified).put("utc", maxOf(time.wall, verified))
            .put("wall", time.wall).put("uptime", time.uptime).put("boot", time.boot)
            .put("blocked", false).put("recoverable", false).put("attempt", "")
        save(record); JSObject().put("saved", true)
    } }
    @PluginMethod fun retain(call: PluginCall) { operate(call) {
        val record = loadRecord()
        require(record.getBoolean("blocked") && call.getString("attempt") == record.getString("attempt"))
        val time = clock(record)
        if (record.getBoolean("recoverable") && time.trusted) {
            record.put("utc", time.utc).put("wall", time.wall).put("uptime", time.uptime).put("boot", time.boot).put("blocked", false)
        }
        record.put("recoverable", false).put("attempt", ""); save(record)
        JSObject().put("retained", !record.getBoolean("blocked"))
    } }
    @PluginMethod fun revoke(call: PluginCall) { operate(call) {
        val record = loadRecord()
        require(record.getBoolean("blocked") && call.getString("attempt") == record.getString("attempt"))
        save(empty()); JSObject().put("revoked", true)
    } }
}
