package app.lazyfit.personal;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LazyHealthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

