package app.lazyfit.personal

import android.content.Intent
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.lifecycle.lifecycleScope
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

internal val stepPermission = HealthPermission.getReadPermission(StepsRecord::class)

@CapacitorPlugin(name = "LazyHealth")
class LazyHealthPlugin : Plugin() {
    private fun run(call: PluginCall, work: suspend () -> Unit) {
        activity.lifecycleScope.launch {
            try {
                work()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (denied: SecurityException) {
                call.reject("ต้องอนุญาตให้อ่านก้าวก่อน", "PERMISSION_REQUIRED", denied)
            } catch (error: Exception) {
                call.reject("เปิดหรืออ่านข้อมูล Health Connect ไม่สำเร็จ", error)
            }
        }
    }

    private suspend fun state(): String = when (HealthConnectClient.getSdkStatus(context)) {
        HealthConnectClient.SDK_AVAILABLE -> {
            val granted = HealthConnectClient.getOrCreate(context).permissionController.getGrantedPermissions()
            if (stepPermission in granted) "granted" else "permission_required"
        }
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update_required"
        else -> "unavailable"
    }

    @PluginMethod
    fun status(call: PluginCall) = run(call) {
        call.resolve(JSObject().put("state", state()))
    }

    @PluginMethod
    fun request(call: PluginCall) = run(call) {
        val current = state()
        if (current == "permission_required") {
            startActivityForResult(call, Intent(activity, StepPermissionActivity::class.java), "permissionResult")
        } else {
            call.resolve(JSObject().put("state", current))
        }
    }

    @ActivityCallback
    private fun permissionResult(call: PluginCall?, result: ActivityResult) {
        if (call != null) status(call)
    }

    @PluginMethod
    fun today(call: PluginCall) = run(call) {
        if (state() != "granted") {
            call.reject("ต้องอนุญาตให้อ่านก้าวก่อน", "PERMISSION_REQUIRED")
            return@run
        }
        val zone = ZoneId.systemDefault()
        val now = Instant.now()
        val day = LocalDate.parse(call.getString("day") ?: "")
        if (day != now.atZone(zone).toLocalDate()) {
            call.reject("วันที่เปลี่ยนแล้ว ลองอ่านก้าวอีกครั้ง", "DAY_CHANGED")
            return@run
        }

        val start = day.atStartOfDay(zone).toInstant()
        val steps = if (start < now) {
            HealthConnectClient.getOrCreate(context).aggregate(
                AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), TimeRangeFilter.between(start, now))
            )[StepsRecord.COUNT_TOTAL]
        } else null
        val response = JSObject()
        if (steps == null) response.put("steps", JSONObject.NULL) else response.put("steps", steps)
        call.resolve(response)
    }
}

