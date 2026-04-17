import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the Blancbeu Staff native Android app.
 */
const config: CapacitorConfig = {
	appId: 'in.blancbeu.staff',
	appName: 'Blancbeu Stylist',
	webDir: '../../build',

	// The Live Wrapper Configuration
	server: {
		url: process.env.CAPACITOR_SERVER_URL || 'https://blancbeu-sveltekit.vercel.app',
		cleartext: true
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
