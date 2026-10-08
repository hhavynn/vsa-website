// Identity resolution in the attendance import UI. Synthetic members only; no network.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import toast from "react-hot-toast";
import { QueryClient, QueryClientProvider } from "react-query";
import AdminImport from "./Import";
import { supabaseMock } from "../../test-utils/supabaseMock";

jest.mock("../../lib/supabase", () => ({
  get supabase() {
    return require("../../test-utils/supabaseMock").supabaseMock.client;
  },
}));
jest.mock("../../components/features/admin/ImportAuditPanel", () => ({
  ImportAuditPanel: () => null,
}));
const mockAudit = jest.fn().mockResolvedValue(undefined);
jest.mock("../../data/repos/importJobs", () => ({
  ...jest.requireActual("../../data/repos/importJobs"),
  importJobsRepository: {
    createJob: (...args: unknown[]) => mockAudit(...args),
  },
}));

const lan = {
  id: "lan",
  first_name: "Lan",
  last_name: "Tran",
  email: "lan@ucsd.edu",
  year: "2nd Year",
  college: "Muir",
  points: 4,
  events_attended: 2,
};
const HEADER = "Name (First & Last),School Email?,What year are you?,College";

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
  // The import re-reads the chosen event as a single row.
  supabaseMock.setDefault("events", { data: { id: "gbm", points: 3, academic_term_id: "fall" }, error: null });
}

const statItem = (label: string) => {
  const item = screen.getAllByTestId("summary-stat").find((el) => within(el).queryByText(label));
  if (!item) throw new Error(`No summary stat labelled "${label}"`);
  return item;
};
const stat = (label: string) => within(statItem(label)).getByRole("definition").textContent;
const memberInserts = () =>
  supabaseMock.queriesFor("members").flatMap((q) => q.calls).filter((c) => c.method === "insert");
const attendanceUpserts = () =>
  supabaseMock.queriesFor("member_event_attendance").flatMap((q) => q.calls).filter((c) => c.method === "upsert");
const memberUpdates = () =>
  supabaseMock.queriesFor("members").flatMap((q) => q.calls).filter((c) => c.method === "update");

describe("a suggested member who is actually someone else", () => {
  // Same name, different email: the matcher must not decide this on its own.
  const row = "Lan Tran,lan.tran.two@gmail.com,1,Revelle";

  it("waits for a decision and offers all three actions", async () => {
    await preview([row]);
    expect(stat("Unresolved identity matches")).toBe("1");
    expect(screen.getByRole("button", { name: /Match existing member Lan Tran/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create new member for Lan Tran/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Skip Lan Tran/ })).toBeInTheDocument();
    // Enough context to tell the two people apart.
    expect(screen.getByText(/lan@ucsd.edu/)).toBeInTheDocument();
    expect(screen.getByText(/4 pts/)).toBeInTheDocument();
  });

  it("creates a separate member who gets their own attendance, leaving the suggested member untouched", async () => {
    await preview([row]);
    fireEvent.click(screen.getByRole("button", { name: /Create new member for Lan Tran/ }));
    expect(stat("Unresolved identity matches")).toBe("0");
    expect(stat("New members being created")).toBe("1");

    supabaseMock.queueResult("members", { data: [lan], error: null });
    supabaseMock.queueResult("members", { data: [{ id: "lan-two" }], error: null });
    fireEvent.click(screen.getByRole("button", { name: /Import \(0 updates \+ 1 new\)/ }));
    await screen.findByText("Import complete!");

    expect(memberInserts()).toEqual([
      {
        method: "insert",
        args: [[{ first_name: "Lan", last_name: "Tran", college: "Revelle", year: "1st Year", email: "lan.tran.two@gmail.com", needs_review: false }]],
      },
    ]);
    expect(attendanceUpserts()).toHaveLength(1);
    expect(attendanceUpserts()[0].args[0]).toEqual([{ member_id: "lan-two", event_id: "gbm", points_earned: 3 }]);
    expect(JSON.stringify(attendanceUpserts())).not.toContain('"lan"');
    // The suggested member is never written to.
    expect(memberUpdates()).toEqual([]);
  });

  it("can be undone before confirming", async () => {
    await preview([row]);
    fireEvent.click(screen.getByRole("button", { name: /Create new member for Lan Tran/ }));
    fireEvent.click(screen.getByRole("button", { name: /Undo decision for Lan Tran/ }));
    expect(stat("Unresolved identity matches")).toBe("1");
    expect(stat("New members being created")).toBe("0");
  });

  it("credits the suggested member only after an explicit Match Existing", async () => {
    await preview([row]);
    fireEvent.click(screen.getByRole("button", { name: /Match existing member Lan Tran/ }));
    expect(stat("Existing members receiving attendance")).toBe("1");
    supabaseMock.queueResult("members", { data: [lan], error: null });
    fireEvent.click(screen.getByRole("button", { name: /Import \(1 update \+ 0 new\)/ }));
    await screen.findByText("Import complete!");
    expect(attendanceUpserts()[0].args[0]).toEqual([{ member_id: "lan", event_id: "gbm", points_earned: 3 }]);
    expect(memberInserts()).toEqual([]);
    // The CSV's different email is never written onto the matched member.
    expect(JSON.stringify(memberUpdates())).not.toContain("lan.tran.two");
  });
});

