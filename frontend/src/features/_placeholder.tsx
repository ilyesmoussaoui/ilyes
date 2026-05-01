import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui';
import { ChevronRightIcon } from '../components/ui/Icon';

interface PlaceholderPageProps {
  title: string;
  children?: ReactNode;
}

export function PlaceholderPage({ title, children }: PlaceholderPageProps) {
  return (
    <div className="mx-auto max-w-5xl">
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center gap-1.5 text-xs text-neutral-500">
          <li>
            <Link
              to="/dashboard"
              className="rounded px-1 font-medium hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              Home
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRightIcon size={12} />
          </li>
          <li className="font-semibold text-neutral-700">{title}</li>
        </ol>
      </nav>
      <Card>
        <h1 className="text-[24px] font-semibold leading-tight text-neutral-900">{title}</h1>
        <p className="mt-1 text-sm text-neutral-500">Coming in a later part</p>
        {children && <div className="mt-4">{children}</div>}
      </Card>
    </div>
  );
}
