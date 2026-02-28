"use client";
import { useState } from "react";
import { supabase } from "../lib/supabase";

async function sha256(str: string) {
  var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

var MAX_ATTEMPTS = 5;
var LOCKOUT_DURATION = 30 * 60 * 1000;

export default function ChangePasswordPage() {
  var [email, setEmail] = useState("");
  var [currentPass, setCurrentPass] = useState("");
  var [newPass, setNewPass] = useState("");
  var [confirmPass, setConfirmPass] = useState("");
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState("");
  var [success, setSuccess] = useState(false);
  var [locked, setLocked] = useState(false);
  var [resetSent, setResetSent] = useState(false);

  function isLocked() {
    var lockUntil = Number(localStorage.getItem("ck_cp_lock_until") || "0");
    if (lockUntil > Date.now()) return true;
    if (lockUntil > 0) {
      localStorage.removeItem("ck_cp_lock_until");
      localStorage.removeItem("ck_cp_fail_count");
    }
    return false;
  }

  async function sendResetEmail(targetEmail: string) {
    var { data: admin } = await supabase
      .from("admin_users")
      .select("id, email")
      .eq("email", targetEmail)
      .maybeSingle();

    if (!admin) return;

    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    var tempPass = "";
    for (var i = 0; i < 10; i++) tempPass += chars.charAt(Math.floor(Math.random() * chars.length));

    var tempHash = await sha256(tempPass);
    await supabase.from("admin_users").update({ password_hash: tempHash }).eq("id", admin.id);

    try {
      await supabase.functions.invoke("send-email", {
        body: {
          type: "ADMIN_WELCOME",
          data: {
            email: admin.email,
            temp_password: tempPass,
            change_password_url: window.location.origin + "/change-password",
          },
        },
      });
    } catch {}

    setResetSent(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (isLocked()) {
      setLocked(true);
      return;
    }

    if (!email || !currentPass || !newPass || !confirmPass) {
      return setError("All fields are required.");
    }
    if (newPass.length < 8) {
      return setError("New password must be at least 8 characters.");
    }
    if (newPass !== confirmPass) {
      return setError("New passwords do not match.");
    }

    setLoading(true);

    var currentHash = await sha256(currentPass);
    var { data: user } = await supabase
      .from("admin_users")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .eq("password_hash", currentHash)
      .maybeSingle();

    if (!user) {
      setLoading(false);

      var failCount = Number(localStorage.getItem("ck_cp_fail_count") || "0") + 1;
      localStorage.setItem("ck_cp_fail_count", String(failCount));

      if (failCount >= MAX_ATTEMPTS) {
        localStorage.setItem("ck_cp_lock_until", String(Date.now() + LOCKOUT_DURATION));
        setLocked(true);
        sendResetEmail(email.trim().toLowerCase());
        return;
      }

      return setError("Incorrect email or current password. " + (MAX_ATTEMPTS - failCount) + " attempt(s) remaining.");
    }

    var newHash = await sha256(newPass);
    var { error: updateErr } = await supabase
      .from("admin_users")
      .update({ password_hash: newHash })
      .eq("id", user.id);

    setLoading(false);

    if (updateErr) {
      return setError("Failed to update password: " + updateErr.message);
    }

    // Clear fail counters on success
    localStorage.removeItem("ck_cp_fail_count");
    localStorage.removeItem("ck_cp_lock_until");
    localStorage.removeItem("ck_fail_count");
    localStorage.removeItem("ck_lock_until");
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--ck-bg)] px-4">
        <div className="ui-surface-elevated w-full max-w-sm p-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--ck-text-strong)] mb-3">Password Updated</h1>
          <p className="text-sm text-[var(--ck-text-muted)] mb-6">Your password has been changed successfully. You can now sign in with your new password.</p>
          <a href="/" className="inline-block w-full rounded-xl bg-[var(--ck-text-strong)] py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 text-center">
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--ck-bg)] px-4">
        <div className="ui-surface-elevated w-full max-w-sm p-8 text-center">
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-4">
            <p className="text-sm font-semibold text-red-700 mb-2">Too Many Attempts</p>
            <p className="text-xs text-red-600 leading-relaxed">
              Your account has been locked for 30 minutes due to too many incorrect password attempts.
              {resetSent
                ? " A new temporary password has been sent to your email."
                : " If this is your account, a reset email will be sent."}
            </p>
          </div>
          <a href="/" className="text-xs text-[var(--ck-text-muted)] hover:underline">Back to sign in</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--ck-bg)] px-4">
      <div className="ui-surface-elevated w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--ck-text-strong)] mb-1">Change Password</h1>
          <p className="text-sm text-[var(--ck-text-muted)]">Enter your current password and choose a new one</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(""); }}
            placeholder="Email address"
            autoComplete="email"
            className="ui-control w-full px-4 py-3 text-sm outline-none"
          />
          <input
            type="password"
            value={currentPass}
            onChange={e => { setCurrentPass(e.target.value); setError(""); }}
            placeholder="Current / temporary password"
            autoComplete="current-password"
            className="ui-control w-full px-4 py-3 text-sm outline-none"
          />
          <input
            type="password"
            value={newPass}
            onChange={e => { setNewPass(e.target.value); setError(""); }}
            placeholder="New password (min 8 characters)"
            autoComplete="new-password"
            className="ui-control w-full px-4 py-3 text-sm outline-none"
          />
          <input
            type="password"
            value={confirmPass}
            onChange={e => { setConfirmPass(e.target.value); setError(""); }}
            placeholder="Confirm new password"
            autoComplete="new-password"
            className="ui-control w-full px-4 py-3 text-sm outline-none"
          />

          {error && <p className="text-xs text-[var(--ck-danger)] font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--ck-text-strong)] py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:opacity-50"
          >
            {loading ? "Updating..." : "Change Password"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-[var(--ck-text-muted)]">
          <a href="/" className="hover:underline">Back to sign in</a>
        </p>
      </div>
    </div>
  );
}
