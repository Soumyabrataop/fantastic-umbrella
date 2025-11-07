"use client";

import { useState, useEffect, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase, hasSupabaseCredentials } from "@/lib/supabase";
import { setApiAccessToken } from "@/utils/api";
import { useRouter } from "next/navigation";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Skip auth setup if credentials are not configured
    if (!hasSupabaseCredentials) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setApiAccessToken(session?.access_token ?? undefined);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setApiAccessToken(session?.access_token ?? undefined);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setApiAccessToken(undefined);
      router.push("/auth");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  }, [router]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, name?: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || "",
          },
        },
      });
      return { data, error };
    },
    []
  );

  const signInWithGoogle = useCallback(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    return { data, error };
  }, []);

  return {
    user,
    session,
    loading,
    hasCredentials: hasSupabaseCredentials,
    signOut,
    signIn,
    signUp,
    signInWithGoogle,
  };
}
