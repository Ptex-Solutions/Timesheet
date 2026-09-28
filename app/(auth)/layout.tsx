export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-surface">
      <aside className="hidden lg:flex relative bg-navy-gradient text-white p-12 flex-col justify-between overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-brand/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-brand/20 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-gradient flex items-center justify-center font-bold text-lg shadow-brand">
              P
            </div>
            <div>
              <p className="font-display text-xl font-semibold tracking-tight">Ptex</p>
              <p className="text-xs text-white/60 -mt-0.5">Management Dashboard</p>
            </div>
          </div>
        </div>
        <div className="relative z-10 max-w-md">
          <h1 className="font-display text-4xl font-bold leading-tight">
            Timesheets, MIS &amp; reporting,{" "}
            <span className="text-brand">unified.</span>
          </h1>
          <p className="mt-4 text-white/70 text-sm leading-relaxed">
            Submit weekly timesheets, run MIS sandboxes, reassign employee hours, and
            export client-ready reports — all in one secure dashboard.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/80">
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              Role-isolated employee &amp; admin portals
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              Sandbox MIS editor with full audit trail
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              Excel &amp; PDF exports matching original sheets
            </li>
          </ul>
        </div>
        <div className="relative z-10 text-xs text-white/50">
          © {new Date().getFullYear()} Ptex. All rights reserved.
        </div>
      </aside>
      <main className="flex items-center justify-center px-6 py-12">{children}</main>
    </div>
  );
}
