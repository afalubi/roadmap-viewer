import { sql } from '@/lib/neon';
import { ensureRoadmapsSchema } from '@/lib/roadmapsDb';
import type { UserRoles } from '@/types/users';

export type HelpSection = 'viewer' | 'creator' | 'editor' | 'owner' | 'admin';

export type HelpVisibility = {
  sections: Record<HelpSection, boolean>;
  primary: HelpSection;
};

export async function getHelpVisibility(
  userId: string,
  roles: UserRoles,
): Promise<HelpVisibility> {
  if (roles.isSystemAdmin) {
    return {
      sections: {
        viewer: true,
        creator: true,
        editor: true,
        owner: true,
        admin: true,
      },
      primary: 'admin',
    };
  }

  await ensureRoadmapsSchema();
  const shareRows = await sql`
    SELECT role
    FROM roadmap_shares
    WHERE user_id = ${userId} AND role IN ('owner','editor')
  `;
  const hasOwner = shareRows.some((row: any) => row.role === 'owner');
  const hasEditor = hasOwner || shareRows.some((row: any) => row.role === 'editor');
  const canCreate = roles.canCreateRoadmaps;

  const sections = {
    viewer: true,
    creator: canCreate || hasEditor,
    editor: hasEditor,
    owner: hasOwner,
    admin: false,
  };

  const primary: HelpSection = hasOwner
    ? 'owner'
    : hasEditor
      ? 'editor'
      : canCreate
        ? 'creator'
        : 'viewer';

  return { sections, primary };
}
