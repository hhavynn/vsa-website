// Identity resolution in the attendance import UI, through the atomic import
// function. Synthetic members only; no network.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import toast from "react-hot-toast";
import { QueryClient, QueryClientProvider } from "react-query";
import AdminImport from "./Import";
import { supabaseMock } from "../../test-utils/supabaseMock";
import type { AttendanceImportRequest } from "../../lib/attendanceImportDecisions";

// These cover the identity importer behind the rollout flag (LegacyImport.*.test.tsx covers the default).
beforeAll(() => { process.env.REACT_APP_ATTENDANCE_IDENTITY_V2 = 'true'; });
afterAll(() => { delete process.env.REACT_APP_ATTENDANCE_IDENTITY_V2; });

jest.mock("../../lib/supabase", () => ({
  get supabase() {
    return require("../../test-utils/supabaseMock").supabaseMock.client;
  },
}));
jest.mock("../../components/features/admin/ImportAuditPanel", () => ({
  ImportAuditPanel: () => null,
}));
jest.mock("../../components/features/admin/HistoricalRecoveryPanel", () => ({
  HistoricalRecoveryPanel: () => null,
}));
const mockAudit = jest.fn().mockResolvedValue(undefined);
jest.mock("../../data/repos/importJobs", () => ({
  ...jest.requireActual("../../data/repos/importJobs"),
  importJobsRepository: {
    createJob: (...args: unknown[]) => mockAudit(...args),
  },
}));

const RPC = "rpc:admin_apply_attendance_import";
const lan = {
  id: "lan",
  first_name: "Lan",
  last_name: "Tran",
  email: "lan@ucsd.edu",
  year: "2nd Year",
  college: "Muir",
  points: 4,
  events_attended: 2,
  created_at: "2025-01-01T00:00:00Z",
};
const alex = { ...lan, id: "alex", first_name: "Alex", last_name: "Nguyen", email: "alex@gmail.com", points: 9 };
const HEADER = "Name (First & Last),School Email?,What year are you?,College";

const ok = (extra: Record<string, unknown> = {}) => ({
  data: {
    ok: true, request_id: "r", created: [], attendance_inserted: 1, attendance_already_present: [],
    profile_fills: 0, years_advanced: 0, years_skipped: [], aliases_added: 0, observations_added: 0, ...extra,
  },
  error: null,
});

beforeEach(() => {
  supabaseMock.reset();
  mockAudit.mockClear();
  toast.remove();
  supabaseMock.setDefault("events", {
    data: [{ id: "gbm", name: "GBM 1", points: 3, date: "2026-09-30", academic_term_id: "fall" }],
    error: null,
  });
  supabaseMock.setDefault("academic_terms", {
    data: [{ id: "fall", label: "Fall 2026", academic_year_start: 2026, academic_year_end: 2027 }],
    error: null,
  });
  supabaseMock.setDefault("members", { data: [lan], error: null });
  supabaseMock.setDefault(RPC, ok());
});

