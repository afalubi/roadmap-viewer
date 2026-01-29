import 'server-only';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { ensureUserRoles, getUserRoles, upsertUser } from '@/lib/usersDb';
import type { IdentityProvider, UserRoles } from '@/types/users';

type ClerkUser = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  primaryEmailAddress?: { emailAddress?: string | null } | null;
  emailAddresses?: Array<{ emailAddress?: string | null }>;
};

const getEmailFromClerk = (user: ClerkUser): string | null =>
  user.primaryEmailAddress?.emailAddress ??
  user.emailAddresses?.[0]?.emailAddress ??
  null;

const getDisplayNameFromClerk = (user: ClerkUser): string | null => {
  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return name || user.username || getEmailFromClerk(user);
};

export type AuthUser = {
  id: string;
  idp: IdentityProvider;
  externalId: string;
  email: string | null;
  displayName: string | null;
  roles: UserRoles;
};

export async function getAuthUser(): Promise<AuthUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const client = await clerkClient();
  let user: ClerkUser | null = null;
  try {
    user = await client.users.getUser(userId);
  } catch {
    user = null;
  }

  const email = user ? getEmailFromClerk(user) : null;
  const displayName = user ? getDisplayNameFromClerk(user) : null;
  const idp: IdentityProvider = 'clerk';
  const externalId = userId;

  await upsertUser({
    id: userId,
    idp,
    externalId,
    email,
    displayName,
  });
  await ensureUserRoles(userId);
  const roles = await getUserRoles(userId);

  return {
    id: userId,
    idp,
    externalId,
    email,
    displayName,
    roles,
  };
}

export async function requireAuthUser(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function isSystemAdmin(userId: string): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.isSystemAdmin;
}

export async function canCreateRoadmaps(userId: string): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.canCreateRoadmaps || roles.isSystemAdmin;
}
