/**
 * Public liveness probe for load balancers and Uptime Kuma (no auth, no I/O).
 */
export async function loader() {
  return new Response("ok", {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
