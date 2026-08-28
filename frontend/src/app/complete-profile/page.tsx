"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  VeilCard,
  VeilInput,
  VeilButton,
  VeilBadge,
  SparkleIcon,
  Toast,
  Spinner,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

function getSafeRedirectUrl(target: string | null): string {
  if (!target) return "/";
  if (target.startsWith("/") && !target.startsWith("//") && !target.includes("://")) {
    return target;
  }
  return "/";
}

function CompleteProfileForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next") || searchParams.get("redirect");
  const nextUrl = getSafeRedirectUrl(rawNext);


  const { user, profile, loading: authLoading, updateProfile, refreshProfile } = useAuth();

  const [realName, setRealName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?next=/complete-profile");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (profile?.real_name && profile.real_name !== "Veil Member") {
      setRealName(profile.real_name);
    }
  }, [profile]);

  const initials = realName.trim()
    ? realName
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "V";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image (PNG, JPG, WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be 5MB or less.");
      return;
    }

    setError("");
    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop() || "png";
      const filePath = `${user?.id}-${Date.now()}.${fileExt}`;

      let publicUrl: string | null = null;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
        publicUrl = urlData.publicUrl;
      } else {
        publicUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      if (publicUrl) {
        setAvatarUrl(publicUrl);
      }
    } catch {
      setError("Failed to upload photo. You can still continue without a photo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedName = realName.trim();
    if (!trimmedName) {
      setError("Please enter your Real Name.");
      return;
    }
    if (trimmedName.length > 60) {
      setError("Real Name must be 60 characters or less.");
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        realName: trimmedName,
        avatarUrl: avatarUrl || undefined,
      });
      await refreshProfile();
      router.push(nextUrl);
    } catch (err: any) {
      setError(err.message || "Failed to save profile. Please try again.");
      setSaving(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-dvh bg-[var(--veil-bg)] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <main className="min-h-dvh bg-[var(--veil-bg)] flex flex-col px-4 py-8 sm:p-6 page-in items-center justify-center overflow-x-hidden">
      <div className="w-full max-w-md my-auto">
        <div className="text-center mb-6 flex flex-col items-center">
          <Link href="/" className="inline-block group mb-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--veil-cyan)] tracking-tight group-hover:opacity-90 transition-opacity">
              Veil
            </h1>
          </Link>
          <VeilBadge>
            <SparkleIcon className="w-3.5 h-3.5 text-[var(--veil-cyan)]" /> Setup Identity
          </VeilBadge>
          <h2 className="text-xl sm:text-2xl font-bold text-white mt-3.5">
            Complete Your Veil Profile
          </h2>
          <p className="text-xs sm:text-sm text-[var(--veil-text-muted)] mt-1.5 leading-relaxed">
            Set up your persistent profile for Public Spaces.
          </p>
        </div>

        <VeilCard className="p-5 sm:p-7">
          {error && (
            <div className="mb-4">
              <Toast message={error} type="error" />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Avatar Picker */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[var(--veil-cyan)]/80 p-1 bg-[#18181b] shadow-[0_0_20px_rgba(0,240,255,0.2)]">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-cyan-950 to-[#121212] flex items-center justify-center text-cyan-300 font-bold text-2xl">
                      {initials}
                    </div>
                  )}
                </div>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full border border-white/15 hover:border-cyan-400/40 text-gray-300 hover:text-white transition-all"
                >
                  {uploading ? "Uploading..." : avatarUrl ? "Change Photo" : "Add Photo"}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(null)}
                    className="text-xs text-red-400 hover:text-red-300 hover:underline px-2"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-[11px] text-[var(--veil-text-muted)]">
                Optional. Photo or initials shown in Public Spaces.
              </p>
            </div>

            {/* Real Name Input */}
            <div>
              <VeilInput
                label="Real Name"
                type="text"
                placeholder="e.g. Dhruv Singh"
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                required
                maxLength={60}
                autoFocus
                disabled={saving}
              />
              <p className="text-[11px] text-[var(--veil-text-muted)] -mt-2">
                This name is visible in Public Spaces. In Private Rooms, your anonymity remains on.
              </p>
            </div>

            <div className="pt-2">
              <VeilButton type="submit" loading={saving} disabled={uploading}>
                Continue
              </VeilButton>
            </div>
          </form>
        </VeilCard>
      </div>
    </main>
  );
}

export default function CompleteProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-[var(--veil-bg)] flex items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <CompleteProfileForm />
    </Suspense>
  );
}
