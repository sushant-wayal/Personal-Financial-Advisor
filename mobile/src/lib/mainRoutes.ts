export const MAIN_ROUTES = ["/", "/transactions", "/goals", "/settings"] as const;

export type MainRoute = (typeof MAIN_ROUTES)[number];

export function routeIndex(route: string) {
    const index = MAIN_ROUTES.indexOf(route as MainRoute);
    return index >= 0 ? index : 0;
}

export function routeAtIndex(index: number) {
    return MAIN_ROUTES[Math.max(0, Math.min(MAIN_ROUTES.length - 1, index))];
}

export function mainRouteForPath(pathname: string): MainRoute | null {
    if (pathname === "/") return "/";
    if (pathname.startsWith("/transactions") || pathname.startsWith("/subscriptions") || pathname.startsWith("/insights")) return "/transactions";
    if (pathname.startsWith("/goals") || pathname.startsWith("/simulation")) return "/goals";
    if (pathname.startsWith("/settings")) return "/settings";
    return null;
}