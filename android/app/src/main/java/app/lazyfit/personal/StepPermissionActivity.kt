package app.lazyfit.personal

import android.app.Activity
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController

class StepPermissionActivity : ComponentActivity() {
    private val permission = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { granted ->
        setResult(if (stepPermission in granted) Activity.RESULT_OK else Activity.RESULT_CANCELED)
        finish()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (savedInstanceState != null) return
        if (HealthConnectClient.getSdkStatus(this) != HealthConnectClient.SDK_AVAILABLE) {
            finish()
            return
        }
        permission.launch(setOf(stepPermission))
    }
}