describe("an email that already belongs to another member", () => {
  it("creates the new member without that email instead of duplicating it", async () => {
    await preview(["Bao Pham,lan@ucsd.edu,2,Warren"]);
    expect(screen.getByText(/already belongs to Lan Tran/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Create new member for Bao Pham/ }));
    supabaseMock.queueResult("members", { data: [lan], error: null });
    supabaseMock.queueResult("members", { data: [{ id: "bao" }], error: null });
    fireEvent.click(screen.getByRole("button", { name: /Import \(0 updates \+ 1 new\)/ }));
    await screen.findByText("Import complete!");
    const [{ args }] = memberInserts();
    expect((args[0] as Array<{ email: string | null }>)[0].email).toBeNull();
    expect(stat("New members without email")).toBe("1");
  });
});

describe("emails across one import", () => {
  it("never gives a matched member an email a new member in the same import holds", async () => {
    supabaseMock.setDefault("members", { data: [{ ...lan, id: "kim", first_name: "Kim", last_name: "Do", email: null, college: null }], error: null });
    await preview(["Kim Do,shared@ucsd.edu,2,Muir", "Bao Pham,shared@ucsd.edu,2,Warren"]);
    fireEvent.click(screen.getByRole("button", { name: /Create new member for Bao Pham/ }));
    supabaseMock.queueResult("members", { data: [{ ...lan, id: "kim", first_name: "Kim", last_name: "Do", email: null, college: null }], error: null });
    supabaseMock.queueResult("members", { data: [{ id: "bao" }], error: null });
    fireEvent.click(screen.getByRole("button", { name: /Import \(1 update \+ 1 new\)/ }));
    await screen.findByText("Import complete!");
    expect(JSON.stringify(memberUpdates())).not.toContain("shared@ucsd.edu");
    expect(((memberInserts()[0].args[0] as Array<{ email: string | null }>)[0]).email).toBe("shared@ucsd.edu");
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

    supabaseMock.queueResult("members", { data: [lan], error: null });
    supabaseMock.queueResult("members", { data: [{ id: "minh" }], error: null });
    fireEvent.click(importButton);
    await screen.findByText("Import complete!");

    // Only the resolved row was written; the unresolved one became neither a match nor a member.
    const [{ args }] = memberInserts();
    expect(args[0]).toHaveLength(1);
    expect(attendanceUpserts()[0].args[0]).toEqual([{ member_id: "minh", event_id: "gbm", points_earned: 3 }]);
    expect(stat("Unresolved, not imported")).toBe("1");

    // The unresolved row stays identifiable in the audit trail.
    await waitFor(() => expect(mockAudit).toHaveBeenCalled());
    const audited = mockAudit.mock.calls[0][0];
    const lanRow = audited.rows.find((r: { display_name: string }) => r.display_name === "Lan Tran");
    expect(lanRow).toMatchObject({ decision: "review", attendance_member_id: null, created_member_id: null, matched_member_id: null });
    expect(lanRow.match_details).toMatchObject({ final_reason: "skipped_unresolved_review", suggested_member_id: "lan" });
    expect(audited.review_rows).toBe(1);
  });

  it("needs no acknowledgment once the row is explicitly skipped, and records the skip", async () => {
    await preview(rows);
    fireEvent.click(screen.getByRole("button", { name: /Skip Lan Tran/ }));
    expect(stat("Skipped by you")).toBe("1");
    expect(stat("Unresolved identity matches")).toBe("0");
    expect(screen.queryByRole("checkbox", { name: /I understand/ })).not.toBeInTheDocument();

    supabaseMock.queueResult("members", { data: [lan], error: null });
    supabaseMock.queueResult("members", { data: [{ id: "minh" }], error: null });
    fireEvent.click(screen.getByRole("button", { name: /Import \(0 updates \+ 1 new\)/ }));
    await screen.findByText("Import complete!");
    await waitFor(() => expect(mockAudit).toHaveBeenCalled());
    const lanRow = mockAudit.mock.calls[0][0].rows.find((r: { display_name: string }) => r.display_name === "Lan Tran");
    expect(lanRow.match_details).toMatchObject({ final_reason: "skipped_by_admin", manual_decision: { kind: "skip" } });
  });
});

