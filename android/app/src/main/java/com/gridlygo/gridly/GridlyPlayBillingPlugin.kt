package com.gridlygo.gridly

import android.os.Handler
import android.os.Looper
import com.android.billingclient.api.*
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

// BillingClient reports store evidence, never final Gridly entitlement.
@CapacitorPlugin(name = "GridlyPlayBilling")
class GridlyPlayBillingPlugin : Plugin() {
    companion object {
        const val PRODUCT = "gridly_monthly"
        const val BASE_PLAN = "monthly"
        const val PACKAGE = "com.gridlygo.gridly"
    }
    private val main = Handler(Looper.getMainLooper())
    private var client: BillingClient? = null
    private var connecting = false
    private var destroyed = false
    private var observing = false
    private val waiters = mutableListOf<Pair<PluginCall, (BillingClient) -> Unit>>()
    private var purchaseCall: PluginCall? = null
    private var purchaseTimeout: Runnable? = null
    private var connectionTimeout: Runnable? = null

    private fun error(category: String) = JSObject().put("result", "error").put("errorCategory", category)
    private fun category(code: Int) = when (code) {
        BillingClient.BillingResponseCode.USER_CANCELED -> "user_cancelled"
        BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> "already_owned"
        BillingClient.BillingResponseCode.ITEM_UNAVAILABLE -> "product_unavailable"
        BillingClient.BillingResponseCode.SERVICE_DISCONNECTED -> "billing_disconnected"
        BillingClient.BillingResponseCode.BILLING_UNAVAILABLE, BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE,
        BillingClient.BillingResponseCode.NETWORK_ERROR -> "billing_unavailable"
        else -> "unknown"
    }
    private fun failPurchase(reason: String) {
        purchaseTimeout?.let { main.removeCallbacks(it) }; purchaseTimeout = null
        val call = purchaseCall; purchaseCall = null
        call?.resolve(error(reason))
    }
    private fun evidence(purchases: List<Purchase>): JSObject {
        val matching = purchases.filter { it.products.contains(PRODUCT) }
        if (matching.isEmpty()) return JSObject().put("result", "no_evidence").put("errorCategory", "not_entitled")
        if (matching.size != 1) return error("verification_failed")
        val purchase = matching.single()
        if (purchase.packageName != PACKAGE || purchase.products != listOf(PRODUCT)) return error("verification_failed")
        if (purchase.purchaseState == Purchase.PurchaseState.PENDING) return JSObject().put("result", "purchase_pending").put("errorCategory", "purchase_pending")
        if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED || purchase.purchaseToken.isEmpty() || purchase.purchaseToken.length > 16384) return error("verification_failed")
        return JSObject().put("result", "purchased").put("productId", PRODUCT).put("basePlanId", BASE_PLAN)
            .put("purchaseToken", purchase.purchaseToken).put("acknowledgementRequired", !purchase.isAcknowledged)
    }
    private fun updates(result: BillingResult, purchases: List<Purchase>?) {
        if (destroyed) return
        val call = purchaseCall
        if (call != null) {
            purchaseTimeout?.let { main.removeCallbacks(it) }; purchaseTimeout = null; purchaseCall = null
            call.resolve(if (result.responseCode == BillingClient.BillingResponseCode.OK && purchases != null) evidence(purchases) else error(category(result.responseCode)))
        }
        if (observing) notifyListeners("purchaseUpdate", JSObject().put("reason", "play_purchase_update"))
    }
    private fun withClient(call: PluginCall, work: (BillingClient) -> Unit) {
        main.post {
            if (destroyed) { call.resolve(error("billing_unavailable")); return@post }
            val billing = client ?: BillingClient.newBuilder(context)
                .setListener { result, purchases -> main.post { updates(result, purchases) } }
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .build().also { client = it }
            if (billing.isReady) { work(billing); return@post }
            if (waiters.size >= 8) { call.resolve(error("billing_unavailable")); return@post }
            waiters.add(call to work)
            if (connecting) return@post
            connecting = true
            val timeout = Runnable {
                if (!connecting) return@Runnable
                connecting = false
                val pending = waiters.toList(); waiters.clear()
                billing.endConnection(); client = null
                pending.forEach { it.first.resolve(error("billing_disconnected")) }
            }
            connectionTimeout = timeout; main.postDelayed(timeout, 8000)
            billing.startConnection(object : BillingClientStateListener {
                override fun onBillingSetupFinished(result: BillingResult) { main.post {
                    if (!connecting || client !== billing || destroyed) return@post
                    connecting = false; connectionTimeout?.let { main.removeCallbacks(it) }; connectionTimeout = null
                    val pending = waiters.toList(); waiters.clear()
                    pending.forEach { if (result.responseCode == BillingClient.BillingResponseCode.OK) it.second(billing) else it.first.resolve(error(category(result.responseCode))) }
                } }
                override fun onBillingServiceDisconnected() { main.post {
                    if (client !== billing || destroyed) return@post
                    connecting = false; connectionTimeout?.let { main.removeCallbacks(it) }; connectionTimeout = null
                    val pending = waiters.toList(); waiters.clear(); pending.forEach { it.first.resolve(error("billing_disconnected")) }
                    failPurchase("billing_disconnected")
                    if (observing) notifyListeners("billingDisconnected", JSObject().put("reason", "billing_disconnected"))
                    // Reconnect only on the next explicit request, never a retry loop.
                } }
            })
        }
    }
    private fun details(call: PluginCall, billing: BillingClient, success: (ProductDetails, ProductDetails.SubscriptionOfferDetails) -> Unit) {
        billing.getBillingConfigAsync(GetBillingConfigParams.newBuilder().build()) { configResult, config -> main.post {
            if (destroyed) return@post
            if (configResult.responseCode != BillingClient.BillingResponseCode.OK || config?.countryCode != "US") { call.resolve(error("product_unavailable")); return@post }
            val item = QueryProductDetailsParams.Product.newBuilder().setProductId(PRODUCT).setProductType(BillingClient.ProductType.SUBS).build()
            billing.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(listOf(item)).build()) { result, response -> main.post {
                if (destroyed) return@post
                val items = response.productDetailsList
                val product = items.singleOrNull()
                val offer = product?.subscriptionOfferDetails?.singleOrNull()
                val phase = offer?.pricingPhases?.pricingPhaseList?.singleOrNull()
                if (result.responseCode != BillingClient.BillingResponseCode.OK) { call.resolve(error(category(result.responseCode))); return@post }
                if (product?.productId != PRODUCT || product.productType != BillingClient.ProductType.SUBS || offer?.basePlanId != BASE_PLAN || offer.offerId != null || offer.offerToken.isEmpty() ||
                    phase?.billingPeriod != "P1M" || phase.priceCurrencyCode != "USD" || phase.priceAmountMicros <= 0 || phase.recurrenceMode != ProductDetails.RecurrenceMode.INFINITE_RECURRING) {
                    call.resolve(error("product_unavailable")); return@post
                }
                success(product, offer)
            } }
        } }
    }
    @PluginMethod fun getProducts(call: PluginCall) = withClient(call) { billing -> details(call, billing) { product, offer ->
        val phase = offer.pricingPhases.pricingPhaseList.single()
        call.resolve(JSObject().put("result", "available").put("productId", PRODUCT).put("basePlanId", BASE_PLAN).put("displayName", product.name)
            .put("displayPrice", phase.formattedPrice).put("currency", phase.priceCurrencyCode).put("billingPeriod", phase.billingPeriod).put("hasOffer", false).put("storefront", "US"))
    } }
    @PluginMethod fun purchase(call: PluginCall) = withClient(call) { billing ->
        if (purchaseCall != null) { call.resolve(error("billing_unavailable")); return@withClient }
        details(call, billing) { product, offer ->
            if (purchaseCall != null) { call.resolve(error("billing_unavailable")); return@details }
            purchaseCall = call
            val timeout = Runnable { failPurchase("billing_unavailable") }; purchaseTimeout = timeout; main.postDelayed(timeout, 120000)
            val item = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product).setOfferToken(offer.offerToken).build()
            val result = billing.launchBillingFlow(activity, BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(item)).build())
            if (result.responseCode != BillingClient.BillingResponseCode.OK) failPurchase(category(result.responseCode))
        }
    }
    private fun query(call: PluginCall) = withClient(call) { billing ->
        billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()) { result, purchases -> main.post {
            if (!destroyed) call.resolve(if (result.responseCode == BillingClient.BillingResponseCode.OK) evidence(purchases) else error(category(result.responseCode)))
        } }
    }
    @PluginMethod fun queryCurrentPurchases(call: PluginCall) = query(call)
    @PluginMethod fun restorePurchases(call: PluginCall) = query(call)
    @PluginMethod fun refreshEntitlement(call: PluginCall) = query(call)
    @PluginMethod fun startObserving(call: PluginCall) { main.post { observing = true; call.resolve(JSObject().put("observing", true)) } }
    @PluginMethod fun stopObserving(call: PluginCall) { main.post { observing = false; call.resolve(JSObject().put("observing", false)) } }
    override fun handleOnResume() { if (observing && !destroyed) notifyListeners("appForeground", JSObject().put("reason", "app_foreground")) }
    override fun handleOnDestroy() { main.post {
        destroyed = true; observing = false
        connectionTimeout?.let { main.removeCallbacks(it) }; connectionTimeout = null
        failPurchase("billing_unavailable")
        waiters.forEach { it.first.resolve(error("billing_unavailable")) }; waiters.clear()
        client?.endConnection(); client = null
    } }
    // Acknowledgment is exclusively LP244.62 server-side after verified reconciliation.
    // Native code cannot acknowledge/consume to conceal an unsuccessful verifier call.
}
