import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the Blancbeu Admin native Android app.
 */
const config: CapacitorConfig = {
	appId: 'in.blancbeu.admin',
	appName: 'Blancbeu Admin',
	webDir: '../../build',

	// The Live Wrapper Configuration
	server: {
		url: process.env.CAPACITOR_SERVER_URL || 'https://blancbeu-sveltekit.vercel.app',
		cleartext: true
	},

	android: {
		allowMixedContent: false,
		// This user agent triggers the auto-redirect to /admin
		appendUserAgent: 'BlancbeuAdminNative'
	},

	plugins: {
		PushNotifications: {
			presentationOptions: ['badge', 'sound', 'alert']
		},
		LocalNotifications: {
			smallIcon: 'ic_stat_notification',
			iconColor: '#eab308' // Gold theme accent
		}
	}
};

export default config;
