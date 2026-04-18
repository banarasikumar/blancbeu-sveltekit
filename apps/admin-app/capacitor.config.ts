import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the Blancbeu Admin native Android app.
 */
const config: CapacitorConfig = {
	appId: 'in.blancbeu.admin',
	appName: 'Blancbeu Admin',
	webDir: '../../build',



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
