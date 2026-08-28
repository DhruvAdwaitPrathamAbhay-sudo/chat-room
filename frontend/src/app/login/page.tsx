"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  VeilCard,
  VeilInput,
  VeilButton,
  VeilBadge,
  LockIcon,
  Toast,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

function getSafeRedirectUrl(target: string | null): string {
  if (!target) return "/";
  if (target.startsWith("/") && !target.startsWith("//") && !target.includes("://")) {
    return target;
  }
  return "/";
}

function EmailAuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next") || searchParams.get("redirect");
  const nextUrl = getSafeRedirectUrl(rawNext);
  const isSignUpMode = searchParams.get("mode") !== "signin";

  const { user, profile, loading: authLoading, signInWithEmailOtp, verifyEmailOtp, resendEmailOtp } = useAuth();

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // If already authenticated and profile is complete, redirect immediately to intended destination
  useEffect(() => {
    if (!authLoading && user) {
      if (!profile?.real_name || profile.real_name === "Veil Member") {
        router.push(`/complete-profile?next=${encodeURIComponent(nextUrl)}`);
      } else {
        router.push(nextUrl);
      }
    }
  }, [authLoading, user, profile, router, nextUrl]);

  // Resend cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Step 1: Request OTP code via Supabase passwordless auth
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfoMessage("");

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailOtp({ email: trimmedEmail, redirectTo: nextUrl });
      setStep("otp");
      setCooldown(30);
      setInfoMessage(`We sent a verification code to ${trimmedEmail}.`);
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("rate limit") || msg.includes("too many")) {
        setError("Too many requests. Please wait a moment before trying again.");
      } else {
        setError("Unable to send code right now. Please check your email and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify 6-digit OTP code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedCode = otpCode.trim();
    if (!trimmedCode || trimmedCode.length < 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);
    try {
      const { user: verifiedUser } = await verifyEmailOtp({
        email: email.trim().toLowerCase(),
        token: trimmedCode,
      });

      if (verifiedUser) {
        if (!profile?.real_name || profile.real_name === "Veil Member") {
          router.push(`/complete-profile?next=${encodeURIComponent(nextUrl)}`);
        } else {
          router.push(nextUrl);
        }
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("expired") || msg.includes("invalid") || msg.includes("Token has expired")) {
        setError("That code is invalid or has expired. Please request a new code.");
      } else {
        setError("Unable to verify right now. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Resend code
  const handleResend = async () => {
    if (cooldown > 0 || loading) return;
    setError("");
    setLoading(true);
    try {
      await resendEmailOtp(email.trim().toLowerCase());
      setCooldown(30);
      setInfoMessage("A new verification code has been sent to your email.");
    } catch {
      setError("Unable to resend code right now. Please wait a moment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh bg-[var(--veil-bg)] flex flex-col px-4 py-8 sm:p-6 page-in items-center justify-center overflow-x-hidden">
      <div className="w-full max-w-md my-auto">
        {/* Header */}
        <div className="text-center mb-6 flex flex-col items-center">
          <Link href="/" className="inline-block group mb-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--veil-cyan)] tracking-tight group-hover:opacity-90 transition-opacity">
              Veil
            </h1>
          </Link>
          <VeilBadge>
            <LockIcon className="w-3.5 h-3.5 text-[var(--veil-cyan)]" /> Passwordless Access
          </VeilBadge>
          <h2 className="text-xl sm:text-2xl font-bold text-white mt-3.5">
            {step === "email"
              ? isSignUpMode
                ? "Sign up to continue"
                : "Sign in to continue"
              : "Check Your Email"}
          </h2>
          <p className="text-xs sm:text-sm text-[var(--veil-text-muted)] mt-1.5 leading-relaxed max-w-sm">
            {step === "email"
              ? "Create your free Veil account to join public conversations."
              : `Enter the code we sent to ${email}.`}
          </p>
        </div>

        <VeilCard className="p-5 sm:p-7">
          {error && (
            <div className="mb-4">
              <Toast message={error} type="error" />
            </div>
          )}

          {infoMessage && !error && (
            <div className="mb-4 p-3.5 rounded-xl bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 text-xs leading-relaxed">
              {infoMessage}
            </div>
          )}

          {step === "email" ? (
            /* Screen 1: Email Input */
            <form onSubmit={handleSendOtp} className="space-y-4">
              <VeilInput
                label="Email Address"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                disabled={loading}
              />

              <div className="pt-2">
                <VeilButton type="submit" loading={loading}>
                  Continue with Email
                </VeilButton>
              </div>

              <div className="relative my-4 flex items-center justify-center">
                <div className="w-full border-t border-[var(--veil-border)]" />
                <span className="absolute bg-[var(--veil-surface)] px-3 text-xs text-[var(--veil-text-muted)]">
                  or
                </span>
              </div>

              <div className="text-center text-xs text-[var(--veil-text-muted)] pt-1">
                {isSignUpMode ? (
                  <>
                    Already have an account?{" "}
                    <Link
                      href={`/login?mode=signin&next=${encodeURIComponent(nextUrl)}`}
                      className="text-[var(--veil-cyan)] font-semibold hover:underline"
                    >
                      Sign In
                    </Link>
                  </>
                ) : (
                  <>
                    Don&apos;t have an account yet?{" "}
                    <Link
                      href={`/login?mode=signup&next=${encodeURIComponent(nextUrl)}`}
                      className="text-[var(--veil-cyan)] font-semibold hover:underline"
                    >
                      Sign Up
                    </Link>
                  </>
                )}
              </div>
            </form>
          ) : (
            /* Screen 2: OTP Verification */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-[#18181b] border border-white/15 rounded-xl px-4 py-3.5 text-center text-xl sm:text-2xl font-mono tracking-[0.3em] text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all placeholder:text-gray-600"
                  autoFocus
                  required
                  disabled={loading}
                />
              </div>

              <div className="pt-2">
                <VeilButton type="submit" loading={loading}>
                  Verify
                </VeilButton>
              </div>

              <div className="pt-3 border-t border-white/8 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setOtpCode("");
                    setError("");
                    setInfoMessage("");
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ← Use a different email
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || loading}
                  className="text-[var(--veil-cyan)] hover:underline disabled:opacity-50 disabled:no-underline font-semibold"
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend Code"}
                </button>
              </div>
            </form>
          )}
        </VeilCard>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-xs text-[var(--veil-text-dim)] hover:text-white transition-colors py-1"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-[var(--veil-bg)] flex items-center justify-center">
          <span className="text-[var(--veil-text-muted)] text-sm">Loading...</span>
        </div>
      }
    >
      <EmailAuthForm />
    </Suspense>
  );
}
