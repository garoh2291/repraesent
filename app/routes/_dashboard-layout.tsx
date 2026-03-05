import { Outlet } from "react-router";
import { Sidebar } from "~/components/sidebar";

export default function DashboardLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-sidebar">
      <Sidebar />

      <main className="border border-background flex-1 min-w-0 m-4 rounded-lg overflow-y-auto bg-background">
        <Outlet />
      </main>
    </div>
  );
}
