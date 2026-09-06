import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, LogOut, Swords } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already guards these routes; this is the second lock, so a
  // misconfigured matcher cannot expose a page.
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="sticky top-0 z-40 border-b border-rule bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-5 sm:gap-6 sm:px-8">
          <Link href="/practice" className="text-[15px] text-ink">
            <Wordmark />
          </Link>

          <nav className="ml-auto flex items-center gap-1 sm:ml-4 sm:mr-auto sm:gap-2">
            <NavLink href="/practice" icon={<Swords className="size-4" strokeWidth={1.75} />}>
              Practise
            </NavLink>
            <NavLink
              href="/dashboard"
              icon={<LayoutDashboard className="size-4" strokeWidth={1.75} />}
            >
              Progress
            </NavLink>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                aria-label="Sign out"
                className="grid size-9 place-items-center rounded-full border border-rule text-ink-muted transition-colors hover:border-rule-strong hover:text-ink"
              >
                <LogOut className="size-4" strokeWidth={1.75} />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13.5px] text-ink-muted transition-colors hover:bg-paper-sunken hover:text-ink"
    >
      {icon}
      <span className="hidden sm:inline">{children}</span>
    </Link>
  );
}
