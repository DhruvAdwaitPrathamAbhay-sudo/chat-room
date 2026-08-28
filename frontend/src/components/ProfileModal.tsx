"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { VeilCard, VeilInput, VeilButton, Toast } from "@/components/ui";

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const { profile, user, updateProfile } = useAuth();
  const [realName, setRealName] = useState(profile?.real_name || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const trimmed = realName.trim();
    if (!trimmed) {
      setError("Please provide a Real Name.");
      return;
    }
    if (trimmed.length > 60) {
      setError("Real Name must be 60 characters or less.");
      return;
    }

    setLoading(true);
    try {
      await updateProfile({ realName: trimmed });
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-modal="true"
      role="dialog"
      aria-label="Edit Profile"
    >
      <div className="w-full max-w-sm">
        <VeilCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Your Veil Profile</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-1"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="mb-4">
              <Toast message={error} type="error" />
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold text-center">
              ✓ Profile updated successfully
            </div>
          )}

          <div className="mb-4 text-xs text-[var(--veil-text-muted)] space-y-1">
            <p>
              <strong className="text-gray-300">Email:</strong> {user?.email || "Google Account"}
            </p>
            <p>
              <strong className="text-gray-300">Account ID:</strong>{" "}
              <span className="font-mono text-[10px] opacity-75">{user?.id}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <VeilInput
              label="Real Name"
              type="text"
              placeholder="Your full or real name"
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              required
              maxLength={60}
              disabled={loading}
            />
            <p className="text-[11px] text-[var(--veil-text-muted)] -mt-2">
              Your real identity across Veil. Always anonymous inside private rooms unless revealed by an admin.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-full border border-white/15 text-gray-300 hover:text-white text-xs font-semibold transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <div className="flex-1">
                <VeilButton type="submit" loading={loading} className="!py-2.5 !text-xs !min-h-[40px]">
                  Save Changes
                </VeilButton>
              </div>
            </div>
          </form>
        </VeilCard>
      </div>
    </div>
  );
}
