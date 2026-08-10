"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  VeilCard,
  VeilInput,
  PasswordInput,
  VeilButton,
  VeilBadge,
  CrownIcon,
  HashIcon,
  LockIcon,
  KeyIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  Toast,
} from "@/components/ui";
import { adminAccess, ApiError } from "@/lib/api";

export default function JoinAdminPage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [password, setPassword] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setError("Please enter a Room ID.");
      return;
    }
    if (!password) {
      setError("Please enter the Room Password.");
      return;
    }
    if (!adminKey.trim()) {
      setError("Please enter your Admin Key.");
      return;
    }

    setLoading(true);
    try {
      const res = await adminAccess(code, password, adminKey.trim());
      router.push(`/admin/${res.room.roomCode}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to authenticate as admin. Please check your inputs.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh bg-[var(--veil-bg)] flex flex-col p-6 page-in items-center justify-center">
      <div className="w-full max-w-md my-auto">
        <div className="text-center mb-6 flex flex-col items-center">
          <h1 className="text-3xl font-extrabold text-[var(--veil-cyan)] tracking-tight mb-3">
            Veil
          </h1>
          <VeilBadge>
            <CrownIcon className="text-[var(--veil-cyan)]" /> Admin Access
          </VeilBadge>
          <h2 className="text-2xl font-bold text-white mt-4">
            Enter as Admin
          </h2>
          <p className="text-sm text-[var(--veil-text-muted)] mt-1.5">
            Provide your credentials to manage this room.
          </p>
        </div>

        <VeilCard className="p-7">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <Toast message={error} type="error" />}

            <VeilInput
              label="Room ID"
              placeholder="Enter Room ID"
              icon={<HashIcon />}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={12}
              required
            />

            <PasswordInput
              label="Room Password"
              placeholder="Enter Room Password"
              icon={<LockIcon />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <hr className="border-[var(--veil-border)] my-1" />

            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <KeyIcon className="text-[var(--veil-cyan)] w-4 h-4" />
                <span className="text-sm font-semibold text-[var(--veil-cyan)]">
                  Admin Key
                </span>
              </div>
              <PasswordInput
                placeholder="Your unique admin key"
                icon={<KeyIcon />}
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                required
              />
              <p className="text-xs text-[var(--veil-text-muted)] mt-1.5">
                Your admin key gives you control over this room.
              </p>
            </div>

            <div className="pt-2">
              <VeilButton type="submit" loading={loading}>
                Enter as Admin <ArrowRightIcon />
              </VeilButton>
            </div>
          </form>
        </VeilCard>

        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <Link
            href="/join"
            className="text-sm font-medium text-[var(--veil-text-muted)] hover:text-white transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowLeftIcon className="w-4 h-4" /> Join as member instead
          </Link>
          <Link
            href="/"
            className="text-xs font-medium text-[var(--veil-text-dim)] hover:text-[var(--veil-text-muted)] transition-colors"
          >
            Cancel
          </Link>
        </div>
      </div>
    </main>
  );
}
