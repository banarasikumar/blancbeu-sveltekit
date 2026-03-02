import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
    const host = event.url.host;
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

    // ONLY intercept the domain if we are in production
    if (!isLocalhost) {
        if (host === 'admin.blancbeu.in') {
            // Secretly rewrite the URL internal path to point to /admin/*
            // Ex: admin.blancbeu.in/dashboard -> runs code for blancsbeu.in/admin/dashboard
            const adminUrl = new URL(event.url);
            adminUrl.pathname = `/admin${adminUrl.pathname}`;
            return resolve({ ...event, url: adminUrl });
        }

        if (host === 'staff.blancbeu.in') {
            const staffUrl = new URL(event.url);
            staffUrl.pathname = `/staff${staffUrl.pathname}`;
            return resolve({ ...event, url: staffUrl });
        }
    }

    return resolve(event);
};
