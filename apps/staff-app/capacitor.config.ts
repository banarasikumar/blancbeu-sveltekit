import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the Blancbeu Staff native Android app.
 */
const config: CapacitorConfig = {
	appId: 'in.blancbeu.staff',
	appName: 'Blancbeu Stylist',
	// The Live Wrapper Configuration
	webDir: 'www',
	server: {
		url: process.env.CAPACITOR_SERVER_URL || 'https://blancbeu-sveltekit.vercel.app/staff',
		cleartext: true,
		errorPath: 'offline.html'
	},

	android: {
		allowMixedContent: false,
		// This user agent triggers the auto-redirect to /staff
		appendUserAgent: 'BlancbeuStaffNative'
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
		},
		StatusBar: {
			overlaysWebView: false,
			style: 'LIGHT',
			backgroundColor: '#f4f2ff'
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
