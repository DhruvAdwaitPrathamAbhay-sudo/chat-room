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
import InteractiveGlobe from "@/components/Globe/InteractiveGlobe";
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
      <section
        className="relative min-h-dvh flex items-center pt-16 overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse at 75% 50%, rgba(0, 80, 180, 0.28) 0%, transparent 58%), radial-gradient(ellipse at 25% 85%, rgba(80, 0, 160, 0.16) 0%, transparent 48%), radial-gradient(circle at 50% 50%, rgba(0, 240, 255, 0.03) 0%, transparent 70%), #030508",
        }}
      >
        {/* Subtle CSS star field */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(1px 1px at 20px 30px, #ffffff, rgba(0,0,0,0)), radial-gradient(1px 1px at 40px 70px, rgba(255,255,255,0.7), rgba(0,0,0,0)), radial-gradient(1.5px 1.5px at 90px 40px, #00f0ff, rgba(0,0,0,0)), radial-gradient(1px 1px at 160px 120px, #ffffff, rgba(0,0,0,0)), radial-gradient(1.5px 1.5px at 230px 190px, rgba(255,255,255,0.8), rgba(0,0,0,0)), radial-gradient(1px 1px at 310px 80px, #00f0ff, rgba(0,0,0,0))",
            backgroundSize: "350px 350px",
          }}
        />

        {/* Subtle vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

        {/* Subtle blue & cyan atmospheric glow behind globe */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[55vw] h-[55vw] max-w-[800px] max-h-[800px] rounded-full bg-blue-600/12 blur-[140px] pointer-events-none" />
        <div className="absolute right-12 top-1/2 -translate-y-1/2 w-[35vw] h-[35vw] max-w-[500px] max-h-[500px] rounded-full bg-cyan-500/8 blur-[100px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-12 py-12 lg:py-0 grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(500px,1.1fr)] gap-8 lg:gap-4 items-center">

          {/* ── LEFT: Content ── */}
          <div className="flex flex-col justify-center page-in">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-cyan-400 w-fit mb-7 shadow-[0_0_15px_rgba(0,240,255,0.1)]">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Real-Time Anonymous Spaces
            </div>

            {/* Headline with subtle cyan light spill */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight mb-5 drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]">
              <span className="text-white">Talk freely.</span>
              <br />
              <span className="text-cyan-400 drop-shadow-[0_0_35px_rgba(0,240,255,0.35)]">Reveal selectively.</span>
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
                className="flex items-center justify-center gap-2.5 w-full py-4 rounded-full bg-[#111]/80 border border-white/12 text-white font-semibold text-base hover:bg-white/10 hover:border-white/25 transition-all active:scale-[0.98]"
              >
                <PeopleIcon className="w-5 h-5 text-gray-400" />
                Join as Member
              </Link>

              {/* Secondary: Join Admin */}
              <Link
                href="/admin"
                className="flex items-center justify-center gap-2.5 w-full py-4 rounded-full bg-[#111]/80 border border-white/12 text-white font-semibold text-base hover:bg-white/10 hover:border-white/25 transition-all active:scale-[0.98]"
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

          <div
            className="w-full h-full min-h-[420px] sm:min-h-[520px] lg:min-h-[650px] flex items-center justify-center page-in"
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
          EXPLORE PUBLIC SPACES
      ──────────────────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-[#050608] border-t border-white/5 py-20 sm:py-28 px-5 sm:px-8 lg:px-12 relative overflow-hidden">
        <div className="max-w-[1400px] mx-auto relative z-10">
          {/* Section header */}
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <span className="text-xs font-bold tracking-[0.2em] text-cyan-400 uppercase">
              Public Spaces
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
              Explore public{" "}
              <span className="text-cyan-400">rooms</span>
            </h2>
            <p className="mt-4 text-gray-400 text-base sm:text-lg leading-relaxed">
              Jump into an open conversation. Stay anonymous. Leave anytime.
            </p>
          </div>

          {/* Room cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">

            {/* Su Vichar / Shero-Shairi */}
            <div className="group relative bg-gradient-to-br from-[#1a0a30] to-[#0d0620] border border-indigo-500/20 rounded-2xl p-6 hover:border-indigo-400/50 transition-all duration-300 hover:-translate-y-0.5 flex flex-col shadow-lg">
              <div className="absolute inset-0 rounded-2xl bg-indigo-500/0 group-hover:bg-indigo-500/5 transition-colors duration-300 pointer-events-none" />
              <div className="relative flex-1">
                <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 border border-indigo-400/25 flex items-center justify-center text-indigo-300 mb-4 group-hover:border-indigo-400/50 transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                </div>
                <h3 className="text-white font-bold text-base mb-1.5">Su Vichar / Shero-Shairi</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">Thoughts, poetry, quotes and meaningful words.</p>
                <div className="flex items-center gap-2 text-xs text-indigo-300/80 mb-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  <span>Public Space</span>
                </div>
                <p className="text-xs text-gray-500 italic truncate">Join the conversation</p>
              </div>
              <Link href="/room/su-vichar" className="relative mt-5 flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-indigo-500/15 border border-indigo-400/25 text-indigo-300 text-sm font-semibold hover:bg-indigo-500/25 hover:border-indigo-400/50 transition-all group-hover:text-indigo-200">
                Enter Room
                <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </Link>
            </div>

            {/* Gesu-Talks */}
            <div className="group relative bg-gradient-to-br from-[#2a0f00] to-[#1a0800] border border-orange-500/20 rounded-2xl p-6 hover:border-orange-400/50 transition-all duration-300 hover:-translate-y-0.5 flex flex-col shadow-lg">
              <div className="absolute inset-0 rounded-2xl bg-orange-500/0 group-hover:bg-orange-500/5 transition-colors duration-300 pointer-events-none" />
              <div className="relative flex-1">
                <div className="w-11 h-11 rounded-2xl bg-orange-500/15 border border-orange-400/25 flex items-center justify-center text-orange-300 mb-4 group-hover:border-orange-400/50 transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                  </svg>
                </div>
                <h3 className="text-white font-bold text-base mb-1.5">Gesu-Talks</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">Casual chats, chill vibes and endless talks.</p>
                <div className="flex items-center gap-2 text-xs text-orange-300/80 mb-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                  <span>Public Space</span>
                </div>
                <p className="text-xs text-gray-500 italic truncate">Join the conversation</p>
              </div>
              <Link href="/room/gesu-talks" className="relative mt-5 flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-orange-500/15 border border-orange-400/25 text-orange-300 text-sm font-semibold hover:bg-orange-500/25 hover:border-orange-400/50 transition-all group-hover:text-orange-200">
                Enter Room
                <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </Link>
            </div>

            {/* Gaming */}
            <div className="group relative bg-gradient-to-br from-[#001a2a] to-[#000f1a] border border-cyan-500/20 rounded-2xl p-6 hover:border-cyan-400/50 transition-all duration-300 hover:-translate-y-0.5 flex flex-col shadow-lg">
              <div className="absolute inset-0 rounded-2xl bg-cyan-500/0 group-hover:bg-cyan-500/5 transition-colors duration-300 pointer-events-none" />
              <div className="relative flex-1">
                <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-400/25 flex items-center justify-center text-cyan-300 mb-4 group-hover:border-cyan-400/50 transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
                  </svg>
                </div>
                <h3 className="text-white font-bold text-base mb-1.5">Gaming</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">Find teammates, talk games, share clips and win together.</p>
                <div className="flex items-center gap-2 text-xs text-cyan-300/80 mb-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span>Public Space</span>
                </div>
                <p className="text-xs text-gray-500 italic truncate">Join the conversation</p>
              </div>
              <Link href="/room/gaming" className="relative mt-5 flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-400/25 text-cyan-300 text-sm font-semibold hover:bg-cyan-500/25 hover:border-cyan-400/50 transition-all group-hover:text-cyan-200">
                Enter Room
                <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </Link>
            </div>

            {/* Formal-Talks */}
            <div className="group relative bg-gradient-to-br from-[#0a0f14] to-[#060a0e] border border-slate-500/20 rounded-2xl p-6 hover:border-teal-400/40 transition-all duration-300 hover:-translate-y-0.5 flex flex-col shadow-lg">
              <div className="absolute inset-0 rounded-2xl bg-teal-500/0 group-hover:bg-teal-500/5 transition-colors duration-300 pointer-events-none" />
              <div className="relative flex-1">
                <div className="w-11 h-11 rounded-2xl bg-teal-500/10 border border-teal-400/20 flex items-center justify-center text-teal-300 mb-4 group-hover:border-teal-400/40 transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <h3 className="text-white font-bold text-base mb-1.5">Formal-Talks</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">Professional discussions, career, skills and more.</p>
                <div className="flex items-center gap-2 text-xs text-teal-300/80 mb-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                  <span>Public Space</span>
                </div>
                <p className="text-xs text-gray-500 italic truncate">Join the conversation</p>
              </div>
              <Link href="/room/formal-talks" className="relative mt-5 flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-teal-500/10 border border-teal-400/20 text-teal-300 text-sm font-semibold hover:bg-teal-500/20 hover:border-teal-400/40 transition-all group-hover:text-teal-200">
                Enter Room
                <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </Link>
            </div>

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
