import { getAuthUser } from '@/lib/usersAccess';
import { getHelpVisibility } from '@/lib/helpAccess';

export default async function HelpPage() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-12">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">Help</h1>
          <p className="text-sm text-slate-600">
            Sign in to view role-specific guides.
          </p>
        </header>
      </main>
    );
  }

  const help = await getHelpVisibility(authUser.id, authUser.roles);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Help</h1>
      </header>

      <nav className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-sm">
        <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">
          Jump to
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {help.sections.viewer ? <JumpLink href="#viewer" label="Viewer" /> : null}
          {help.sections.editor ? <JumpLink href="#editor" label="Editor" /> : null}
          {help.sections.creator ? <JumpLink href="#creator" label="Creator" /> : null}
          {help.sections.owner ? <JumpLink href="#owner" label="Owner" /> : null}
        </div>
      </nav>

      <section className="grid gap-4">
        {help.sections.viewer ? <ViewerDocs /> : null}
        {help.sections.editor ? <EditorDocs /> : null}
        {help.sections.creator ? <CreatorDocs /> : null}
        {help.sections.owner ? <OwnerDocs /> : null}
      </section>
    </main>
  );
}

function JumpLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-full border border-slate-200 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-600 hover:border-slate-300 hover:bg-slate-50"
    >
      {label}
    </a>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-600">{description}</p>
      </div>
      <div className="mt-4 space-y-4 text-sm text-slate-700">{children}</div>
    </section>
  );
}

function ViewerDocs() {
  return (
    <Section
      id="viewer"
      title="Viewer guide"
      description="Finding roadmaps, navigating the timeline, and reading details."
    >
      <DocBlock title="Find and open roadmaps">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Open the roadmap selector in the header.</li>
          <li>Select a roadmap you have access to.</li>
          <li>If you were sent a view link, open it directly from that URL.</li>
        </ol>
        <p className="mt-2 text-xs text-slate-500">
          Tip: if the selector is empty, ask an owner to share a roadmap with you.
        </p>
      </DocBlock>
      <DocBlock title="Use filters to focus">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Filter by pillar, region, and criticality to narrow the list.</li>
          <li>Clear filters to return to the full roadmap.</li>
          <li>Filters also affect saved views and shared links.</li>
        </ul>
      </DocBlock>
      <DocBlock title="Navigate the timeline">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Scroll horizontally to move through quarters.</li>
          <li>Swimlanes group items by pillar.</li>
          <li>Timeline bars show start and end dates for each item.</li>
        </ul>
      </DocBlock>
      <DocBlock title="Read item details">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Click any item to open the detail panel.</li>
          <li>Short and long descriptions support markdown formatting.</li>
          <li>Review dates, sponsor, stakeholders, and criticality.</li>
        </ul>
      </DocBlock>
      <DocBlock title="Troubleshooting">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>If items are missing, clear filters and refresh the page.</li>
          <li>If a view link prompts for a password, ask the sender.</li>
        </ul>
      </DocBlock>
    </Section>
  );
}

function EditorDocs() {
  return (
    <Section
      id="editor"
      title="Editor guide"
      description="Sharing access, managing views, and keeping roadmaps aligned."
    >
      <DocBlock title="Share access with users">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Open the Share dialog from the header.</li>
          <li>Search for a user by email.</li>
          <li>Assign viewer or editor access and save.</li>
          <li>Update or revoke access as needed.</li>
        </ol>
        <p className="mt-2 text-xs text-slate-500">
          Editors can share access but cannot delete a roadmap.
        </p>
      </DocBlock>
      <DocBlock title="Create and share views">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Apply filters and layout settings.</li>
          <li>Save the current state as a view.</li>
          <li>Create a view link for read-only access.</li>
          <li>Rotate or remove links to invalidate access.</li>
        </ol>
      </DocBlock>
      <DocBlock title="Maintain accuracy">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Review date ranges to keep items in the correct quarters.</li>
          <li>Verify sponsors, stakeholders, and criticality labels.</li>
          <li>Coordinate with owners on data source updates.</li>
        </ul>
      </DocBlock>
    </Section>
  );
}

function CreatorDocs() {
  return (
    <Section
      id="creator"
      title="Creator guide"
      description="Creating roadmaps and setting up data sources."
    >
      <DocBlock title="Create a roadmap">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Open the roadmap selector menu.</li>
          <li>Select “Create new roadmap.”</li>
          <li>Name the roadmap and confirm creation.</li>
          <li>You are automatically assigned as the owner.</li>
        </ol>
      </DocBlock>
      <DocBlock title="Set up data sources">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>CSV: upload or replace CSV data in the datasource panel.</li>
          <li>ADO: map fields, validate, and sync work items.</li>
          <li>Review validation warnings for missing fields.</li>
        </ul>
      </DocBlock>
      <DocBlock title="Manage views and sharing">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Create baseline views for stakeholders.</li>
          <li>Share the roadmap with editors for ongoing updates.</li>
        </ul>
      </DocBlock>
      <DocBlock title="Adjust appearance">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Use the Theme Editor to preview light/dark palettes.</li>
          <li>Apply overrides to align with branding.</li>
          <li>Save changes to persist overrides for the roadmap.</li>
        </ul>
      </DocBlock>
    </Section>
  );
}

function OwnerDocs() {
  return (
    <Section
      id="owner"
      title="Owner guide"
      description="Full control of a roadmap and advanced sharing."
    >
      <DocBlock title="Ownership responsibilities">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Manage editors and viewers who can access the roadmap.</li>
          <li>Keep data sources current and validated.</li>
          <li>Monitor overall roadmap quality and completeness.</li>
        </ul>
      </DocBlock>
      <DocBlock title="Delete or rename roadmaps">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Use the Manage roadmaps dialog to rename.</li>
          <li>Deletion is permanent and removes all shares.</li>
          <li>Confirm with stakeholders before deleting.</li>
        </ul>
      </DocBlock>
      <DocBlock title="Access controls">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Owners can grant or revoke editor and viewer roles.</li>
          <li>Owners cannot grant system admin access (admins only).</li>
        </ul>
      </DocBlock>
    </Section>
  );
}

function DocBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </div>
      <div className="mt-2 text-sm text-slate-700">{children}</div>
    </div>
  );
}
