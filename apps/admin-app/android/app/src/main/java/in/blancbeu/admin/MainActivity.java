package in.blancbeu.admin;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannels();
    }

    /**
     * Create notification channels at app startup so they always exist —
     * even before the WebView/JS code runs. This ensures the OS can display
     * notifications on the correct channel when the app is killed.
     */
    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);

            NotificationChannel bookings = new NotificationChannel(
                "bookings", "Core Notifications", NotificationManager.IMPORTANCE_HIGH
            );
            bookings.setDescription("New bookings, cancellations, and updates");
            bookings.enableVibration(true);
            bookings.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

            NotificationChannel general = new NotificationChannel(
                "general", "Broadcasts", NotificationManager.IMPORTANCE_HIGH
            );
            general.setDescription("System-wide broadcasts and announcements");
            general.enableVibration(true);
            general.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

            manager.createNotificationChannel(bookings);
            manager.createNotificationChannel(general);
        }
    }
}
