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
			// Don't include 'sound' — we handle in-app notification sound ourselves.
			// Including 'sound' here causes the OS to also play system sound.
			presentationOptions: ['badge', 'alert']
		},
		LocalNotifications: {
			smallIcon: 'ic_stat_notification',
			iconColor: '#7c3aed'
		},
		StatusBar: {
			overlaysWebView: false,
			style: 'LIGHT',
			backgroundColor: '#f5f5f7'
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
