import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import NotificationBadge from "../components/NotificationBadge";
import RefundBadge from "../components/RefundBadge";
import AuthGate from "../components/AuthGate";
import SignOutButton from "../components/SignOutButton";

export const metadata: Metadata = {
  title: "Cape Kayak Admin",
  description: "Admin Dashboard",
};

const nav = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/bookings", label: "Bookings", icon: "📋" },
  { href: "/new-booking", label: "New Booking", icon: "➕" },
  { href: "/slots", label: "Slots", icon: "📅" },
  { href: "/refunds", label: "Refunds", icon: "💰" },
  { href: "/inbox", label: "Inbox", icon: "💬" },
  { href: "/vouchers", label: "Vouchers", icon: "🎟" },
  { href: "/invoices", label: "Invoices", icon: "🧾" },
  { href: "/weather", label: "Weather", icon: "⛈" },
  { href: "/photos", label: "Photos", icon: "📷" },
  { href: "/broadcasts", label: "Broadcasts", icon: "📢" },
  { href: "/pricing", label: "Peak Pricing", icon: "💲" },
  { href: "/reports", label: "Reports", icon: "📈" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light">
      <body className="bg-[var(--ck-bg)] text-[var(--ck-text)] antialiased">
        <AuthGate>
          <div className="flex h-screen overflow-hidden">
            <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-[var(--ck-sidebar-border)] bg-[var(--ck-sidebar)]">
              <div className="border-b border-[var(--ck-sidebar-border)] p-5">
                <h1 className="text-lg font-semibold tracking-tight text-white">🛶 Cape Kayak</h1>
                <p className="mt-1 text-xs tracking-wide text-[var(--ck-sidebar-muted)]">Admin Dashboard</p>
              </div>
              <nav className="flex-1 space-y-1.5 overflow-auto p-3">
                {nav.map((n) => (
                  <Link key={n.href} href={n.href}
                    className="relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--ck-sidebar-text)] hover:bg-[var(--ck-sidebar-hover)] hover:text-white">
                    <span className="text-base">{n.icon}</span>
                    <span className="flex-1">{n.label}</span>
                    {n.href === "/inbox" && <NotificationBadge />}
                    {n.href === "/refunds" && <RefundBadge />}
                  </Link>
                ))}
              </nav>
              <div className="border-t border-[var(--ck-sidebar-border)]">
                <SignOutButton />
              </div>
            </aside>
            <div className="flex-1 flex flex-col overflow-hidden">
              <header className="md:hidden flex items-center justify-between border-b border-[var(--ck-border-subtle)] bg-white/85 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/70">
                <h1 className="text-lg font-semibold tracking-tight text-[var(--ck-text-strong)]">🛶 Cape Kayak</h1>
                <SignOutButton variant="header" />
              </header>
              <main className="flex-1 overflow-auto px-4 py-5 md:px-8 md:py-8">{children}</main>
              <nav className="md:hidden flex justify-around border-t border-[var(--ck-border-subtle)] bg-white/90 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/75">
                {nav.slice(0, 5).map((n) => (
                  <Link key={n.href} href={n.href} className="relative flex flex-col items-center rounded-lg px-2 py-1 text-xs font-medium text-[var(--ck-text-muted)] hover:text-[var(--ck-text-strong)]">
                    <div className="relative">
                      <span className="text-lg">{n.icon}</span>
                      {n.href === "/inbox" && (
                        <div className="absolute -top-1 -right-2 transform scale-75">
                          <NotificationBadge />
                        </div>
                      )}
                      {n.href === "/refunds" && (
                        <div className="absolute -top-1 -right-2 transform scale-75">
                          <RefundBadge />
                        </div>
                      )}
                    </div>
                    <span>{n.label}</span>
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </AuthGate>
      </body>
    </html>
  );
}
