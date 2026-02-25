import {
  type RouteConfig,
  index,
  route,
  layout,
} from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("auth/callback", "routes/auth.callback.tsx"),

  layout("routes/_protected.tsx", [
    route("auth/workspace-picker", "routes/auth.workspace-picker.tsx"),
    layout("routes/_dashboard-layout.tsx", [
      index("routes/home.tsx"),
      route("lead-form", "routes/lead-form.tsx"),
      route("lead-form/:leadId", "routes/lead-form.$leadId.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
