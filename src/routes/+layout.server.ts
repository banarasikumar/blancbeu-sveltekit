import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ url }) => {
    const host = url.host;
    const path = url.pathname;

    // Skip localhost for easy development
    if (host.includes('localhost') || host.includes('127.0.0.1')) return;

    // Enforce Admin portal routing
    // If the domain is admin.blancbeu.in, the URL MUST physically start with /admin
    if (host === 'admin.blancbeu.in' && !path.startsWith('/admin')) {
        throw redirect(302, `/admin${path === '/' ? '' : path}${url.search}`);
    }

    // Enforce Staff portal routing
    // If the domain is staff.blancbeu.in, the URL MUST physically start with /staff
    if (host === 'staff.blancbeu.in' && !path.startsWith('/staff')) {
        throw redirect(302, `/staff${path === '/' ? '' : path}${url.search}`);
    }

    // Protect sub-routes from being accessed via the primary user domain
    // This acts as a strict wall ensuring maximum environment absolute isolation
    if ((host === 'www.blancbeu.in' || host === 'blancbeu.in') && (path.startsWith('/admin') || path.startsWith('/staff'))) {
        const targetHost = path.startsWith('/admin') ? 'https://admin.blancbeu.in' : 'https://staff.blancbeu.in';
        throw redirect(302, `${targetHost}${path}${url.search}`);
    }
};
