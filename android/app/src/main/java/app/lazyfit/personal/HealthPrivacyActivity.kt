package app.lazyfit.personal

import android.app.Activity
import android.os.Bundle
import android.widget.ScrollView
import android.widget.TextView

class HealthPrivacyActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val message = TextView(this).apply {
            setPadding(48, 48, 48, 48)
            textSize = 18f
            text = getString(R.string.health_privacy)
        }
        setContentView(ScrollView(this).apply { addView(message) })
    }
}

