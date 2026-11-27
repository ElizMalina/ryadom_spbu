import type { ReactNode } from 'react';
import { SiteHeader } from './SiteHeader';

type PublicShellProps = Readonly<{
  activeHref?: string;
  mainClassName?: string;
  mainId?: string;
  children: ReactNode;
}>;

/** Единый каркас страниц: один сайдбар, одна ширина контента, один набор токенов. */
export function PublicShell({ activeHref, mainClassName, mainId, children }: PublicShellProps) {
  return (
    <div className="publicShell">
      <SiteHeader activeHref={activeHref} />
      <main id={mainId} className={`publicMain${mainClassName ? ` ${mainClassName}` : ''}`}>
        {children}
      </main>
    </div>
  );
}
