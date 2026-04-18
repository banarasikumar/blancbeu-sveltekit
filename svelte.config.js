import adapterAuto from '@sveltejs/adapter-auto';
import adapterStatic from '@sveltejs/adapter-static';

const isAndroidBuild = process.env.ANDROID_BUILD === 'true';

const config = {
	kit: {
		adapter: isAndroidBuild 
			? adapterStatic({ fallback: 'app.html' }) 
			: adapterAuto(),
		// Ignore API endpoint rendering since they rely on literal node processes and cannot be physically baked into an APK
		prerender: {
			entries: isAndroidBuild ? [] : ['*']
		}
	}
};

export default config;
