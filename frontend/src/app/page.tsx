"use client";

import { useState } from "react";
import Link from "next/link";
import {
  EyeSlashIcon,
  PeopleIcon,
  CrownIcon,
  LockIcon,
} from "@/components/ui";
import { clearAllRooms, ApiError } from "@/lib/api";
import InteractiveGlobe from "@/components/InteractiveGlobe";
import { CountryData } from "@/components/geographic/countries";

// ─────────────────────────────────────────────────────────────────────────────
// Clear All Rooms Modal
// ─────────────────────────────────────────────────────────────────────────────

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
    if (!adminKey.trim()) { setError("Please enter the Global Admin Key."); return; }
    setLoading(true);
    try {
      const res = await clearAllRooms(adminKey);
      setDeletedCount(res.deletedRooms);
      setAdminKey("");
      setStep("success");
      setTimeout(onClose, 4000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to clear rooms. Check your network connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      aria-modal="true" role="dialog" aria-label="Clear All Rooms"
    >
      <div className="w-full max-w-sm bg-[#111] border border-red-500/30 rounded-3xl p-6 shadow-2xl">
        {step === "confirm" && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">⚠️</span>
              <h2 className="text-lg font-bold text-white">Clear all rooms?</h2>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed mb-6">
              This will <strong className="text-red-400">permanently delete</strong> all active rooms,
              memberships, chat history, real names, anonymous identities, and moderation data.{" "}
              <strong className="text-white">This cannot be undone.</strong>
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/25 transition-colors text-sm font-medium">Cancel</button>
              <button onClick={() => setStep("key")} className="flex-1 py-3 rounded-xl bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/30 transition-colors text-sm font-semibold">Continue</button>
            </div>
          </>
        )}

        {step === "key" && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <LockIcon className="text-red-400 w-5 h-5 flex-shrink-0" />
              <h2 className="text-lg font-bold text-white">Enter Global Admin Key</h2>
            </div>
            {error && (
              <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
            )}
            <form onSubmit={handleClear} className="space-y-4">
              <div>
                <label htmlFor="modal-admin-key" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Global Admin Key</label>
                <input
                  id="modal-admin-key"
                  type="password"
                  autoComplete="off"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="Enter your global admin key"
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-500 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 transition-all"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setStep("confirm"); setError(""); setAdminKey(""); }} className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white transition-colors text-sm font-medium">Back</button>
                <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                  {loading ? "Clearing…" : "Clear All Rooms"}
                </button>
              </div>
            </form>
          </>
        )}

        {step === "success" && (
          <div className="text-center py-4">
            <div className="text-4xl text-emerald-400 mb-3">✓</div>
            <h2 className="text-lg font-bold text-white mb-2">Rooms cleared</h2>
            <p className="text-gray-400 text-sm">
              {deletedCount === 0 ? "No active rooms were found." : `${deletedCount} room${deletedCount !== 1 ? "s" : ""} permanently deleted.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav links
// ─────────────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: "Home", href: "/", active: true },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Privacy", href: "#privacy" },
  { label: "FAQ", href: "#faq" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Why Veil features
// ─────────────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75A9 9 0 016.75 15.75" />
      </svg>
    ),
    title: "Anonymous Spaces",
    desc: "Your conversations stay private. No real names. No judgments.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    ),
    title: "Reveal Selectively",
    desc: "Only room admins can reveal identities when necessary.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: "Secure & Safe",
    desc: "End-to-end protection with admin-controlled environments.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Temporary Rooms",
    desc: "Rooms disappear when empty. Nothing is stored permanently.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [showClearModal, setShowClearModal] = useState(false);
  const [, setSelectedCountry] = useState<CountryData | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-[#080808] text-white overflow-x-hidden selection:bg-cyan-400 selection:text-black">

      {/* ────────────────────────────────────────────────────────────────────
          HEADER / NAVIGATION
      ──────────────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#080808]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-12 h-16 flex items-center justify-between gap-6">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <div className="p-1.5 rounded-xl bg-cyan-400/10 border border-cyan-400/20 group-hover:border-cyan-400/50 transition-colors">
              <EyeSlashIcon className="text-cyan-400 w-5 h-5" />
            </div>
            <span className="text-cyan-400 font-extrabold text-xl tracking-tight">Veil</span>
          </Link>

          {/* Desktop center nav */}
          <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
            {NAV_LINKS.map(({ label, href, active }) => (
              <a
                key={label}
                href={href}
                className={`text-sm font-medium transition-colors relative ${
                  active
                    ? "text-cyan-400"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {label}
                {active && (
                  <span className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
                )}
              </a>
            ))}
          </nav>

          {/* Desktop right actions */}
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            <Link
              href="/join"
              className="px-5 py-2 rounded-full border border-white/20 text-white text-sm font-semibold hover:border-white/40 hover:bg-white/5 transition-all"
            >
              Join as Member
            </Link>
            <Link
              href="/create"
              className="px-5 py-2 rounded-full bg-cyan-400 text-black text-sm font-bold hover:bg-cyan-300 transition-colors shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_30px_rgba(0,240,255,0.5)]"
            >
              Create a Room
            </Link>
            <button
              aria-label="Toggle theme"
              className="w-9 h-9 rounded-full border border-white/15 text-gray-400 hover:text-white hover:border-white/30 transition-all flex items-center justify-center"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-gray-400 hover:text-white transition-colors rounded-xl border border-white/10"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              {mobileMenuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/5 bg-[#0a0a0a] px-5 py-4 flex flex-col gap-3">
            {NAV_LINKS.map(({ label, href, active }) => (
              <a
                key={label}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className={`text-sm font-medium py-1 ${active ? "text-cyan-400" : "text-gray-400"}`}
              >
                {label}
              </a>
            ))}
            <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
              <Link href="/join" className="w-full py-3 rounded-2xl border border-white/15 text-white text-sm font-semibold text-center hover:bg-white/5 transition-all">Join as Member</Link>
              <Link href="/create" className="w-full py-3 rounded-2xl bg-cyan-400 text-black text-sm font-bold text-center hover:bg-cyan-300 transition-colors">Create a Room</Link>
            </div>
          </div>
        )}
      </header>

      {/* ────────────────────────────────────────────────────────────────────
          HERO — Two Column
      ──────────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-dvh flex items-center pt-16 overflow-hidden">
        {/* Subtle radial glow behind globe */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[55vw] h-[55vw] max-w-[800px] max-h-[800px] rounded-full bg-blue-600/8 blur-[120px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-12 py-12 lg:py-0 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-4 items-center">

          {/* ── LEFT: Content ── */}
          <div className="flex flex-col justify-center page-in">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-cyan-400 w-fit mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Real-Time Anonymous Spaces
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight mb-5">
              <span className="text-white">Talk freely.</span>
              <br />
              <span className="text-cyan-400">Reveal selectively.</span>
            </h1>

            {/* Subheading */}
            <p className="text-gray-400 text-base sm:text-lg leading-relaxed max-w-[430px] mb-9">
              Connect in anonymous spaces. Build trust.
              <br />
              Reveal your identity only when you&apos;re ready.
            </p>

            {/* Action buttons */}
            <div className="flex flex-col gap-3 max-w-[380px] w-full">
              {/* Primary CTA */}
              <Link
                href="/create"
                className="flex items-center justify-center gap-2.5 w-full py-4 rounded-full bg-cyan-400 text-black font-bold text-base hover:bg-cyan-300 transition-all shadow-[0_0_30px_rgba(0,240,255,0.3)] hover:shadow-[0_0_40px_rgba(0,240,255,0.5)] active:scale-[0.98]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create a Room
              </Link>

              {/* Secondary: Join Member */}
              <Link
                href="/join"
                className="flex items-center justify-center gap-2.5 w-full py-4 rounded-full bg-[#111]/80 border border-white/12 text-white font-semibold text-base hover:bg-white/6 hover:border-white/20 transition-all active:scale-[0.98]"
              >
                <PeopleIcon className="w-5 h-5 text-gray-400" />
                Join as Member
              </Link>

              {/* Secondary: Join Admin */}
              <Link
                href="/admin"
                className="flex items-center justify-center gap-2.5 w-full py-4 rounded-full bg-[#111]/80 border border-white/12 text-white font-semibold text-base hover:bg-white/6 hover:border-white/20 transition-all active:scale-[0.98]"
              >
                <CrownIcon className="w-4 h-4 text-gray-400" />
                Join as Admin
              </Link>

              {/* Danger: Clear All Rooms */}
              <button
                onClick={() => setShowClearModal(true)}
                aria-label="Clear all rooms (Global Admin)"
                className="flex items-center justify-center gap-2.5 w-full py-4 rounded-full bg-red-900/20 border border-red-500/30 text-red-400 font-semibold text-base hover:bg-red-900/30 hover:border-red-500/50 transition-all active:scale-[0.98]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                Clear All Rooms
              </button>
            </div>
          </div>

          {/* ── RIGHT: Globe ── */}
          <div
            className="relative flex items-center justify-center page-in lg:h-[min(90vh,800px)] h-[420px] sm:h-[520px]"
            style={{ animationDelay: "80ms" }}
          >
            <InteractiveGlobe
              onCountrySelect={(c) => setSelectedCountry(c)}
              showStats
              className="w-full h-full"
            />
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────────
          WHY VEIL SECTION
      ──────────────────────────────────────────────────────────────────── */}
      <section id="features" className="bg-[#0a0a0a] border-t border-white/5 py-20 sm:py-28 px-5 sm:px-8 lg:px-12">
        <div className="max-w-[1400px] mx-auto">
          {/* Section header */}
          <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-18">
            <span className="text-xs font-bold tracking-[0.2em] text-cyan-400 uppercase">
              WHY VEIL?
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
              Private by design.{" "}
              <span className="text-gray-400">Powerful by choice.</span>
            </h2>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {FEATURES.map(({ icon, title, desc }) => (
              <div
                key={title}
                className="group relative bg-[#111] border border-white/7 rounded-2xl p-6 sm:p-7 hover:border-cyan-400/30 transition-all duration-300 hover:-translate-y-0.5"
              >
                {/* Subtle glow on hover */}
                <div className="absolute inset-0 rounded-2xl bg-cyan-400/0 group-hover:bg-cyan-400/2 transition-colors duration-300 pointer-events-none" />

                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-400/8 border border-cyan-400/15 flex items-center justify-center text-cyan-400 mb-5 group-hover:border-cyan-400/35 group-hover:bg-cyan-400/12 transition-all duration-300">
                    {icon}
                  </div>
                  <h3 className="text-white font-bold text-base mb-2">{title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────────
          FOOTER (minimal)
      ──────────────────────────────────────────────────────────────────── */}
      <footer className="bg-[#080808] border-t border-white/5 py-8 px-5 sm:px-8">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-gray-600 text-sm">
          <div className="flex items-center gap-2">
            <EyeSlashIcon className="text-cyan-400/50 w-4 h-4" />
            <span className="text-gray-500 font-semibold">Veil</span>
            <span>— Talk freely. Reveal selectively.</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#" className="hover:text-gray-400 transition-colors">Privacy</a>
            <a href="#" className="hover:text-gray-400 transition-colors">Terms</a>
            <a href="#" className="hover:text-gray-400 transition-colors">FAQ</a>
          </div>
        </div>
      </footer>

      {/* Clear All Rooms modal */}
      {showClearModal && <ClearAllRoomsModal onClose={() => setShowClearModal(false)} />}
    </div>
  );
}
