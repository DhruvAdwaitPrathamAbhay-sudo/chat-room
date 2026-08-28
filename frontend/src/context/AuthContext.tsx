"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

export interface Profile {
  id: string;
  real_name: string;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface SignInWithEmailOtpParams {
  email: string;
  redirectTo?: string;
}

interface VerifyEmailOtpParams {
  email: string;
  token: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signInWithEmailOtp: (params: SignInWithEmailOtpParams) => Promise<void>;
  verifyEmailOtp: (params: VerifyEmailOtpParams) => Promise<{ user: User | null; session: Session | null }>;
  resendEmailOtp: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: { realName?: string; avatarUrl?: string }) => Promise<Profile>;
  refreshProfile: () => Promise<Profile | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch or initialize profile for the authenticated user
  const fetchProfile = useCallback(async (authUser: User): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, real_name, avatar_url, created_at, updated_at")
        .eq("id", authUser.id)
        .maybeSingle();

      if (data && data.real_name) {
        setProfile(data);
        return data;
      }

      // If no profile or real_name is missing, initialize from metadata
      const metaName =
        authUser.user_metadata?.real_name ||
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        authUser.email?.split("@")[0] ||
        "Veil Member";

      const metaAvatar =
        authUser.user_metadata?.avatar_url ||
        authUser.user_metadata?.picture ||
        null;

      const newProfile: Profile = {
        id: authUser.id,
        real_name: metaName,
        avatar_url: metaAvatar,
      };

      const { data: upsertedData } = await supabase
        .from("profiles")
        .upsert(newProfile, { onConflict: "id" })
        .select()
        .maybeSingle();

      const resolved = upsertedData || newProfile;
      setProfile(resolved);
      return resolved;
    } catch {
      // Fallback in-memory profile if DB query errors
      const fallback: Profile = {
        id: authUser.id,
        real_name:
          authUser.user_metadata?.real_name ||
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name ||
          "Veil Member",
        avatar_url: authUser.user_metadata?.avatar_url || null,
      };
      setProfile(fallback);
      return fallback;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return null;
    }
    return fetchProfile(user);
  }, [user, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    // 1. Initial Session check
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!mounted) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        fetchProfile(initialSession.user).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    // 2. Listen to Auth State Changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession: Session | null) => {
        if (!mounted) return;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          await fetchProfile(currentSession.user);
        } else {
          setProfile(null);
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Passwordless Email OTP / Magic Link sign in
  const signInWithEmailOtp = async ({ email, redirectTo }: SignInWithEmailOtpParams) => {
    const origin =
      typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || "https://chat-room-tan-gamma.vercel.app";

    const callbackUrl = new URL("/auth/callback", origin);
    if (redirectTo) {
      callbackUrl.searchParams.set("next", redirectTo);
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: callbackUrl.toString(),
      },
    });

    if (error) throw error;
  };

  // Verify 6-digit OTP code sent to email
  const verifyEmailOtp = async ({ email, token }: VerifyEmailOtpParams) => {
    const cleanToken = token.trim();
    const cleanEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: "email",
    });

    if (error) throw error;

    if (data.session) {
      setSession(data.session);
      setUser(data.user);
      if (data.user) {
        await fetchProfile(data.user);
      }
    }

    return { user: data.user, session: data.session };
  };

  // Resend OTP code to email
  const resendEmailOtp = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: cleanEmail,
    });

    if (error) {
      // Fallback to signInWithOtp if resend signup fails
      await signInWithEmailOtp({ email: cleanEmail });
    }
  };

  // Sign out
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  // Update profile
  const updateProfile = async (updates: { realName?: string; avatarUrl?: string }) => {
    if (!user) throw new Error("User not authenticated.");

    const payload: Partial<Profile> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.realName !== undefined) payload.real_name = updates.realName.trim();
    if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;

    const { data, error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, ...payload })
      .select()
      .single();

    if (error) throw error;

    setProfile(data);
    return data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signInWithEmailOtp,
        verifyEmailOtp,
        resendEmailOtp,
        signOut,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}

    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
