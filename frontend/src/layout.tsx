import { Outlet } from "react-router-dom";

export function Layout() {
  return (
    <div class="relative min-h-screen text-violet-50">
      <div
        aria-hidden="true"
        class="pointer-events-none fixed inset-0 -z-10 opacity-30 [background-image:linear-gradient(to_right,rgba(143,112,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(143,112,255,0.07)_1px,transparent_1px)] [background-size:42px_42px]"
      />
      <div
        aria-hidden="true"
        class="pointer-events-none fixed inset-0 -z-10 [background:radial-gradient(circle_at_18%_22%,rgba(255,255,255,0.08),transparent_8%),radial-gradient(circle_at_76%_78%,rgba(255,255,255,0.06),transparent_8%)]"
      />
      <Outlet />
    </div>
  );
}