async function preview(rows: string[]) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AdminImport />
    </QueryClientProvider>,
  );
  await screen.findByRole("option", { name: /GBM 1/ });
  fireEvent.change(screen.getByLabelText("Event *"), { target: { value: "gbm" } });
  fireEvent.click(screen.getByLabelText("Local CSV file"));
  fireEvent.change(screen.getByLabelText("CSV file"), {
    target: { files: [new File([[HEADER, ...rows].join("\n")], "attendance.csv", { type: "text/csv" })] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load & Preview" }));
  await screen.findByLabelText("Import summary");
}

const statItem = (label: string) => {
  const item = screen.getAllByTestId("summary-stat").find((el) => within(el).queryByText(label));
  if (!item) throw new Error(`No summary stat labelled "${label}"`);
  return item;
};
const stat = (label: string) => within(statItem(label)).getByRole("definition").textContent;
const requests = () =>
  supabaseMock.queriesFor(RPC).map((q) => (q.calls[0].args[0] as { p_request: AttendanceImportRequest }).p_request);
const directMemberWrites = () =>
  supabaseMock.queriesFor("members").flatMap((q) => q.calls).filter((c) => ["insert", "update", "upsert", "delete"].includes(c.method));
const directAttendanceWrites = () =>
  supabaseMock.queriesFor("member_event_attendance").flatMap((q) => q.calls).filter((c) => ["insert", "update", "upsert", "delete"].includes(c.method));

async function confirm(label: RegExp) {
  fireEvent.click(screen.getByRole("button", { name: label }));
  await screen.findByText("Import complete!");
}

describe("a suggested member who is actually someone else", () => {
  // Same name, different email and college: the matcher must not decide this on its own.
  const row = "Lan Tran,lan.tran.two@gmail.com,1,Revelle";

  it("waits for a decision, explains why, and offers all three actions", async () => {
    await preview([row]);
    expect(stat("Unresolved identity matches")).toBe("1");
    expect(screen.getByText("Needs review: possible identity conflict")).toBeInTheDocument();
    expect(screen.getByText(/Different college on file \(Muir\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Match existing member Lan Tran/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create new member for Lan Tran/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Skip Lan Tran/ })).toBeInTheDocument();
    expect(screen.getByText(/lan@ucsd.edu/)).toBeInTheDocument();
    expect(screen.getByText(/4 pts/)).toBeInTheDocument();
  });

  it("creates a separate member in one atomic request, leaving the suggested member untouched", async () => {
    await preview([row]);
    fireEvent.click(screen.getByRole("button", { name: /Create new member for Lan Tran/ }));
    expect(stat("New members being created")).toBe("1");
    supabaseMock.queueResult(RPC, ok({ created: [{ row_key: "row-0", member_id: "lan-two" }] }));
    await confirm(/Import \(0 updates \+ 1 new\)/);

    const [request] = requests();
    expect(request.credits).toEqual([]);
    expect(request.creates).toEqual([
      { row_key: "row-0", first_name: "Lan", last_name: "Tran", college: "Revelle", year: "1st Year", email: "lan.tran.two@gmail.com", observed_year: "1st Year", known_same_name_ids: ["lan"] },
    ]);
    expect(request).toMatchObject({ event_id: "gbm", expected_points: 3, expected_term_id: "fall" });
    expect(directMemberWrites()).toEqual([]);
    expect(directAttendanceWrites()).toEqual([]);
  });

  it("can be undone before confirming", async () => {
    await preview([row]);
    fireEvent.click(screen.getByRole("button", { name: /Create new member for Lan Tran/ }));
    fireEvent.click(screen.getByRole("button", { name: /Undo decision for Lan Tran/ }));
    expect(stat("Unresolved identity matches")).toBe("1");
    expect(stat("New members being created")).toBe("0");
  });

  it("credits the member only after an explicit Match Existing, remembering the email unless told not to", async () => {
    await preview([row]);
    fireEvent.click(screen.getByRole("button", { name: /Match existing member Lan Tran/ }));
    expect(stat("Matched by you")).toBe("1");
    expect(stat("Email aliases to be added")).toBe("1");
    fireEvent.click(screen.getByRole("checkbox", { name: /Remember lan.tran.two@gmail.com/ }));
    expect(stat("Email aliases to be added")).toBe("0");
    await confirm(/Import \(1 update \+ 0 new\)/);
    const [request] = requests();
    expect(request.credits).toEqual([
      expect.objectContaining({ row_key: "row-0", member_id: "lan", expected: { first_name: "Lan", last_name: "Tran", college: "Muir", email: "lan@ucsd.edu" } }),
    ]);
    expect(request.credits[0].aliases).toBeUndefined();
    // An admin's match never fills the CSV's college or email onto the member.
    expect(request.credits[0].fill).toBeUndefined();
  });
});

describe("Gmail at one event, UCSD at the next", () => {
  it("matches by name + college + year, keeps the member id, remembers the address and advances the year", async () => {
    supabaseMock.setDefault("members", { data: [alex], error: null });
    await preview(["Alex Nguyen,alex@ucsd.edu,3rd,Muir"]);
    expect(screen.getByText("Matched by name + college + year")).toBeInTheDocument();
    expect(stat("Matched automatically")).toBe("1");
    expect(stat("Email aliases to be added")).toBe("1");
    expect(stat("Profiles whose year will advance")).toBe("1");
    await confirm(/Import \(1 update \+ 0 new\)/);
    expect(requests()[0].credits).toEqual([{
      row_key: "row-0",
      member_id: "alex",
      expected: { first_name: "Alex", last_name: "Nguyen", college: "Muir", email: "alex@gmail.com" },
      year: { from: "2nd Year", to: "3rd Year" },
      aliases: [{ email: "alex@ucsd.edu", method: "unique_name_college_year" }],
      observed_year: "3rd Year",
      known_same_name_ids: ["alex"],
      expected_standing: { year: "2nd Year", observations: 0 },
      source_name: "Alex Nguyen",
    }]);
    expect(requests()[0].creates).toEqual([]);
  });

  it("recognizes a confirmed alias as a known email", async () => {
    supabaseMock.setDefault("members", { data: [alex], error: null });
    supabaseMock.setDefault("member_identity_emails", { data: [{ id: "e1", member_id: "alex", email: "alex@ucsd.edu" }], error: null });
    await preview(["Alex Nguyen,alex@ucsd.edu,,"]);
    expect(screen.getByText("Matched by known email")).toBeInTheDocument();
  });

  it("credits one member once when they sign in twice with both addresses", async () => {
    supabaseMock.setDefault("members", { data: [alex], error: null });
    await preview(["Alex Nguyen,alex@gmail.com,3rd,Muir", "Alex Nguyen,alex@ucsd.edu,3rd,Muir"]);
    expect(stat("Existing members receiving attendance")).toBe("1");
    expect(stat("Duplicate rows skipped")).toBe("1");
    await confirm(/Import \(1 update \+ 0 new\)/);
    expect(requests()[0].credits).toHaveLength(1);
    expect(requests()[0].credits[0].aliases).toEqual([{ email: "alex@ucsd.edu", method: "unique_name_college_year" }]);
  });
});

describe("an email that already belongs to another member", () => {
  it("creates the new member without that email instead of duplicating it", async () => {
    await preview(["Bao Pham,lan@ucsd.edu,2,Warren"]);
    expect(screen.getByText("Needs review: email belongs to someone else")).toBeInTheDocument();
    expect(screen.getByText(/already belongs to Lan Tran/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Create new member for Bao Pham/ }));
    expect(stat("New members without their email")).toBe("1");
    supabaseMock.queueResult(RPC, ok({ created: [{ row_key: "row-0", member_id: "bao" }] }));
    await confirm(/Import \(0 updates \+ 1 new\)/);
    expect(requests()[0].creates[0].email).toBeNull();
    expect(stat("New members without email")).toBe("1");
  });
});

describe("unresolved rows", () => {
  const rows = ["Minh Vo,minh@ucsd.edu,1,Muir", "Lan Tran,other@gmail.com,1,Revelle"];

  it("blocks the import until the admin acknowledges the partial import", async () => {
    await preview(rows);
    const importButton = screen.getByRole("button", { name: /Import \(0 updates \+ 1 new\)/ });
    expect(importButton).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /I understand 1 unresolved row will not be imported/ }));
    expect(importButton).toBeEnabled();

    supabaseMock.queueResult(RPC, ok({ created: [{ row_key: "row-0", member_id: "minh" }] }));
    await confirm(/Import \(0 updates \+ 1 new\)/);

    // Only the resolved row was sent; the unresolved one became neither a match nor a member.
    expect(requests()[0].creates.map((c) => c.first_name)).toEqual(["Minh"]);
    expect(requests()[0].credits).toEqual([]);
    expect(stat("Unresolved, not imported")).toBe("1");

    await waitFor(() => expect(mockAudit).toHaveBeenCalled());
    const audited = mockAudit.mock.calls[0][0];
    const lanRow = audited.rows.find((r: { display_name: string }) => r.display_name === "Lan Tran");
    expect(lanRow).toMatchObject({ decision: "review", attendance_member_id: null, created_member_id: null, matched_member_id: null });
    expect(lanRow.match_details).toMatchObject({ final_reason: "skipped_unresolved_review", suggested_member_id: "lan" });
    const minhRow = audited.rows.find((r: { display_name: string }) => r.display_name === "Minh Vo");
    expect(minhRow).toMatchObject({ decision: "created", created_member_id: "minh", attendance_member_id: "minh", points_earned: 3 });
    expect(audited.review_rows).toBe(1);
  });

  it("needs no acknowledgment once the row is explicitly skipped, and records the skip", async () => {
    await preview(rows);
    fireEvent.click(screen.getByRole("button", { name: /Skip Lan Tran/ }));
    expect(stat("Skipped by you")).toBe("1");
    expect(stat("Unresolved identity matches")).toBe("0");
    expect(screen.queryByRole("checkbox", { name: /I understand/ })).not.toBeInTheDocument();
    supabaseMock.queueResult(RPC, ok({ created: [{ row_key: "row-0", member_id: "minh" }] }));
    await confirm(/Import \(0 updates \+ 1 new\)/);
    await waitFor(() => expect(mockAudit).toHaveBeenCalled());
    const lanRow = mockAudit.mock.calls[0][0].rows.find((r: { display_name: string }) => r.display_name === "Lan Tran");
    expect(lanRow.match_details).toMatchObject({ final_reason: "skipped_by_admin", manual_decision: { kind: "skip" } });
  });
});

