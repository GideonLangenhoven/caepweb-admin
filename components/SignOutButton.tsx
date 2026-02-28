"use client";

export default function SignOutButton({ variant = "sidebar" }: { variant?: "sidebar" | "header" }) {
  function logout() {
    localStorage.removeItem("ck_admin_auth");
    localStorage.removeItem("ck_admin_role");
    localStorage.removeItem("ck_admin_email");
    window.location.reload();
  }

  if (variant === "header") {
    return (
      <button
        onClick={logout}
        className="px-3 py-1.5 text-xs font-medium text-[var(--ck-text-muted)] hover:text-[var(--ck-text-strong)] rounded-lg border border-gray-200"
      >
        Sign Out
      </button>
    );
  }

  return (
    <button
      onClick={logout}
      className="w-full text-left px-4 py-3 text-xs font-medium text-[var(--ck-sidebar-muted)] hover:text-white hover:bg-[var(--ck-sidebar-hover)] transition-colors"
    >
      Sign Out
    </button>
  );
}
