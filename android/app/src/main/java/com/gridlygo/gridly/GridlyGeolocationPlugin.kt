package com.gridlygo.gridly

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.CancellationSignal
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

@CapacitorPlugin(
    name = "GridlyGeolocation",
    permissions = [Permission(
        alias = "location",
        strings = [Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION]
    )]
)
class GridlyGeolocationPlugin : Plugin() {
    @PluginMethod
    fun getCurrentPosition(call: PluginCall) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "locationPermissionResult")
            return
        }
        continueCurrentPosition(call)
    }

    @PermissionCallback
    private fun locationPermissionResult(call: PluginCall) {
        if (getPermissionState("location") == PermissionState.GRANTED) {
            continueCurrentPosition(call)
        } else {
            call.reject("Location permission was denied.", "permission_denied")
        }
    }

    private fun continueCurrentPosition(call: PluginCall) {
        val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        val provider = when {
            manager?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true -> LocationManager.GPS_PROVIDER
            manager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true -> LocationManager.NETWORK_PROVIDER
            else -> null
        }
        if (manager == null || provider == null) {
            call.reject("Location service is unavailable.", "location_unavailable")
            return
        }
        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Location permission was denied.", "permission_denied")
            return
        }
        // LocationManagerCompat delegates to framework getCurrentLocation on
        // API 30+ and supplies its one-shot listener fallback on API 24-29.
        // ContextCompat likewise avoids an unguarded Context.getMainExecutor
        // call below API 28.
        LocationManagerCompat.getCurrentLocation(
            manager,
            provider,
            CancellationSignal(),
            ContextCompat.getMainExecutor(context)
        ) { location ->
            if (location == null) {
                call.reject("No current location is available.", "location_unavailable")
                return@getCurrentLocation
            }
            val result = JSObject()
            val coordinates = JSObject()
            coordinates.put("latitude", location.latitude)
            coordinates.put("longitude", location.longitude)
            coordinates.put("accuracy", location.accuracy)
            result.put("coords", coordinates)
            call.resolve(result)
        }
    }
}
