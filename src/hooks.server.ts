import { redirect, type Handle, type HandleServerError } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebaseAdmin';
import admin from 'firebase-admin';

export const handle: Handle = async ({ event, resolve }) => {
	const host = event.url.host;
	const path = event.url.pathname;
	const proto = event.request.headers.get('x-forwarded-proto') || 'https';

	// Force HTTPS: If the request came via HTTP, redirect to HTTPS
	if (proto === 'http') {
		throw redirect(301, `https://${host}${path}${event.url.search}`);
	}

	// Redirect rogue /favicon.ico requests to the correct app-specific PNG icon
	if (path === '/favicon.ico') {
		if (host.includes('admin.blancbeu.in')) {
			throw redirect(301, '/admin-favicon.png');
		} else if (host.includes('staff.blancbeu.in')) {
			throw redirect(301, '/staff-favicon.png');
		} else {
			throw redirect(301, '/favicon.png');
		}
	}

	// Skip routing for static files, manifest, and api routes inside the handler
	// to prevent infinite redirect loops on subdomains.
	if (path.startsWith('/_app/') || path.startsWith('/api/') || path.includes('.')) {
		return resolve(event);
	}

	// 1. Handle Admin Subdomain
	if (host.includes('admin.blancbeu.in')) {
		// If on admin subdomain but the path doesn't start with /admin, prefix it
		if (!path.startsWith('/admin')) {
			// e.g. admin.blancbeu.in/login -> admin.blancbeu.in/admin/login
			// Under the hood, SvelteKit will process this as /admin/login
			// We use a redirect here because rewriting might clash with Vercel's SPA hydration
			throw redirect(302, `/admin${path === '/' ? '' : path}${event.url.search}`);
		}
	}

	// 2. Handle Staff Subdomain
	if (host.includes('staff.blancbeu.in')) {
		if (!path.startsWith('/staff')) {
			throw redirect(302, `/staff${path === '/' ? '' : path}${event.url.search}`);
		}
	}

	// 3. Prevent primary domain from accessing /admin or /staff directly to keep urls clean
	if (host === 'www.blancbeu.in' || host === 'blancbeu.in') {
		if (path.startsWith('/admin')) {
			throw redirect(
				302,
				`https://admin.blancbeu.in${path.replace('/admin', '')}${event.url.search}`
			);
		}
		if (path.startsWith('/staff')) {
			throw redirect(
				302,
				`https://staff.blancbeu.in${path.replace('/staff', '')}${event.url.search}`
			);
		}
	}

	// Resolve the request and add security headers
	const response = await resolve(event);

	// HSTS: Tell browsers to ALWAYS use HTTPS for this domain (1 year, include subdomains)
	response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

	return response;
};

export const handleError: HandleServerError = async ({ error, event }) => {
	const errorObj = error as any;
	const status = errorObj?.status ?? 500;

	// Ignore 404 Not Found errors (like missing /favicon.ico)
	if (status === 404) {
		return { message: 'Not found' };
	}

	console.error('Unhandled Server Error:', errorObj);

	try {
		// Find admin tokens to notify them of the actual unmasked error
		const usersSnapshot = await adminDb.collection('users').where('role', '==', 'admin').get();
		const tokens: string[] = [];

		usersSnapshot.forEach((doc) => {
			const data = doc.data();
			if (Array.isArray(data.adminFcmTokens)) {
				tokens.push(...data.adminFcmTokens);
			}
		});

		const uniqueTokens = [...new Set(tokens)];

		if (uniqueTokens.length > 0) {
			const fcmMessage = {
				notification: {
					title: `Critical System Error (${status})`,
					body: `Path: ${event.url.pathname}\nMessage: ${errorObj?.message || 'Unknown internal error'}`
				},
				data: {
					icon: '/admin-icon-192.png'
				},
				android: {
					priority: 'high' as const
				},
				tokens: uniqueTokens
			};

			// Fire and forget so we don't block the error response
			admin
				.messaging()
				.sendEachForMulticast(fcmMessage)
				.catch((err) => {
					console.error('Failed to send admin error notification:', err);
				});
		}
	} catch (notifyError) {
		console.error('Failed to retrieve admin tokens for error notification:', notifyError);
	}

	return {
		message: 'Internal Error'
	};
};
