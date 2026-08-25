"use client";

import { useState } from "react";
import Link from "next/link";
import {
  EyeSlashIcon,
  PeopleIcon,
  CrownIcon,
  ChatIcon,
  DoorIcon,
  LockIcon,
} from "@/components/ui";
import { clearAllRooms, ApiError } from "@/lib/api";
import InteractiveGlobe from "@/components/InteractiveGlobe";
import { CountryData } from "@/components/geographic/countries";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      aria-modal="true"
      role="dialog"
      aria-label="Clear All Rooms"
    >
      <div className="w-[calc(100%-24px)] max-w-sm mx-auto bg-[var(--veil-surface)] border border-red-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl overflow-hidden">

        {step === "confirm" && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">⚠️</span>
              <h2 className="text-lg font-bold text-white leading-snug">Clear all rooms?</h2>
            </div>
            <p className="text-sm text-[var(--veil-text-muted)] leading-relaxed mb-6 break-words">
              This will <strong className="text-red-400">permanently delete</strong> all active
              rooms, memberships, chat history, real names, anonymous identities, and moderation
              data. <strong className="text-white">This cannot be undone.</strong>
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3.5 rounded-xl border border-[var(--veil-border)] text-[var(--veil-text-muted)] hover:text-white hover:border-white/30 transition-colors text-sm font-medium min-h-[48px]"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep("key")}
                className="flex-1 py-3.5 rounded-xl bg-red-600/20 border border-red-500/50 text-red-400 hover:bg-red-600/30 hover:text-red-300 transition-colors text-sm font-semibold min-h-[48px]"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === "key" && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <LockIcon className="text-red-400 w-5 h-5 flex-shrink-0" />
              <h2 className="text-lg font-bold text-white leading-snug">Enter Global Admin Key</h2>
            </div>

            {error && (
              <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm break-words">
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
                  className="w-full bg-[var(--veil-surface-2)] border border-[var(--veil-border)] text-white placeholder-[var(--veil-text-muted)] rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/30 transition-all min-h-[48px]"
                  required
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setStep("confirm"); setError(""); setAdminKey(""); }}
                  className="flex-1 py-3.5 rounded-xl border border-[var(--veil-border)] text-[var(--veil-text-muted)] hover:text-white hover:border-white/30 transition-colors text-sm font-medium min-h-[48px]"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors min-h-[48px]"
                >
                  {loading ? "Clearing…" : "Clear All Rooms"}
                </button>
              </div>
            </form>
          </>
        )}

        {step === "success" && (
          <div className="text-center py-4">
            <div className="text-4xl mb-3 text-emerald-400">✓</div>
            <h2 className="text-lg font-bold text-white mb-2">Rooms cleared</h2>
            <p className="text-[var(--veil-text-muted)] text-sm break-words">
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
  const [showClearModal, setShowClearModal] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);

  return (
    <main className="min-h-dvh bg-[#080808] text-white flex flex-col justify-between overflow-x-hidden w-full selection:bg-[var(--veil-cyan)] selection:text-black">
      <div className="flex flex-col flex-1 w-full">
        {/* ── Top Navigation Bar ─────────────────────────────────────────── */}
        <header className="w-full max-w-7xl mx-auto px-5 sm:px-8 pt-6 pb-4 flex items-center justify-between z-20">
          <Link href="/" className="flex items-center gap-2.5 group no-underline">
            <div className="p-2 rounded-2xl bg-[var(--veil-cyan)]/10 border border-[var(--veil-cyan)]/30 group-hover:border-[var(--veil-cyan)]/60 transition-colors">
              <EyeSlashIcon className="text-[var(--veil-cyan)] w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <span className="text-[var(--veil-cyan)] font-extrabold text-2xl tracking-tight">
              Veil
            </span>
          </Link>
          <button
            aria-label="People network"
            className="text-[var(--veil-text-muted)] hover:text-white transition-colors p-2.5 rounded-2xl bg-[var(--veil-surface)] border border-[var(--veil-border)] hover:border-white/20"
          >
            <PeopleIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </header>

        {/* ── Integrated Hero Experience ──────────────────────────────────── */}
        <section className="w-full max-w-7xl mx-auto px-5 sm:px-8 py-4 sm:py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center min-h-[calc(100vh-100px)]">
          {/* Left Column: Hero Copy & Action CTAs */}
          <div className="lg:col-span-6 xl:col-span-5 flex flex-col justify-center page-in">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--veil-surface-2)] border border-[var(--veil-cyan)]/30 text-xs font-semibold text-[var(--veil-cyan)] w-fit mb-6 shadow-[0_0_15px_rgba(0,240,255,0.1)]">
              <span className="w-2 h-2 rounded-full bg-[var(--veil-cyan)] animate-pulse" />
              <span>Real-Time Anonymous Spaces</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] text-white tracking-tight">
              Talk freely.<br />
              <span className="text-[var(--veil-cyan)] block mt-1">
                Reveal selectively.
              </span>
            </h1>

            <p className="mt-4 sm:mt-5 text-[var(--veil-text-muted)] text-base sm:text-lg leading-relaxed max-w-md">
              Connect in anonymous spaces. Build trust. Reveal your identity only
              when you&apos;re ready.
            </p>

            {/* Main Action Buttons */}
            <div className="mt-8 flex flex-col gap-3.5 max-w-md w-full">
              <Link
                href="/create"
                className="veil-btn-primary text-center no-underline text-base font-bold py-4 rounded-2xl shadow-[0_0_25px_rgba(0,240,255,0.25)] hover:shadow-[0_0_35px_rgba(0,240,255,0.4)] transition-all"
              >
                Create a Room
              </Link>
              <Link
                href="/join"
                className="veil-btn-secondary text-center no-underline text-base font-semibold py-4 rounded-2xl"
              >
                Join as Member
              </Link>
              <Link
                href="/admin"
                className="veil-btn-secondary text-center no-underline text-base font-semibold py-4 rounded-2xl flex items-center justify-center gap-2"
              >
                <CrownIcon className="text-[var(--veil-cyan)] w-5 h-5" />
                Join as Admin
              </Link>

              {/* Admin — Destructive action */}
              <button
                id="clear-all-rooms-btn"
                onClick={() => setShowClearModal(true)}
                className="mt-1 w-full py-3.5 px-4 rounded-2xl border border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 transition-all text-sm font-semibold flex items-center justify-center gap-2 min-h-[48px] touch-manipulation"
                aria-label="Clear all rooms (Global Admin)"
              >
                <span className="text-base">⚠</span> Clear All Rooms
              </button>
            </div>
          </div>

          {/* Right Column: 3D Interactive WebGL Globe Visual */}
          <div className="lg:col-span-6 xl:col-span-7 flex flex-col items-center justify-center relative page-in" style={{ animationDelay: "60ms" }}>
            <div className="w-full relative">
              <InteractiveGlobe onCountrySelect={(country) => setSelectedCountry(country)} />
            </div>

            {selectedCountry && (
              <div className="mt-2 px-4 py-1.5 rounded-full bg-[var(--veil-surface-2)] border border-[var(--veil-cyan)]/50 text-xs font-semibold text-[var(--veil-cyan)] animate-pulse">
                Region Selected: {selectedCountry.name} ({selectedCountry.isoCode})
              </div>
            )}
          </div>
        </section>

        {/* ── Below Hero: Protocol Breakdown ─────────────────────────────── */}
        <section className="w-full max-w-7xl mx-auto px-5 sm:px-8 py-16 sm:py-24 border-t border-[var(--veil-border)]/50">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <span className="text-xs font-bold tracking-widest text-[var(--veil-cyan)] uppercase">
              The Veil Protocol
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white mt-2">
              Global Anonymous Communication
            </h2>
            <p className="text-[var(--veil-text-muted)] text-sm sm:text-base mt-3">
              People connecting worldwide without exposing who they are.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="veil-card p-6 sm:p-8 flex flex-col justify-between hover:border-[var(--veil-cyan)]/40 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-[var(--veil-cyan)]/10 border border-[var(--veil-cyan)]/30 flex items-center justify-center text-[var(--veil-cyan)] font-bold text-lg mb-6">
                01
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">TALK FREELY</h3>
                <p className="text-[var(--veil-text-muted)] text-sm leading-relaxed">
                  Anonymous identity lets people participate in discussions without immediately exposing personal identity.
                </p>
              </div>
            </div>

            <div className="veil-card p-6 sm:p-8 flex flex-col justify-between hover:border-[var(--veil-cyan)]/40 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-[var(--veil-cyan)]/10 border border-[var(--veil-cyan)]/30 flex items-center justify-center text-[var(--veil-cyan)] font-bold text-lg mb-6">
                02
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">BUILD TRUST</h3>
                <p className="text-[var(--veil-text-muted)] text-sm leading-relaxed">
                  Communicate in structured, secure rooms with active real-time moderation and room level protection.
                </p>
              </div>
            </div>

            <div className="veil-card p-6 sm:p-8 flex flex-col justify-between hover:border-[var(--veil-cyan)]/40 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-[var(--veil-cyan)]/10 border border-[var(--veil-cyan)]/30 flex items-center justify-center text-[var(--veil-cyan)] font-bold text-lg mb-6">
                03
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">REVEAL SELECTIVELY</h3>
                <p className="text-[var(--veil-text-muted)] text-sm leading-relaxed">
                  Identity reveal remains strictly controlled by authorized room admins when readiness is established.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── Mobile Bottom Nav ──────────────────────────────────────────────── */}
      <nav
        className="bottom-nav mt-auto flex md:hidden items-center justify-around py-3 px-4 bg-[#0a0a0a]/90 backdrop-blur-lg border-t border-[var(--veil-border)]/50 z-20"
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
      className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-colors min-h-[44px] justify-center ${
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
