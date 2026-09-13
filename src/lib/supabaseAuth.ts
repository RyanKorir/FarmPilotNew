/**
 * Auth helpers that mirror the Firebase auth surface used across FarmPilot.
 * Components import from here (via the firebase.ts re-export shim) and stay
 * completely unchanged.
 */

import { supabase } from './supabaseClient';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';

export interface SupabaseUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
  tenantId: null;
  providerData: {
    providerId: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
  }[];
  _raw: User;
}

function mapUser(user: User | null): SupabaseUser | null {
  if (!user) return null;
  return {
    uid: user.id,
    email: user.email ?? null,
    emailVerified: !!user.email_confirmed_at,
    displayName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    photoURL: user.user_metadata?.avatar_url ?? null,
    isAnonymous: false,
    tenantId: null,
    providerData: (user.identities ?? []).map((id) => ({
      providerId: id.provider,
      displayName: id.identity_data?.full_name ?? null,
      email: id.identity_data?.email ?? null,
      photoURL: id.identity_data?.avatar_url ?? null,
    })),
    _raw: user,
  };
}

export const auth = {
  get currentUser(): SupabaseUser | null {
    return _cachedUser;
  },
  onAuthStateChanged(callback: (user: SupabaseUser | null) => void): () => void {
    supabase.auth.getSession().then(({ data }) => {
      const mapped = mapUser(data.session?.user ?? null);
      _cachedUser = mapped;
      callback(mapped);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        const mapped = mapUser(session?.user ?? null);
        _cachedUser = mapped;
        callback(mapped);

        // Clean token hash from URL after OAuth redirect
        if (event === 'SIGNED_IN' && window.location.hash.includes('access_token')) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    );

    return () => subscription.unsubscribe();
  },
};

let _cachedUser: SupabaseUser | null = null;

supabase.auth.getSession().then(({ data }) => {
  _cachedUser = mapUser(data.session?.user ?? null);
});

supabase.auth.onAuthStateChange((_event, session) => {
  _cachedUser = mapUser(session?.user ?? null);
});

/** Google OAuth – PKCE flow, no token in URL hash */
export async function signIn(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) throw error;
}

/** Email + password sign-in */
export async function signInWithEmailAndPassword(
  _auth: unknown,
  email: string,
  password: string
): Promise<{ user: SupabaseUser }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const user = mapUser(data.user);
  if (!user) throw new Error('Sign-in failed: no user returned');
  return { user };
}

/** Email + password sign-up */
export async function createUserWithEmailAndPassword(
  _auth: unknown,
  email: string,
  password: string
): Promise<{ user: SupabaseUser }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/` },
  });
  if (error) throw error;
  const user = mapUser(data.user);
  if (!user) throw new Error('Sign-up failed: no user returned');
  return { user };
}

/** Send password reset email */
export async function sendPasswordResetEmail(
  _auth: unknown,
  email: string
): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/`,
  });
  if (error) throw error;
}

/** Update password for the currently signed-in user */
export async function updatePassword(
  _user: unknown,
  newPassword: string
): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** Sign out */
export async function logOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Mirror Firebase's onAuthStateChanged at module level */
export function onAuthStateChanged(
  _auth: unknown,
  callback: (user: SupabaseUser | null) => void
): () => void {
  return auth.onAuthStateChanged(callback);
}

export type User = SupabaseUser;
