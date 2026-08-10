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
} from "@/components/ui";

export default function LandingPage() {
  const [revealed, setRevealed] = useState(false);

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
