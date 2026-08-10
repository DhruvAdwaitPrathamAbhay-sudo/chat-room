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
  const [roomCode, setRoomCode] = useState("");
  const [password, setPassword] = useState("");
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

    setLoading(true);
    try {
      const res = await joinRoom(code, password);
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
    <main className="min-h-dvh bg-[var(--veil-bg)] flex flex-col p-6 page-in justify-between">
      <header className="w-full max-w-md mx-auto">
        <BackButton href="/" />
      </header>

      <div className="w-full max-w-md mx-auto my-auto py-6">
        <VeilCard className="p-7">
          <div className="text-center mb-7">
            <h1 className="text-3xl font-extrabold text-[var(--veil-cyan)] tracking-tight">
              Veil
            </h1>
            <h2 className="text-2xl font-bold text-white mt-4">
              Join a private room
            </h2>
            <p className="text-sm text-[var(--veil-text-muted)] mt-1.5">
              Enter the Room ID and Room Password to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <Toast message={error} type="error" />}

            <VeilInput
              label="Room ID"
              placeholder="E.G. VX7K2P"
              icon={<KeyIcon />}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={12}
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
              className="text-sm font-medium text-[var(--veil-text-muted)] hover:text-white transition-colors inline-flex items-center gap-1.5"
            >
              Don&apos;t have a room? Create one <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </VeilCard>
      </div>

      <div className="h-4" />
    </main>
  );
}
