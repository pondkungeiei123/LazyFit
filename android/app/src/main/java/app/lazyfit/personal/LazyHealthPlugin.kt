package app.lazyfit.personal

import android.content.Intent
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import org.json.JSONArray
import java.time.Duration
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

internal val sleepPermission = HealthPermission.getReadPermission(SleepSessionRecord::class)
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
                call.reject("สิทธิ์ Health Connect เปลี่ยนแล้ว กรุณาตรวจสิทธิ์อีกครั้ง", "PERMISSION_REQUIRED", denied)
            } catch (error: Exception) {
                call.reject("เปิดหรืออ่านข้อมูล Health Connect ไม่สำเร็จ", error)
            }
        }
    }

    private suspend fun state(kind: String? = null): String = when (HealthConnectClient.getSdkStatus(context)) {
        HealthConnectClient.SDK_AVAILABLE -> {
            val granted = HealthConnectClient.getOrCreate(context).permissionController.getGrantedPermissions()
            if ((if (kind == "sleep") sleepPermission else stepPermission) in granted) "granted" else "permission_required"
        }
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update_required"
        else -> "unavailable"
    }

    @PluginMethod
    fun status(call: PluginCall) = run(call) {
        call.resolve(JSObject().put("state", state(call.getString("kind"))))
    }

    @PluginMethod
    fun request(call: PluginCall) = run(call) {
        val current = state(call.getString("kind"))
        if (current == "permission_required") {
            startActivityForResult(call, Intent(activity, StepPermissionActivity::class.java).putExtra("kind",call.getString("kind")), "permissionResult")
        } else {
            call.resolve(JSObject().put("state", current))
        }
    }

    @ActivityCallback
    private fun permissionResult(call: PluginCall?, result: ActivityResult) {
        if (call != null) status(call)
    }

    @PluginMethod
    fun sleep(call: PluginCall) = run(call) {
        if (state("sleep") != "granted") {
            call.reject("ต้องอนุญาตให้อ่านการนอนก่อน", "PERMISSION_REQUIRED")
            return@run
        }
        val client = HealthConnectClient.getOrCreate(context)
        val now = Instant.now()
        val range = TimeRangeFilter.between(now.minus(Duration.ofDays(30)), now)
        val rows = JSONArray()
        var token: String? = null
        do {
            val page = client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, range, pageToken = token))
            for (record in page.records) {
                val duration = Duration.between(record.startTime, record.endTime)
                if (duration.toMinutes() < 1 || duration > Duration.ofDays(1) || record.endTime > now) continue
                val stages = JSONObject()
                for (stage in record.stages) {
                    val key = when (stage.stage) {
                        SleepSessionRecord.STAGE_TYPE_LIGHT -> "light"
                        SleepSessionRecord.STAGE_TYPE_DEEP -> "deep"
                        SleepSessionRecord.STAGE_TYPE_REM -> "rem"
                        SleepSessionRecord.STAGE_TYPE_AWAKE, SleepSessionRecord.STAGE_TYPE_AWAKE_IN_BED,
                        SleepSessionRecord.STAGE_TYPE_OUT_OF_BED -> "awake"
                        else -> continue
                    }
                    stages.put(key, stages.optDouble(key, 0.0) + Duration.between(stage.startTime, stage.endTime).toMillis() / 60000.0)
                }
                rows.put(JSONObject().put("id",record.metadata.id).put("origin",record.metadata.dataOrigin.packageName)
                    .put("start",record.startTime.toString()).put("end",record.endTime.toString()).put("stages",stages))
            }
            token = page.pageToken
        } while (token != null)
        call.resolve(JSObject().put("records",rows))
    }

    @PluginMethod
    fun today(call: PluginCall) = run(call) {
        if (state() != "granted") {
            call.reject("ต้องอนุญาตให้อ่านก้าวก่อน", "PERMISSION_REQUIRED")
            return@run
        }
        val zone = ZoneId.of("Asia/Bangkok")
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

