export const PUBLIC_ROUTES = ["/login", "/auth/callback"] as const;

export const isPublicRoute = (pathname: string): boolean => {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
};
