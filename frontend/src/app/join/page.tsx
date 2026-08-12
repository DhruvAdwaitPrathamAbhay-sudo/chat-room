"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BackButton,
  VeilCard,
  VeilInput,
  PasswordInput,
  VeilButton,
  KeyIcon,
  LockIcon,
  ArrowRightIcon,
  Toast,
} from "@/components/ui";
import { joinRoom, ApiError } from "@/lib/api";

export default function JoinMemberPage() {
  const router = useRouter();
  const [realName, setRealName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!realName.trim()) {
      setError("Please enter your real name.");
      return;
    }
    if (realName.trim().length > 100) {
      setError("Real name must be 100 characters or fewer.");
      return;
    }
    const name = roomName.trim();
    if (!name) {
      setError("Please enter a Room Name.");
      return;
    }
    if (!password) {
      setError("Please enter the Room Password.");
      return;
    }

    setLoading(true);
    try {
      const res = await joinRoom(realName.trim(), name, password);
      router.push(`/room/${res.room.roomCode}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to join room. Please check your network connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh bg-[var(--veil-bg)] flex flex-col px-4 py-5 sm:p-6 page-in justify-between overflow-x-hidden">
      <header className="w-full max-w-md mx-auto">
        <BackButton href="/" />
      </header>

      <div className="w-full max-w-md mx-auto my-auto py-4 sm:py-6">
        <VeilCard className="p-5 sm:p-7">
          <div className="text-center mb-6 sm:mb-7">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--veil-cyan)] tracking-tight">
              Veil
            </h1>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-3 sm:mt-4">
              Join a private room
            </h2>
            <p className="text-xs sm:text-sm text-[var(--veil-text-muted)] mt-1.5 leading-relaxed">
              Your real name is only revealed to the room admin if they choose.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {error && <Toast message={error} type="error" />}

            <VeilInput
              label="Real Name"
              placeholder="Enter your real name"
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              maxLength={100}
              required
            />

            <VeilInput
              label="Room Name"
              placeholder="e.g., Gaming"
              icon={<KeyIcon />}
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              maxLength={100}
              required
            />

            <PasswordInput
              label="Room Password"
              placeholder="Enter room password"
              icon={<LockIcon />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <div className="pt-2">
              <VeilButton type="submit" loading={loading}>
                Enter Room <ArrowRightIcon />
              </VeilButton>
            </div>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/create"
              className="text-xs sm:text-sm font-medium text-[var(--veil-text-muted)] hover:text-white transition-colors inline-flex items-center gap-1.5 py-1.5 px-2"
            >
              Don&apos;t have a room? Create one <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </VeilCard>
      </div>

      <div className="h-2 sm:h-4" />
    </main>
  );
}
