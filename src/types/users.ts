export type IdentityProvider = 'clerk' | 'azure_ad';

export type UserRoles = {
  isSystemAdmin: boolean;
  canCreateRoadmaps: boolean;
  canViewCapacity: boolean;
};

export type UserRecord = {
  id: string;
  idp: IdentityProvider;
  externalId: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserSummary = UserRecord &
  UserRoles & {
    ownedCount: number;
    sharedCount: number;
  };
