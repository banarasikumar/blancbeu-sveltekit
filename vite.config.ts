import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		sveltekit(),
		VitePWA({
			strategies: 'injectManifest',
			srcDir: 'src',
			filename: 'sw.ts',
			registerType: 'autoUpdate',
			injectRegister: 'auto',
			injectManifest: {
				globPatterns: ['**/*.{js,css,html,ico,woff,woff2,ttf,json}'],
				globIgnores: ['**/node_modules/**', '**/dev-dist/**']
			},
			manifest: false // Multi-scope: Manifests are handled manually in static/
		})
	],
	server: {
		host: true,
		allowedHosts: ['staff.blancbeu.in', 'admin.blancbeu.in', 'www.blancbeu.in', 'blancbeu.in']
	},
	optimizeDeps: {
		include: ['jspdf-autotable']
	},
	ssr: {
		noExternal: ['jspdf-autotable'],
		external: ['firebase-admin']
	},
	build: {
		minify: 'esbuild',
		cssCodeSplit: true,
		rollupOptions: {
			output: {
				manualChunks: (id) => {
					if (id.includes('node_modules')) {
						if (id.includes('firebase')) return 'firebase';
						return 'vendor';
					}
				}
			}
		}
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
