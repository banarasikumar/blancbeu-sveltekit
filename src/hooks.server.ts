import { redirect, type Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const host = event.url.host;
	const path = event.url.pathname;
	const proto = event.request.headers.get('x-forwarded-proto') || 'https';

	// Force HTTPS: If the request came via HTTP, redirect to HTTPS
	if (proto === 'http') {
		throw redirect(301, `https://${host}${path}${event.url.search}`);
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
	response.headers.set(
		'Strict-Transport-Security',
		'max-age=31536000; includeSubDomains; preload'
	);

	return response;
};
