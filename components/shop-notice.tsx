import { StethoscopeIcon } from "lucide-react";

// A plain full-page message: no such shop, not open yet, or closed. Rendered
// by the root layout instead of the app, so nothing else loads.
export function ShopNotice({
  title,
  subtitle,
  text,
  logoUrl,
  action,
}: {
  title: string;
  subtitle?: string;
  text: string;
  logoUrl?: string | null;
  action?: { href: string; label: string };
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-3xl bg-card p-8 text-center shadow-soft">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-primary-soft-foreground">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- the logo is served by Ariloo
            <img src={logoUrl} alt="" className="size-full object-cover" />
          ) : (
            <StethoscopeIcon className="size-8" />
          )}
        </div>
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 font-semibold text-accent-700 dark:text-accent-400">{subtitle}</p>}
        <p className="mt-3 text-sm text-muted-foreground">{text}</p>
        {action && (
          <a
            href={action.href}
            className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground hover:bg-primary-hover"
          >
            {action.label}
          </a>
        )}
      </div>
    </main>
  );
}
