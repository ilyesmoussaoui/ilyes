import { Link } from 'react-router-dom';
import { Button } from '../components/ui';

export function NotFoundPage() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-50 px-6 text-center"
      role="main"
    >
      <p
        aria-hidden="true"
        className="text-[128px] font-bold leading-none text-neutral-300 sm:text-[160px]"
      >
        404
      </p>
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Page not found</h1>
        <p className="mt-2 max-w-md text-sm text-neutral-500">
          The page you were looking for doesn't exist or has been moved.
        </p>
      </div>
      <Link to="/dashboard">
        <Button variant="primary">Return to dashboard</Button>
      </Link>
    </main>
  );
}
