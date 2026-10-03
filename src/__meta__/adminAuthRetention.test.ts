import * as fs from "fs";
import * as path from "path";

const srcRoot = path.resolve(__dirname, "..");
const read = (relative: string) =>
  fs.readFileSync(path.join(srcRoot, relative), "utf8");

// Member accounts are retired; admin accounts are not. The admin lifecycle
// (login, the admin-status lookup behind `useAdmin`, the route gate, sign-out)
// must survive, but no member profile/account API may come back with it. This
// matters most when a rebase merges a branch that still carries the old, wide
// `AuthRepository`: this guard turns that into a failing test instead of a
// silent regression.
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

describe("admin accounts survive member-account retirement", () => {
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

  it("keeps /admin/login routed and every admin route behind the admin gate", () => {
    const routes = read("routes/index.tsx");
    expect(routes).toMatch(/path="\/admin\/login"\s+element=\{<SignIn \/>\}/);
    expect(routes).toMatch(/<Route element=\{<AdminRoute \/>\}>/);
    expect(routes).toMatch(/path="\/signin"[\s\S]*?\/admin\/login/);
  });

  it("keeps the admin-status hook and a sign-in/sign-out session API", () => {
    expect(read("hooks/useAdmin.ts")).toMatch(/export function useAdmin\b/);
    const context = read("context/AuthContext.tsx");
    expect(context).toMatch(/signIn: \(email: string, password: string\)/);
    expect(context).toMatch(/signOut: \(\) => Promise<void>/);
    expect(context).not.toMatch(/signUp/);
  });

  it("if an auth repository exists it is the narrow admin-status one", () => {
    const repository = path.join(srcRoot, "data/repos/auth.ts");
    if (!fs.existsSync(repository)) return;
    const source = fs.readFileSync(repository, "utf8");
    expect(source).toMatch(/async isUserAdmin\(userId: string\)/);
    expect(source).not.toMatch(MEMBER_ACCOUNT_API);
  });
});
