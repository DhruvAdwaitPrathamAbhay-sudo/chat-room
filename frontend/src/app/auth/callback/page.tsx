"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Spinner, VeilCard } from "@/components/ui";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function handleAuthCallback() {
      try {
        const code = searchParams.get("code");
        const next = searchParams.get("next") || "/";

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        // Get active session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session?.user) {
          // Check if profile exists and has real_name
          const { data: prof } = await supabase
            .from("profiles")
            .select("real_name")
            .eq("id", session.user.id)
            .maybeSingle();

          if (!prof?.real_name || prof.real_name === "Veil Member") {
            if (mounted) {
              router.replace(`/complete-profile?next=${encodeURIComponent(next)}`);
              return;
            }
          }
        }

        if (mounted) {
          router.replace(next);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || "Authentication failed. Please try again.");
        }
      }
    }

    handleAuthCallback();

    return () => {
      mounted = false;
    };
  }, [router, searchParams]);

  if (error) {
    return (
      <main className="min-h-dvh bg-[var(--veil-bg)] flex items-center justify-center p-4">
        <VeilCard className="p-6 max-w-sm w-full text-center">
          <div className="text-3xl mb-3">⚠️</div>
          <h2 className="text-lg font-bold text-white mb-2">Authentication Failed</h2>
          <p className="text-sm text-[var(--veil-text-muted)] mb-6 leading-relaxed">
            {error}
          </p>
          <button
            onClick={() => router.push("/login")}
            className="w-full py-3 rounded-full bg-[var(--veil-cyan)] text-black font-bold text-sm hover:opacity-90 transition-opacity"
          >
            Back to Sign In
          </button>
        </VeilCard>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[var(--veil-bg)] flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3 text-[var(--veil-text-muted)]">
        <Spinner />
        <p className="text-sm font-medium text-white">Completing sign-in...</p>
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-dvh bg-[var(--veil-bg)] flex items-center justify-center p-4">
          <div className="flex flex-col items-center gap-3 text-[var(--veil-text-muted)]">
            <Spinner />
            <p className="text-sm font-medium text-white">Completing sign-in...</p>
          </div>
        </main>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
