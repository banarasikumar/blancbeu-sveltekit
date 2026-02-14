import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

// Store scroll positions per route
const scrollPositions = writable<Record<string, number>>({});

// Track visited routes in this session
const visitedRoutes = writable<Set<string>>(new Set());

// Global navigation lock to prevent overlapping scrolls
let isRestoring = false;
let restoreTimeout: any = null;

/**
 * Helper to get the current scroll container
 */
function getScrollContainer(): HTMLElement | Window | null {
    if (!browser) return null;
    const mobileViewport = document.getElementById('mobile-viewport');
    // Ensure element is actually in the DOM
    if (mobileViewport && document.body.contains(mobileViewport)) {
        return mobileViewport;
    }
    return window;
}

/**
 * Helper to get scroll Y position
 */
function getScrollY(container: HTMLElement | Window | null): number {
    if (!container) return 0;
    if (container instanceof Window) {
        return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    }
    return (container as HTMLElement).scrollTop;
}

/**
 * Save current scroll position for a route
 */
export function saveScrollPosition(route: string): void {
    if (!browser) return;

    // Don't save if we are currently mid-restore
    if (isRestoring) return;

    const container = getScrollContainer();
    const scrollY = getScrollY(container);

    scrollPositions.update((positions) => ({
        ...positions,
        [route]: scrollY
    }));
}

/**
 * Restore scroll position for a route
 * Returns true if position was restored, false if this is first visit
 */
export function restoreScrollPosition(route: string): boolean {
    if (!browser) return false;

    // CANCEL ANY PENDING LOOPS
    if (restoreTimeout) {
        clearTimeout(restoreTimeout);
        restoreTimeout = null;
    }
    isRestoring = true;

    const visited = get(visitedRoutes);
    const positions = get(scrollPositions);

    // Mark as visited
    visitedRoutes.update((v) => {
        v.add(route);
        return v;
    });

    const performScroll = (y: number) => {
        const container = getScrollContainer();
        if (!container) return;

        if (container instanceof Window) {
            window.scrollTo(0, y);
        } else {
            container.scrollTop = y;
        }
    };

    // release lock after a moment
    setTimeout(() => { isRestoring = false; }, 100);

    // If previously visited and has saved position, restore it
    if (visited.has(route) && positions[route] !== undefined) {
        const targetScroll = positions[route];
        performScroll(targetScroll);

        // Single retry for layout shifts (no loops)
        restoreTimeout = setTimeout(() => {
            performScroll(targetScroll);
        }, 20);

        return true;
    }

    // Unvisited: Force Top
    performScroll(0);
    return false;
}

/**
 * Scroll to top smoothly
 */
export function scrollToTop(): void {
    const container = getScrollContainer();
    if (container) {
        if (container instanceof Window) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            container.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
}

export function hasVisitedRoute(route: string): boolean {
    return get(visitedRoutes).has(route);
}

export function clearScrollPositions(): void {
    scrollPositions.set({});
    visitedRoutes.set(new Set());
}

export { scrollPositions, visitedRoutes };
