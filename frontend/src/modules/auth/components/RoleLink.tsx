'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { hasRole, type UserRole } from '../model/types';
import { useAuth } from './AuthProvider';

/** Only controls UI visibility; the API MUST validate roles independently. */
export function RoleLink({ role, href, children, secondary = false }: { role: UserRole; href: string; children: ReactNode; secondary?: boolean }) {
  const { user, status } = useAuth();
  if (status !== 'ready' || !hasRole(user, role)) return null;
  return <Link className={secondary ? "uiButton uiButtonSecondary authRoleAction" : "uiButton authRoleAction"} href={href}>{children}</Link>;
}

export function PsychoeducationCreateAction() {
  return <div className="authContextAction"><RoleLink role="consultant" href="/psychoeducation/create">Написать статью</RoleLink><RoleLink role="consultant" href="/psychoeducation/create#my-articles" secondary>Мои статьи</RoleLink></div>;
}

/** Practice action is inside its catalog, not in the shared sidebar. */
export function PracticeCreateAction() {
  return <div className="authContextAction"><RoleLink role="consultant" href="/practices/create">Добавить практику</RoleLink></div>;
}
