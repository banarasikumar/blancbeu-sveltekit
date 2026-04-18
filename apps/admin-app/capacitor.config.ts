import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the Blancbeu Admin native Android app.
 */
const config: CapacitorConfig = {
	appId: 'in.blancbeu.admin',
	appName: 'Blancbeu Admin',
	// The Live Wrapper Configuration
	webDir: 'www',
	server: {
		url: process.env.CAPACITOR_SERVER_URL || 'https://blancbeu-sveltekit.vercel.app/admin',
		cleartext: true,
		errorPath: 'offline.html'
	},

	android: {
		allowMixedContent: false,
		// This user agent triggers the auto-redirect to /admin
		appendUserAgent: 'BlancbeuAdminNative'
	},

	plugins: {
		FirebaseAuthentication: {
			skipNativeAuth: false,
			providers: ['google.com']
		},
		PushNotifications: {
			presentationOptions: ['badge', 'sound', 'alert']
		},
		LocalNotifications: {
			smallIcon: 'ic_stat_notification',
			iconColor: '#7c3aed'
		}
	},

	includePlugins: [
		'@capacitor-firebase/authentication',
		'@capacitor/push-notifications',
		'@capacitor/app',
		'@capacitor/browser'
	]
};

export default config;