describe("reimporting", () => {
  it("shows existing attendance as already recorded and offers nothing to write", async () => {
    supabaseMock.queueResult("member_event_attendance", { data: [{ id: "a1", member_id: "lan" }], error: null });
    await preview(["Lan Tran,lan@ucsd.edu,2,Muir"]);
    expect(stat("Already recorded")).toBe("1");
    expect(screen.getByText("Already attended")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Import \(0 updates \+ 0 new\)/ })).toBeDisabled();
    expect(requests()).toEqual([]);
  });
});

describe("a preview that went stale", () => {
  it("writes nothing, says why, and requires re-running matching", async () => {
    await preview(["Lan Tran,lan@ucsd.edu,2,Muir"]);
    supabaseMock.queueResult(RPC, { data: { ok: false, problems: [{ kind: "member_changed", row_key: "row-0" }] }, error: null });
    fireEvent.click(screen.getByRole("button", { name: /Import \(1 update \+ 0 new\)/ }));
    expect(await screen.findByText(/Nothing was imported. The data changed after this preview/)).toBeInTheDocument();
    expect(screen.getByText(/name, college or email was edited after this preview\. \(Lan Tran\)/)).toBeInTheDocument();
    expect(screen.queryByText("Import complete!")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Import \(1 update \+ 0 new\)/ })).toBeDisabled();
    expect(mockAudit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Re-run matching/ }));
    await screen.findByText(/↻ Re-run matching with these columns/);
    expect(screen.queryByText(/Nothing was imported\. The data changed/)).not.toBeInTheDocument();
    await confirm(/Import \(1 update \+ 0 new\)/);
    const [first, second] = requests();
    // The retry after a refusal is a new request, against freshly read data.
    expect(second.request_id).not.toBe(first.request_id);
  });
});

