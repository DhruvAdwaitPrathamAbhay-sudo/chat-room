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
  SparkleIcon,
  LockIcon,
  KeyIcon,
  ArrowRightIcon,
  Toast,
} from "@/components/ui";
import { createRoom, ApiError } from "@/lib/api";

export default function CreateRoomPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [privacy, setPrivacy] = useState<"private" | "public">("private");
  const [password, setPassword] = useState("");
  const [globalAdminKey, setGlobalAdminKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter a room name.");
      return;
    }
    if (!password) {
      setError("Please set a room password.");
      return;
    }
    if (!globalAdminKey.trim()) {
      setError("An admin key is required to create a room.");
      return;
    }

    setLoading(true);
    try {
      const res = await createRoom({
        name: name.trim(),
        password,
        globalAdminKey: globalAdminKey.trim(),
      });

      // Route creator directly to their admin control room
      router.push(`/admin/${res.room.roomCode}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to create room. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh bg-[var(--veil-bg)] flex flex-col px-4 py-6 sm:p-6 page-in items-center justify-center overflow-x-hidden">
      <div className="w-full max-w-md my-auto">
        <div className="text-center mb-6 flex flex-col items-center">
          <span className="text-xs font-bold tracking-widest text-[var(--veil-cyan)] uppercase mb-2">
            VEIL
          </span>
          <VeilBadge>
            <SparkleIcon className="text-[var(--veil-cyan)]" /> New Space
          </VeilBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-3">
            Create a Room
          </h1>
          <p className="text-xs sm:text-sm text-[var(--veil-text-muted)] mt-1.5 max-w-xs">
            Set up your private anonymous space in seconds.
          </p>
        </div>

        <VeilCard className="p-5 sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {error && <Toast message={error} type="error" />}

            <VeilInput
              label="Room Name"
              placeholder="e.g., Late Night Chaos"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
            />

            <div>
              <label className="text-sm font-semibold text-white/90 block mb-1.5">
                Room Privacy
              </label>
              <div className="grid grid-cols-2 p-1 bg-[var(--veil-surface-2)] border border-[var(--veil-border)] rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setPrivacy("private")}
                  className={`py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer min-h-[40px] touch-manipulation ${
                    privacy === "private"
                      ? "bg-[var(--veil-surface)] text-[var(--veil-cyan)] border border-[var(--veil-cyan)]/40 shadow-sm"
                      : "text-[var(--veil-text-muted)] hover:text-white"
                  }`}
                >
                  Private
                </button>
                <button
                  type="button"
                  onClick={() => setPrivacy("public")}
                  className={`py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer min-h-[40px] touch-manipulation ${
                    privacy === "public"
                      ? "bg-[var(--veil-surface)] text-[var(--veil-cyan)] border border-[var(--veil-cyan)]/40 shadow-sm"
                      : "text-[var(--veil-text-muted)] hover:text-white"
                  }`}
                >
                  Public
                </button>
              </div>
            </div>

            <PasswordInput
              label="Set Room Password"
              placeholder="Enter secure password"
              icon={<LockIcon />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <div>
              <PasswordInput
                label="Global Admin Key"
                placeholder="Enter global admin key"
                icon={<KeyIcon />}
                value={globalAdminKey}
                onChange={(e) => setGlobalAdminKey(e.target.value)}
                required
              />
              <p className="text-xs text-[var(--veil-text-muted)] mt-1.5">
                An admin key is required to create a room.
              </p>
            </div>

            <div className="pt-2">
              <VeilButton type="submit" loading={loading}>
                Create Room <ArrowRightIcon />
              </VeilButton>
            </div>
          </form>
        </VeilCard>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-xs sm:text-sm font-medium text-[var(--veil-text-muted)] hover:text-white transition-colors py-2 px-3 inline-block"
          >
            Cancel / Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
