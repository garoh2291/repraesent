import { Outlet } from "react-router";
import { Sidebar } from "~/components/sidebar";

export default function DashboardLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />

      <main className="flex-1 min-w-0 m-4 overflow-y-auto bg-background">
        <Outlet />
      </main>
    </div>
  );
}
