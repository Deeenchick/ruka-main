import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@/lib/types";
 
/**
 * Spec §14: "Admin creates users (login + name), system generates password once."
 * There's no self-signup. We use Supabase Auth's email/password grant, mapping the
 * app's `login` to `<login>@<project>.local` so we can still rely on Supabase Auth
 * for sessions/JWT instead of hand-rolling password checks in the client.
 * Adjust LOGIN_DOMAIN to your actual project ref, or swap in a custom email field
 * on `users` if you'd rather keep real emails out of it entirely.
 */
const LOGIN_DOMAIN = "players.local";
 
function loginToEmail(login: string) {
  return `${login}@${LOGIN_DOMAIN}`;
}
 
export function useAuth() {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Guards against a stale async response overwriting state after a newer
  // one already landed (e.g. sign-out fired while a profile fetch was in
  // flight) — without this, slow/out-of-order network responses (common on
  // mobile) can flash the wrong auth state.
  const requestId = useRef(0);
 
  const loadProfile = useCallback(async (authUserId: string) => {
    const id = ++requestId.current;
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUserId)
      .single();
    if (id !== requestId.current) return; // a newer request/logout superseded this one
    setProfile(error ? null : data);
    setLoading(false);
  }, []);
 
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        // IMPORTANT: loading only clears once the profile fetch resolves,
        // not as soon as the session check does. Clearing it early leaves a
        // window where "session exists" but "profile is null" — which reads
        // as logged-out to RequireAuth and bounces back to /login. That
        // window is what caused both the "have to log in twice" bug and the
        // "refresh kicks me to /login" bug.
        loadProfile(data.session.user.id);
      } else {
        setLoading(false);
      }
    });
 
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setLoading(true);
        loadProfile(session.user.id);
      } else {
        requestId.current++; // invalidate any in-flight profile fetch
        setProfile(null);
        setLoading(false);
      }
    });
 
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);
 
  const signIn = useCallback(async (login: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: loginToEmail(login),
      password,
    });
    if (error) throw error;
    // Deliberately not setting profile/loading here — onAuthStateChange
    // above fires right after this resolves and handles it, so there's a
    // single source of truth instead of two code paths racing each other.
  }, []);
 
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  /** Re-fetches the current user's row (e.g. after changing their own name
   * on the Profile page) so the UI reflects it without a full reload. */
  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) await loadProfile(data.session.user.id);
  }, [loadProfile]);

  return { profile, loading, signIn, signOut, isAdmin: profile?.is_admin ?? false, refreshProfile };
}