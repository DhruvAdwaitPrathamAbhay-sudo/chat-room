"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Password reset is not applicable for passwordless OTP authentication.
// Redirect users to the login page.
export default function ResetPasswordPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return (
    <main className="min-h-dvh bg-[var(--veil-bg)] flex items-center justify-center">
      <p className="text-sm text-[var(--veil-text-muted)]">Redirecting...</p>
    </main>
  );
}
