"use client";

import { useState } from "react";
import Link from "next/link";
import {
  EyeSlashIcon,
  PeopleIcon,
  CrownIcon,
  FingerprintIcon,
  ChatIcon,
  DoorIcon,
  LockIcon,
} from "@/components/ui";
import { clearAllRooms, ApiError } from "@/lib/api";

// ── Clear All Rooms Modal ─────────────────────────────────────────────────────

type ModalStep = "confirm" | "key" | "success";

function ClearAllRoomsModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<ModalStep>("confirm");
  const [adminKey, setAdminKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deletedCount, setDeletedCount] = useState(0);

  async function handleClear(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!adminKey.trim()) {
      setError("Please enter the Global Admin Key.");
      return;
    }
    setLoading(true);
    try {
      const res = await clearAllRooms(adminKey);
      setDeletedCount(res.deletedRooms);
      setAdminKey(""); // wipe from state immediately
      setStep("success");
      // Auto-close after 4 s
      setTimeout(onClose, 4_000);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to clear rooms. Check your network connection.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      aria-modal="true"
      role="dialog"
      aria-label="Clear All Rooms"
    >
      <div className="w-full max-w-sm mx-4 bg-[var(--veil-surface)] border border-red-500/30 rounded-2xl p-6 shadow-2xl">

        {step === "confirm" && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">⚠️</span>
              <h2 className="text-lg font-bold text-white">Clear all rooms?</h2>
            </div>
            <p className="text-sm text-[var(--veil-text-muted)] leading-relaxed mb-6">
              This will <strong className="text-red-400">permanently delete</strong> all active
              rooms, memberships, chat history, real names, anonymous identities, and moderation
              data. <strong className="text-white">This cannot be undone.</strong>
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-[var(--veil-border)] text-[var(--veil-text-muted)] hover:text-white hover:border-white/30 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep("key")}
                className="flex-1 py-2.5 rounded-xl bg-red-600/20 border border-red-500/50 text-red-400 hover:bg-red-600/30 hover:text-red-300 transition-colors text-sm font-semibold"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === "key" && (
          <>
            <div className="flex items-center gap-3 mb-5">
              <LockIcon className="text-red-400 w-5 h-5 flex-shrink-0" />
              <h2 className="text-lg font-bold text-white">Enter Global Admin Key</h2>
            </div>

            {error && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleClear} className="space-y-4">
              <div>
                <label
                  htmlFor="clear-admin-key"
                  className="block text-xs font-semibold text-[var(--veil-text-muted)] uppercase tracking-wider mb-1.5"
                >
                  Global Admin Key
                </label>
                <input
                  id="clear-admin-key"
                  type="password"
                  autoComplete="off"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="Enter your global admin key"
                  className="w-full bg-[var(--veil-surface-2)] border border-[var(--veil-border)] text-white placeholder-[var(--veil-text-muted)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/30 transition-all"
                  required
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setStep("confirm"); setError(""); setAdminKey(""); }}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--veil-border)] text-[var(--veil-text-muted)] hover:text-white hover:border-white/30 transition-colors text-sm font-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                >
                  {loading ? "Clearing…" : "Clear All Rooms"}
                </button>
              </div>
            </form>
          </>
        )}

        {step === "success" && (
          <div className="text-center py-2">
            <div className="text-4xl mb-3">✓</div>
            <h2 className="text-lg font-bold text-white mb-2">Rooms cleared</h2>
            <p className="text-[var(--veil-text-muted)] text-sm">
              {deletedCount === 0
                ? "No active rooms were found."
                : `${deletedCount} room${deletedCount !== 1 ? "s" : ""} and all associated data permanently deleted.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Landing Page ──────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [revealed, setRevealed] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  return (
    <main className="min-h-dvh bg-[var(--veil-bg)] flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 pt-6 pb-2">
        <div className="flex items-center gap-2">
          <EyeSlashIcon className="text-[var(--veil-cyan)] w-7 h-7" />
          <span className="text-[var(--veil-cyan)] font-bold text-2xl tracking-tight">
            Veil
          </span>
        </div>
        <button
          aria-label="People"
          className="text-[var(--veil-text-muted)] hover:text-white transition-colors p-1"
        >
          <PeopleIcon className="w-6 h-6" />
        </button>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="px-6 pt-8 pb-6 page-in">
        <h1 className="text-[2.75rem] font-extrabold leading-tight text-white">
          Talk freely.{" "}
          <span className="text-[var(--veil-cyan)] block">
            Reveal selectively.
          </span>
        </h1>
        <p className="mt-4 text-[var(--veil-text-muted)] text-base leading-relaxed max-w-xs">
          Connect in anonymous spaces. Build trust. Reveal your identity only
          when you&apos;re ready.
        </p>
      </section>

      {/* ── CTA Buttons ────────────────────────────────────────────────── */}
      <section className="px-5 flex flex-col gap-3 pb-6 page-in" style={{ animationDelay: "40ms" }}>
        <Link
          href="/create"
          className="veil-btn-primary text-center no-underline"
        >
          Create a Room
        </Link>
        <Link
          href="/join"
          className="veil-btn-secondary text-center no-underline"
        >
          Join as Member
        </Link>
        <Link
          href="/admin"
          className="veil-btn-secondary text-center no-underline"
        >
          <CrownIcon className="text-[var(--veil-cyan)]" />
          Join as Admin
        </Link>

        {/* Admin — destructive action, visually distinct from normal CTAs */}
        <button
          id="clear-all-rooms-btn"
          onClick={() => setShowClearModal(true)}
          className="mt-1 w-full py-3 px-4 rounded-2xl border border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 transition-all text-sm font-semibold flex items-center justify-center gap-2"
          aria-label="Clear all rooms (Global Admin)"
        >
          <span className="text-base">⚠</span> Clear All Rooms
        </button>
      </section>

      {/* ── Tap to Reveal Feature Card ──────────────────────────────────── */}
      <section
        className="mx-5 veil-card p-6 text-center page-in"
        style={{ animationDelay: "80ms" }}
      >
        <h2 className="text-xl font-bold text-white mb-2">Tap to Reveal</h2>
        <p className="text-[var(--veil-text-muted)] text-sm leading-relaxed mb-6">
          Experience the transition from anonymity to connection. You control
          the mask.
        </p>
        <button
          onClick={() => setRevealed((r) => !r)}
          aria-label={revealed ? "Hide identity" : "Reveal identity"}
          className={`
            w-36 h-36 rounded-full mx-auto flex items-center justify-center
            border-2 transition-all duration-300 cursor-pointer
            ${
              revealed
                ? "border-[var(--veil-cyan)] bg-[var(--veil-cyan)]/10"
                : "border-[var(--veil-border)] bg-[var(--veil-surface-2)]"
            }
          `}
        >
          <FingerprintIcon
            className={`transition-colors duration-300 ${
              revealed ? "text-[var(--veil-cyan)]" : "text-[var(--veil-text-muted)]"
            }`}
          />
        </button>
        {revealed && (
          <p className="mt-4 text-[var(--veil-cyan)] text-sm font-medium animate-pulse">
            Identity revealed
          </p>
        )}
      </section>

      {/* ── Bottom Nav ─────────────────────────────────────────────────── */}
      <nav
        className="bottom-nav mt-auto flex items-center justify-around py-3 px-4"
        aria-label="Main navigation"
      >
        <NavItem icon={<ChatIcon />} label="Chat" active />
        <NavItem icon={<PeopleIcon />} label="People" />
        <NavItem icon={<DoorIcon />} label="Rooms" />
      </nav>

      {/* ── Clear All Rooms Modal ─────────────────────────────────────── */}
      {showClearModal && (
        <ClearAllRoomsModal onClose={() => setShowClearModal(false)} />
      )}
    </main>
  );
}

function NavItem({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`flex flex-col items-center gap-1 px-4 py-1 rounded-xl transition-colors ${
        active
          ? "text-[var(--veil-cyan)] bg-[var(--veil-cyan)]/10"
          : "text-[var(--veil-text-muted)] hover:text-white"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
