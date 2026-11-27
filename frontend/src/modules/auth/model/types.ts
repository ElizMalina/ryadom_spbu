/** Demo RBAC contract. A guest is represented by null, never a database role. */
export const USER_ROLES = ['student', 'consultant', 'psychologist', 'admin', 'moderator', 'reviewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  student: 'Студент',
  consultant: 'Консультант',
  psychologist: 'Психолог',
  admin: 'Администратор',
  moderator: 'Модератор',
  reviewer: 'Клинический рецензент',
};

export interface CurrentUser {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly roles: readonly UserRole[];
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

export function hasRole(user: CurrentUser | null, role: UserRole): boolean {
  return user?.roles.includes(role) ?? false;
}

/** Only local URLs are valid as an SSO return destination. Prevent open redirects. */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || value.length > 1024 || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/';
  return value;
}
