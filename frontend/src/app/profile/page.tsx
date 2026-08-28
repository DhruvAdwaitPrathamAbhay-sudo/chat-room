"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  EyeSlashIcon,
  PeopleIcon,
  ChatIcon,
  DoorIcon,
  Toast,
  Spinner,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut, updateProfile, refreshProfile } = useAuth();

  const [activeNav, setActiveNav] = useState<"profile" | "settings" | "security">("profile");
  const [realName, setRealName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?next=/profile");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (profile?.real_name) {
      setRealName(profile.real_name);
    } else if (user?.user_metadata?.full_name || user?.user_metadata?.name) {
      setRealName(user.user_metadata.full_name || user.user_metadata.name);
    }
  }, [profile, user]);

  const authMethod = "Email (Passwordless OTP / Magic Link)";

  // Avatar resolution: custom Veil avatar > initials fallback
  const currentAvatarUrl =
    avatarPreview ||
    profile?.avatar_url ||
    null;


  const displayName =
    realName ||
    profile?.real_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Veil Member";

  const userInitial = displayName.slice(0, 1).toUpperCase();

  // Save Real Name
  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = realName.trim();
    if (!trimmed) {
      showToast("Please enter a valid Real Name.", "error");
      return;
    }
    if (trimmed.length > 60) {
      showToast("Real Name must be 60 characters or less.", "error");
      return;
    }

    setSavingName(true);
    try {
      await updateProfile({ realName: trimmed });
      await refreshProfile();
      showToast("Personal information updated successfully.");
    } catch (err: any) {
      showToast(err.message || "Failed to update Real Name.", "error");
    } finally {
      setSavingName(false);
    }
  };

  // Upload/Change Avatar
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Please select a valid image file (PNG, JPG, WebP).", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("Image size must be 5MB or less.", "error");
      return;
    }

    setUploadingPhoto(true);

    try {
      // 1. Try uploading to Supabase Storage bucket 'avatars'
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
        // Fallback: Read as optimized base64 data URL
        publicUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      if (publicUrl) {
        setAvatarPreview(publicUrl);
        await updateProfile({ avatarUrl: publicUrl });
        await refreshProfile();
        showToast("Profile picture updated successfully.");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to upload photo. Please try again.", "error");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Remove custom photo
  const handleRemovePhoto = async () => {
    setUploadingPhoto(true);
    try {
      setAvatarPreview(null);
      await updateProfile({ avatarUrl: "" });
      await refreshProfile();
      showToast("Custom photo removed.");
    } catch (err: any) {
      showToast(err.message || "Failed to remove photo.", "error");
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-dvh bg-[#0a0a0a] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#080808] text-white flex flex-col selection:bg-cyan-400 selection:text-black">
      {/* ── Top App Bar ─────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#080808]/90 backdrop-blur-xl border-b border-white/5 h-16 flex items-center justify-between px-4 sm:px-8 lg:px-12">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="p-1.5 rounded-xl bg-cyan-400/10 border border-cyan-400/20 group-hover:border-cyan-400/50 transition-colors">
            <EyeSlashIcon className="text-cyan-400 w-5 h-5" />
          </div>
          <span className="text-cyan-400 font-extrabold text-xl tracking-tight">Veil</span>
        </Link>

        <div className="flex items-center gap-6">
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
            <Link href="/join" className="hover:text-white transition-colors">Chat</Link>
            <Link href="/join" className="hover:text-white transition-colors">People</Link>
            <Link href="/create" className="hover:text-white transition-colors">Room</Link>
          </nav>

          <Link
            href="/profile"
            aria-label="Settings"
            className="p-2 rounded-full text-cyan-400 bg-cyan-400/10 border border-cyan-400/30 hover:bg-cyan-400/20 transition-all flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>
      </header>

      {/* ── Main Content Container ───────────────────────────────────────── */}
      <main className="pt-24 pb-20 md:pb-12 max-w-[1200px] w-full mx-auto px-4 sm:px-8 lg:px-12 flex-1">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed top-20 right-4 sm:right-8 z-50 max-w-sm w-full">
            <Toast message={toastMessage.text} type={toastMessage.type} />
          </div>
        )}

        {/* Page Heading */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
            Profile &amp; Settings
          </h1>
          <p className="text-sm sm:text-base text-gray-400 mt-1">
            Manage your identity and privacy preferences.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 lg:gap-8 items-start">
          {/* ── LEFT COLUMN: Identity Overview & Sidebar ── */}
          <div className="space-y-6">
            {/* User Card */}
            <div className="bg-[#111113] border border-white/8 rounded-2xl p-6 sm:p-7 flex flex-col items-center text-center shadow-xl relative overflow-hidden">
              <div className="relative mb-4">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-2 border-cyan-400/80 p-1 bg-[#18181b] shadow-[0_0_24px_rgba(0,240,255,0.2)]">
                  {currentAvatarUrl ? (
                    <img
                      src={currentAvatarUrl}
                      alt={displayName}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-cyan-950 to-[#121212] flex items-center justify-center text-cyan-300 font-bold text-3xl">
                      {userInitial}
                    </div>
                  )}
                </div>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">{displayName}</h2>
              <p className="text-xs sm:text-sm text-gray-400 mt-0.5 truncate max-w-[240px]">{user.email}</p>

              {/* Sidebar Nav Tabs */}
              <div className="w-full mt-6 pt-6 border-t border-white/8 flex flex-col gap-1 text-xs sm:text-sm font-semibold">
                <button
                  onClick={() => setActiveNav("profile")}
                  className={`w-full px-3.5 py-2.5 rounded-xl flex items-center gap-2.5 transition-colors text-left ${
                    activeNav === "profile"
                      ? "bg-cyan-400/10 text-cyan-400 border border-cyan-400/30"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profile
                </button>
                <button
                  onClick={() => setActiveNav("settings")}
                  className={`w-full px-3.5 py-2.5 rounded-xl flex items-center gap-2.5 transition-colors text-left ${
                    activeNav === "settings"
                      ? "bg-cyan-400/10 text-cyan-400 border border-cyan-400/30"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Settings
                </button>
                <button
                  onClick={() => setActiveNav("security")}
                  className={`w-full px-3.5 py-2.5 rounded-xl flex items-center gap-2.5 transition-colors text-left ${
                    activeNav === "security"
                      ? "bg-cyan-400/10 text-cyan-400 border border-cyan-400/30"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Security
                </button>
                <button
                  onClick={() => signOut()}
                  className="w-full px-3.5 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2.5 transition-colors text-left mt-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>

            {/* Identity Preview Card */}
            <div className="bg-[#111113] border border-white/8 rounded-2xl overflow-hidden shadow-xl">
              <div className="bg-[#18181b] px-5 py-3.5 border-b border-white/8 flex items-center gap-2">
                <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">Identity Preview</h3>
              </div>
              <div className="p-5 space-y-3.5">
                {/* Public Spaces Mode */}
                <div className="p-3.5 rounded-xl bg-[#161619] border border-white/8 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-white/5 border border-white/15 flex-shrink-0 flex items-center justify-center font-bold text-xs text-cyan-400">
                    {currentAvatarUrl ? (
                      <img src={currentAvatarUrl} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      userInitial
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Public Spaces</p>
                    <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                  </div>
                </div>

                {/* Private Rooms Mode */}
                <div className="p-3.5 rounded-xl bg-[#161619] border border-cyan-400/30 relative overflow-hidden flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-cyan-950/60 border border-cyan-400/50 flex-shrink-0 flex items-center justify-center text-cyan-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                      Private Rooms <span className="text-[9px]">🔒</span>
                    </p>
                    <p className="text-sm font-semibold text-white italic truncate">Silent Fox (Anonymous)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: Settings Forms & Cards ── */}
          <div className="space-y-6">
            {/* Personal Information */}
            <div className="bg-[#111113] border border-white/8 rounded-2xl p-6 sm:p-7 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4">Personal Information</h3>
              <form onSubmit={handleSaveName} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    Real Name
                  </label>
                  <input
                    type="text"
                    value={realName}
                    onChange={(e) => setRealName(e.target.value)}
                    placeholder="Enter your real name"
                    className="w-full bg-[#18181b] border border-white/12 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-colors"
                    maxLength={60}
                    required
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    This name is visible in Public Spaces.
                  </p>
                </div>
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingName}
                    className="px-6 py-2.5 rounded-full bg-cyan-400 text-black text-xs font-bold hover:bg-cyan-300 transition-colors shadow-[0_0_20px_rgba(0,240,255,0.2)] disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {savingName ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>

            {/* Profile Picture */}
            <div className="bg-[#111113] border border-white/8 rounded-2xl p-6 sm:p-7 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4">Profile Picture</h3>
              <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                {/* Current Avatar */}
                <div className="w-20 h-20 rounded-full overflow-hidden shrink-0 bg-[#18181b] border border-white/15">
                  {currentAvatarUrl ? (
                    <img src={currentAvatarUrl} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-2xl text-cyan-400">
                      {userInitial}
                    </div>
                  )}
                </div>

                {/* Upload Area */}
                <div className="flex-1 w-full">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/15 rounded-xl p-6 text-center hover:border-cyan-400/60 hover:bg-white/[0.02] transition-colors cursor-pointer group"
                  >
                    <svg className="w-8 h-8 text-gray-400 group-hover:text-cyan-400 mx-auto mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <p className="text-sm font-medium text-white">
                      Drag and drop or <span className="text-cyan-400 font-semibold underline underline-offset-2">browse</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB</p>
                  </div>

                  {currentAvatarUrl && (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        disabled={uploadingPhoto}
                        className="text-xs text-red-400 hover:text-red-300 hover:underline transition-colors"
                      >
                        Remove custom photo
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Privacy Explanation Card */}
            <div className="bg-[#111113] rounded-2xl p-6 sm:p-7 border-l-4 border-cyan-400 shadow-xl border border-y-white/5 border-r-white/5">
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Your Privacy Modes
              </h3>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                Veil protects your identity contextually. In <strong className="text-white">Public Spaces</strong>, your real name and photo build trust. In <strong className="text-cyan-400">Private Rooms</strong>, your anonymity switches on to protect your personal identity.
              </p>
            </div>

            {/* Account & Security */}
            <div className="bg-[#111113] border border-white/8 rounded-2xl p-6 sm:p-7 shadow-xl">
              <h3 className="text-lg font-bold text-red-400 mb-4">Account &amp; Security</h3>
              <div className="space-y-4 text-xs sm:text-sm">
                <div className="flex justify-between items-center py-3 border-b border-white/8">
                  <div>
                    <p className="font-semibold text-white">Email Address</p>
                    <p className="text-gray-400 mt-0.5">{user.email}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-white/8">
                  <div>
                    <p className="font-semibold text-white">Authentication Method</p>
                    <p className="text-gray-400 mt-0.5 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 inline text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Email OTP / Magic Link
                    </p>
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => signOut()}
                    className="px-6 py-2.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Mobile Bottom Navigation ─────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0c0c0e]/95 backdrop-blur-md border-t border-white/8 flex justify-around items-center px-4 py-2">
        <Link href="/join" className="flex flex-col items-center gap-1 text-gray-400 hover:text-white p-2">
          <ChatIcon className="w-5 h-5" />
          <span className="text-[10px] font-medium">Chat</span>
        </Link>
        <Link href="/join" className="flex flex-col items-center gap-1 text-gray-400 hover:text-white p-2">
          <PeopleIcon className="w-5 h-5" />
          <span className="text-[10px] font-medium">People</span>
        </Link>
        <Link href="/create" className="flex flex-col items-center gap-1 text-gray-400 hover:text-white p-2">
          <DoorIcon className="w-5 h-5" />
          <span className="text-[10px] font-medium">Room</span>
        </Link>
      </nav>
    </div>
  );
}
