import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LogoMark } from "@/components/Logo";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import NavLinks from "./NavLinks";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  async function signOut() {
    "use server";
    cookies().set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {/* Desktop sidebar */}
      <aside className="no-print hidden w-60 shrink-0 border-e border-slate-200 bg-slate-100 lg:block">
        <div className="sticky top-0 flex h-screen flex-col p-4">
          <Link href="/admin/cases" className="mb-6 flex items-center gap-2.5 px-2 pt-2">
            <LogoMark size={26} />
            <span className="border-s border-slate-300 ps-2.5 text-xs font-medium text-slate-500">Feedback</span>
          </Link>
          <NavLinks variant="sidebar" />
          <form action={signOut} className="mt-auto">
            <button className="w-full rounded-xl px-3 py-2.5 text-start text-sm font-medium text-slate-500 hover:bg-slate-50">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 pb-20 lg:pb-0">
        {/* Mobile top bar */}
        <header className="no-print sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-3 lg:hidden">
          <Link href="/admin/cases" className="flex items-center gap-2">
            <LogoMark size={22} />
            <span className="border-s border-slate-300 ps-2.5 text-xs font-medium text-slate-500">Feedback</span>
          </Link>
          <form action={signOut}>
            <button className="text-sm font-medium text-slate-500">Sign out</button>
          </form>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-5 lg:px-8 lg:py-8">{children}</main>
      </div>

      {/* Mobile bottom tabs */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-slate-100 lg:hidden">
        <NavLinks variant="tabs" />
      </nav>
    </div>
  );
}
