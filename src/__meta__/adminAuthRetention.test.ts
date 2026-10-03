import * as fs from "fs";
import * as path from "path";

const srcRoot = path.resolve(__dirname, "..");
const exists = (relative: string) =>
  fs.existsSync(path.join(srcRoot, relative));
const read = (relative: string) =>
  fs.readFileSync(path.join(srcRoot, relative), "utf8");

// Member accounts are retired; admin accounts are not. Retirement removes the
// member signup/profile/password surface, but it must leave the admin
// authentication architecture exactly as it was merged (#507): one shared,
// per-user admin-status query behind a narrow repository, a session lifecycle
// that distinguishes expiry from sign-out, and a re-authentication prompt that
// holds the admin page (and its unsaved work) instead of redirecting away.
//
// These checks read the active source rather than running it, so they fail for
// an older, simpler AuthContext/useAdmin even though that older code still
// compiles and still "signs in". Behaviour itself is proven by the lifecycle
// suites listed at the bottom; the guard keeps those suites from being deleted.
const MEMBER_ACCOUNT_API =
  /\b(signUp|SignUpFormData|UserProfileFormData|getUserProfile|updateUserProfile|resetPassword|updatePassword)\b/;

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return ["__meta__", "test-utils"].includes(entry.name)
        ? []
        : sourceFiles(file);
    }
    return /\.(ts|tsx)$/.test(entry.name) &&
      !/\.test\.tsx?$/.test(entry.name) &&
      entry.name !== "setupTests.ts"
      ? [file]
      : [];
  });
}