describe("reimporting", () => {
  it("shows existing attendance as already recorded and offers nothing to write", async () => {
    supabaseMock.queueResult("member_event_attendance", { data: [{ member_id: "lan" }], error: null });
    await preview(["Lan Tran,lan@ucsd.edu,2,Muir"]);
    expect(stat("Already recorded")).toBe("1");
    expect(screen.getByRole("button", { name: /Import \(0 updates \+ 0 new\)/ })).toBeDisabled();
    expect(attendanceUpserts()).toEqual([]);
  });
});

describe("failures and retries", () => {
  it("reuses members created by a failed attempt instead of creating them again", async () => {
    await preview(["Minh Vo,minh@ucsd.edu,1,Muir"]);
    const importButton = screen.getByRole("button", { name: /Import \(0 updates \+ 1 new\)/ });

    // Attempt 1: the member is created, then the attendance write fails.
    supabaseMock.queueResult("members", { data: [lan], error: null });
    supabaseMock.queueResult("members", { data: [{ id: "minh" }], error: null });
    supabaseMock.queueResult("member_event_attendance", { data: null, error: { message: "connection reset" } });
    fireEvent.click(importButton);
    expect(await screen.findByText(/Import failed: connection reset/)).toBeInTheDocument();
    expect(memberInserts()).toHaveLength(1);
    expect(screen.queryByText("Import complete!")).not.toBeInTheDocument();
    await waitFor(() => expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", created_members: 1 })));

    // Attempt 2: no second member, attendance goes to the member already created.
    supabaseMock.queueResult("members", { data: [lan, { ...lan, id: "minh", first_name: "Minh", last_name: "Vo", email: "minh@ucsd.edu" }], error: null });
    fireEvent.click(screen.getByRole("button", { name: /Import \(0 updates \+ 1 new\)/ }));
    await screen.findByText("Import complete!");
    expect(memberInserts()).toHaveLength(1);
    const upserts = attendanceUpserts();
    expect(upserts).toHaveLength(2);
    expect(upserts[1].args[0]).toEqual([{ member_id: "minh", event_id: "gbm", points_earned: 3 }]);
  });

  it("does not claim success when nothing could be written", async () => {
    await preview(["Minh Vo,minh@ucsd.edu,1,Muir"]);
    supabaseMock.queueResult("members", { data: null, error: { message: "permission denied" } });
    fireEvent.click(screen.getByRole("button", { name: /Import \(0 updates \+ 1 new\)/ }));
    expect(await screen.findByText(/Import failed: permission denied/)).toBeInTheDocument();
    expect(attendanceUpserts()).toEqual([]);
  });
});
