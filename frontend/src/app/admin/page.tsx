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
import { adminAccess, publicAdminAccess, ApiError } from "@/lib/api";

const OFFICIAL_PUBLIC_ROOMS = ["SU-VICHAR", "GESU-TALKS", "GAMING", "FORMAL-TALKS"];

function isPublicRoom(code: string): boolean {
  return OFFICIAL_PUBLIC_ROOMS.includes(code.trim().toUpperCase());
}

export default function JoinAdminPage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [password, setPassword] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isPublic = isPublicRoom(roomCode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setError("Please enter a Room ID.");
      return;
    }
    if (!isPublic && !password) {
      setError("Please enter the Room Password.");
      return;
    }
    if (!adminKey.trim()) {
      setError("Please enter your Admin Key.");
      return;
    }

    setLoading(true);
    try {
      let res;
      if (isPublic) {
        res = await publicAdminAccess(code, adminKey.trim());
      } else {
        res = await adminAccess(code, password, adminKey.trim());
      }
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
    <main className="min-h-dvh bg-[var(--veil-bg)] flex flex-col px-4 py-6 sm:p-6 page-in items-center justify-center overflow-x-hidden">
      <div className="w-full max-w-md my-auto">
        <div className="text-center mb-6 flex flex-col items-center">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--veil-cyan)] tracking-tight mb-2.5">
            Veil
          </h1>
          <VeilBadge>
            <CrownIcon className="text-[var(--veil-cyan)]" /> Admin Access
          </VeilBadge>
          <h2 className="text-xl sm:text-2xl font-bold text-white mt-3.5">
            Enter as Admin
          </h2>
          <p className="text-xs sm:text-sm text-[var(--veil-text-muted)] mt-1.5 leading-relaxed">
            {isPublic
              ? "Public room — only your Global Admin Key is required."
              : "Provide your credentials to manage this room."}
          </p>
        </div>

        <VeilCard className="p-5 sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
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

            {!isPublic && (
              <PasswordInput
                label="Room Password"
                placeholder="Enter Room Password"
                icon={<LockIcon />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            )}

            <hr className="border-[var(--veil-border)] my-1" />

            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <KeyIcon className="text-[var(--veil-cyan)] w-4 h-4" />
                <span className="text-sm font-semibold text-[var(--veil-cyan)]">
                  {isPublic ? "Global Admin Key" : "Admin Key"}
                </span>
              </div>
              <PasswordInput
                placeholder={isPublic ? "Your global admin key" : "Your unique admin key"}
                icon={<KeyIcon />}
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                required
              />
              <p className="text-xs text-[var(--veil-text-muted)] mt-1.5">
                {isPublic
                  ? "Your global admin key grants moderation access to official public rooms."
                  : "Your admin key gives you control over this room."}
              </p>
            </div>

            <div className="pt-2">
              <VeilButton type="submit" loading={loading}>
                Enter as Admin <ArrowRightIcon />
              </VeilButton>
            </div>
          </form>
        </VeilCard>

        <div className="mt-6 flex flex-col items-center gap-2 text-center">
          <Link
            href="/join"
            className="text-xs sm:text-sm font-medium text-[var(--veil-text-muted)] hover:text-white transition-colors inline-flex items-center gap-1.5 py-1.5 px-2"
          >
            <ArrowLeftIcon className="w-4 h-4" /> Join as member instead
          </Link>
          <Link
            href="/"
            className="text-xs font-medium text-[var(--veil-text-dim)] hover:text-[var(--veil-text-muted)] transition-colors py-1 px-2"
          >
            Cancel
          </Link>
        </div>
      </div>
    </main>
  );
}