describe("retirement removes member accounts, not the admin lifecycle", () => {
  it("exposes no member profile or account API anywhere in application code", () => {
    const offenders = sourceFiles(srcRoot).flatMap((file) =>
      fs
        .readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, index) =>
          MEMBER_ACCOUNT_API.test(line)
            ? [`${path.relative(srcRoot, file)}:${index + 1}`]
            : [],
        ),
    );
    expect(offenders).toEqual([]);
  });

  describe("admin status: one shared query behind a narrow repository", () => {
    it("keeps authRepository as the admin-status lookup only", () => {
      const source = read("data/repos/auth.ts");
      expect(source).toMatch(/async isUserAdmin\(userId: string\)/);
      expect(source).toMatch(/\.select\('is_admin'\)/);
      // The only public method: no sign-in, profile, or password surface.
      const methods = source.match(/^ {2}(?:async )?[a-zA-Z]+\(/gm) ?? [];
      expect(methods).toHaveLength(1);
      expect(source).not.toMatch(MEMBER_ACCOUNT_API);
    });

    it("keys the shared admin-status query by user id and reads it through the repository", () => {
      const source = read("hooks/useAdmin.ts");
      expect(source).toMatch(/export const adminStatusQuery = \(userId: string\)/);
      expect(source).toMatch(/queryKey: \['admin-status', userId\]/);
      expect(source).toMatch(/authRepository\.isUserAdmin\(userId\)/);
      expect(source).toMatch(/\buseQuery\b/);
      // The pre-#507 hook queried user_profiles itself, per mount.
      expect(source).not.toMatch(/supabase\.from\(/);
      expect(source).not.toMatch(/\buseState\b/);
    });

    it("verifies a fresh sign-in through that same shared query, never a one-off lookup", () => {
      const source = read("components/features/auth/SignInForm.tsx");
      expect(source).toMatch(/import \{ adminStatusQuery \} from '..\/..\/..\/hooks\/useAdmin'/);
      expect(source).toMatch(
        /queryClient\.fetchQuery\(\{ \.\.\.adminStatusQuery\([^)]*\), staleTime: 0 \}\)/,
      );
      expect(source).not.toMatch(/supabase\.from\(/);
      expect(source).not.toMatch(/user_profiles/);
      // A non-admin or unverifiable account is signed straight back out.
      expect(source).toMatch(/await signOut\(\)/);
    });
  });

  describe("session lifecycle: expiry is not sign-out", () => {
    const context = () => read("context/AuthContext.tsx");

    it("tracks unprompted session expiry separately from deliberate sign-out", () => {
      const source = context();
      expect(source).toMatch(/sessionExpired: boolean/);
      expect(source).toMatch(/const \[sessionExpired, setSessionExpired\]/);
      expect(source).toMatch(/signingOutRef/);
      expect(source).toMatch(/endSession\(!signingOutRef\.current\)/);
    });

    it("offers resolve/discard of an expired session on the context", () => {
      const source = context();
      expect(source).toMatch(/resolveExpiredSession: \(userId: string\) => void/);
      expect(source).toMatch(/discardExpiredSession: \(\) => void/);
      expect(source).toMatch(/const resolveExpiredSession = useCallback/);
      expect(source).toMatch(/const discardExpiredSession = useCallback/);
    });

    it("clears or invalidates the query cache at every account and session boundary", () => {
      const source = context();
      expect(source).toMatch(/useQueryClient\(\)/);
      // Deliberate sign-out and a different account: nothing outlives the user.
      expect(source).toMatch(/queryClient\.clear\(\)/);
      // Expiry: stale admin verdicts are dropped, mounted queries are kept.
      expect(source).toMatch(/queryClient\.removeQueries\(\{ inactive: true \}\)/);
      expect(source).toMatch(/queryClient\.removeQueries\(\['admin-status'\]\)/);
      // Same account signing back in revalidates in place.
      expect(source).toMatch(/queryClient\.invalidateQueries\(\)/);
    });

    it("keeps no member signup on the session API", () => {
      const source = context();
      expect(source).toMatch(/signIn: \(email: string, password: string\)/);
      expect(source).toMatch(/signOut: \(\) => Promise<void>/);
      expect(source).not.toMatch(/signUp/);
    });

    it("keeps the request-level expiry detection wired into the Supabase client", () => {
      expect(read("lib/supabase.ts")).toMatch(
        /createSessionExpiryFetch[\s\S]*refreshOrEndSession/,
      );
      expect(read("lib/sessionExpiry.ts")).toMatch(
        /export function createSessionExpiryFetch/,
      );
    });
  });

  describe("admin route: re-authenticate in place", () => {
    const route = () => read("routes/AdminRoute.tsx");

    it("holds the admin page behind a SessionExpiredDialog instead of redirecting", () => {
      const source = route();
      expect(source).toMatch(/import \{ SessionExpiredDialog \}/);
      expect(source).toMatch(/const promptOpen = sessionExpired && held !== null/);
      expect(source).toMatch(/<SessionExpiredDialog/);
      // The held page is made unreachable while the prompt is up.
      expect(source).toMatch(/INERT_PROPS/);
    });

    it("resolves the expired session once a verified admin signs back in, and discards on leave", () => {
      const source = route();
      expect(source).toMatch(/resolveExpiredSession\(user\.id\)/);
      expect(source).toMatch(/discardExpiredSession\(\)/);
      expect(source).toMatch(/useAdmin\(\)/);
    });

    it("renders the re-authentication prompt through the same SignInForm", () => {
      expect(read("components/features/auth/SessionExpiredDialog.tsx")).toMatch(
        /<SignInForm/,
      );
    });

    it("keeps /admin/login routed and every admin route behind the admin gate", () => {
      const routes = read("routes/index.tsx");
      expect(routes).toMatch(/path="\/admin\/login"\s+element=\{<SignIn \/>\}/);
      expect(routes).toMatch(/<Route element=\{<AdminRoute \/>\}>/);
      expect(routes).toMatch(/path="\/signin"[\s\S]*?\/admin\/login/);
    });
  });

  it("keeps the lifecycle suites that prove all of the above", () => {
    const suites: Record<string, RegExp> = {
      "context/AuthContext.test.tsx": /sessionExpired/,
      "hooks/useAdmin.test.tsx": /never leaking one account/,
      "data/repos/auth.test.ts": /isUserAdmin/,
      "routes/AdminRoute.test.tsx": /SessionExpired|session/i,
      "lib/sessionExpiry.test.ts": /createSessionExpiryFetch/,
      "components/features/auth/SignInForm.flow.test.tsx": /admin-status/,
    };
    for (const [file, marker] of Object.entries(suites)) {
      expect({ file, present: exists(file) }).toEqual({ file, present: true });
      expect(read(file)).toMatch(marker);
    }
  });
});