describe("review findings on the confirmation step", () => {
  it("lets an admin save profile-only updates for a member already credited for the event", async () => {
    supabaseMock.setDefault("members", { data: [alex], error: null });
    supabaseMock.queueResult("member_event_attendance", { data: [{ id: "a1", member_id: "alex" }], error: null });
    await preview(["Alex Nguyen,alex@ucsd.edu,3rd,Muir"]);
    expect(stat("Already recorded")).toBe("1");
    const button = screen.getByRole("button", { name: /Import \(0 updates \+ 0 new \+ 1 profile update\)/ });
    expect(button).toBeEnabled();
    await confirm(/Import \(0 updates \+ 0 new \+ 1 profile update\)/);
    expect(requests()[0].credits[0]).toMatchObject({
      member_id: "alex",
      year: { from: "2nd Year", to: "3rd Year" },
      aliases: [{ email: "alex@ucsd.edu", method: "unique_name_college_year" }],
    });
  });

  it("re-reads the event when matching is re-run, so a changed points value can be confirmed", async () => {
    await preview(["Lan Tran,lan@ucsd.edu,2,Muir"]);
    supabaseMock.queueResult(RPC, { data: { ok: false, problems: [{ kind: "event_changed" }] }, error: null });
    fireEvent.click(screen.getByRole("button", { name: /Import \(1 update \+ 0 new\)/ }));
    await screen.findByText(/points or academic term changed after this preview/);
    supabaseMock.setDefault("events", {
      data: [{ id: "gbm", name: "GBM 1", points: 5, date: "2026-09-30", academic_term_id: "fall" }],
      error: null,
    });
    fireEvent.click(screen.getByRole("button", { name: /Re-run matching/ }));
    // Import stays disabled until the fresh reads finish.
    expect(screen.getByRole("button", { name: /Import \(1 update \+ 0 new\)/ })).toBeDisabled();
    await screen.findByText(/↻ Re-run matching with these columns/);
    await confirm(/Import \(1 update \+ 0 new\)/);
    expect(requests()[1]).toMatchObject({ expected_points: 5, expected_term_id: "fall" });
  });
});

describe("failures and retries", () => {
  it("retries a lost response with the same request id, so the database replays instead of writing twice", async () => {
    await preview(["Minh Vo,minh@ucsd.edu,1,Muir"]);
    supabaseMock.queueResult(RPC, { data: null, error: { message: "network request failed" } });
    fireEvent.click(screen.getByRole("button", { name: /Import \(0 updates \+ 1 new\)/ }));
    expect(await screen.findByText(/Import failed: .*network request failed/)).toBeInTheDocument();
    await waitFor(() => expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", created_members: 0 })));

    supabaseMock.queueResult(RPC, ok({ replayed: true, created: [{ row_key: "row-0", member_id: "minh" }] }));
    await confirm(/Import \(0 updates \+ 1 new\)/);
    const [first, second] = requests();
    expect(second.request_id).toBe(first.request_id);
    expect(second).toEqual(first);
  });

  it("does not claim success when the database refuses the call", async () => {
    await preview(["Minh Vo,minh@ucsd.edu,1,Muir"]);
    supabaseMock.queueResult(RPC, { data: null, error: { message: "Admin access required", code: "42501" } });
    fireEvent.click(screen.getByRole("button", { name: /Import \(0 updates \+ 1 new\)/ }));
    expect(await screen.findByText(/Import failed: Insufficient permissions/)).toBeInTheDocument();
    expect(screen.queryByText("Import complete!")).not.toBeInTheDocument();
  });
});
