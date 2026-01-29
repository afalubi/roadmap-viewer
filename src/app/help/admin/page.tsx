import { getAuthUser } from '@/lib/usersAccess';

export default async function AdminHelpPage() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-12">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">Admin Help</h1>
          <p className="text-sm text-slate-600">
            Sign in to view this documentation.
          </p>
        </header>
      </main>
    );
  }

  if (!authUser.roles.isSystemAdmin) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-12">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">Admin Help</h1>
          <p className="text-sm text-slate-600">
            You do not have access to admin documentation.
          </p>
        </header>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900" id="admin">
          Admin Help
        </h1>
        <p className="text-sm text-slate-600">
          Admin-only workflows and guidance will live here.
        </p>
      </header>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              User management
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              <li>Open the Admin panel from the header.</li>
              <li>Search by email to locate a specific user.</li>
              <li>Toggle System Admin or Creator access as needed.</li>
              <li>Admins can see all roadmaps regardless of shares.</li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Audit log
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              <li>Use the Audit tab to review recent actions.</li>
              <li>Filter by action or search metadata.</li>
              <li>Use the log to confirm sharing changes and deletes.</li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Governance
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              <li>Keep at least one system admin at all times.</li>
              <li>Review creator access regularly.</li>
              <li>Use view links for broad read-only access.</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
