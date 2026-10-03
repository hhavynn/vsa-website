import { createContext, useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "react-query";
import { Session, User, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
  /**
   * True when the session ended without the user asking for it: the refresh
   * token expired or was revoked, or they signed out in another tab. A
   * deliberate sign-out never sets it. The admin shell uses it to ask for
   * re-authentication in place rather than redirecting away from unsaved work.
   */
  sessionExpired: boolean;
  /**
   * Settles an expired session once whoever signed back in has been verified as
   * an admin: the same account revalidates its queries in place, another
   * account starts from an empty cache. Until this is called the session stays
   * "expired", so a rejected sign-in attempt leaves the prompt (and the page it
   * is holding) where it was.
   */
  resolveExpiredSession: (userId: string) => void;
  /**
   * Gives up on an expired session: forgets it and drops its cached data. The
   * user chose to leave rather than sign back in.
   */
  discardExpiredSession: () => void;
};

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

/**
 * Owns the Supabase session and everything derived from who is signed in.
 *
 * What happens to the react-query cache (must be rendered inside a
 * QueryClientProvider):
 * - Deliberate sign-out, or a different account signing in: the whole cache is
 *   emptied, so no cached admin status or admin-only rows outlive the account
 *   that fetched them.
 * - Unprompted session loss (expiry, refresh rejected, signed out in another
 *   tab): queries nothing is displaying are dropped, but those still mounted
 *   are kept. Their rows are already on screen in the admin page that the
 *   admin shell is holding open for re-authentication, and emptying them would
 *   blank that page and strand its later invalidations. The session stays
 *   "expired" until `resolveExpiredSession` (a verified admin signed back in:
 *   the same account revalidates everything, another starts clean) or
 *   `discardExpiredSession` (the user left); a sign-in that is turned away
 *   leaves it expired.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  // The account currently held, readable from the long-lived auth listener.
  const userIdRef = useRef<string | null>(null);
  // The account whose session ended unprompted, while we wait for a decision.
  const expiredUserIdRef = useRef<string | null>(null);
  // Set while signOut() is running so its SIGNED_OUT is not mistaken for expiry.
  const signingOutRef = useRef(false);

  const adoptSession = useCallback(
    (next: Session) => {
      const nextId = next.user.id;
      // While an expiry is pending, who may keep the held page's cache is
      // decided by resolveExpiredSession, after the new sign-in is verified.
      if (
        expiredUserIdRef.current === null &&
        userIdRef.current !== null &&
        userIdRef.current !== nextId
      ) {
        queryClient.clear();
      }
      userIdRef.current = nextId;
      setSession(next);
      setUser(next.user);
    },
    [queryClient]
  );

  const endSession = useCallback(
    (unprompted: boolean) => {
      const previousId = userIdRef.current;
      userIdRef.current = null;
      setSession(null);
      setUser(null);

      if (unprompted) {
        if (previousId !== null && expiredUserIdRef.current === null) {
          expiredUserIdRef.current = previousId;
          setSessionExpired(true);
          queryClient.removeQueries({ inactive: true });
          // Even though the admin shell still observes it: whoever signs back
          // in is verified afresh rather than trusting a verdict from before.
          queryClient.removeQueries(['admin-status']);
        }
        return;
      }

      if (expiredUserIdRef.current !== null) {
        // An account that signed in at the expiry prompt was turned away. Back
        // to waiting for a verified sign-in; the held page is untouched.
        queryClient.removeQueries(['admin-status']);
        return;
      }
      expiredUserIdRef.current = null;
      setSessionExpired(false);
      queryClient.clear();
    },
    [queryClient]
  );

  const resolveExpiredSession = useCallback(
    (userId: string) => {
      const expiredId = expiredUserIdRef.current;
      if (expiredId === null) return;
      expiredUserIdRef.current = null;
      setSessionExpired(false);
      if (expiredId === userId) {
        void queryClient.invalidateQueries();
      } else {
        queryClient.clear();
      }
    },
    [queryClient]
  );

  const discardExpiredSession = useCallback(() => {
    expiredUserIdRef.current = null;
    setSessionExpired(false);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (mounted) {
          if (session) adoptSession(session);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error getting initial session:", error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (mounted) {
          if (event === "SIGNED_OUT") {
            endSession(!signingOutRef.current);
          } else if (session) {
            adoptSession(session);
          }
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [adoptSession, endSession]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (!data.user) throw new Error("No user returned from sign in");
    if (data.session) adoptSession(data.session);
    return data.user;
  };

  const signOut = async () => {
    signingOutRef.current = true;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      // Clear local state regardless of the server response: a failed request
      // must not leave an admin looking signed in.
      endSession(false);
      signingOutRef.current = false;
    }
  };

  const value = {
    user,
    session,
    signIn,
    signOut,
    sessionExpired,
    resolveExpiredSession,
    discardExpiredSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
