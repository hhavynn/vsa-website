import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import toast from "react-hot-toast";
import { QueryClient, QueryClientProvider } from "react-query";
import AdminImport from "./Import";
import { supabaseMock } from "../../test-utils/supabaseMock";
import type { AttendanceImportRequest } from "../../lib/attendanceImportDecisions";

const RPC = "rpc:admin_apply_attendance_import";
const rpcOk = (extra: Record<string, unknown> = {}) => ({
  data: {
    ok: true, request_id: "r", created: [], attendance_inserted: 1, attendance_already_present: [],
    profile_fills: 0, years_advanced: 0, years_skipped: [], aliases_added: 0, observations_added: 0, ...extra,
  },
  error: null,
});
const requests = () =>
  supabaseMock.queriesFor(RPC).map((q) => (q.calls[0].args[0] as { p_request: AttendanceImportRequest }).p_request);

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

beforeEach(() => {
  supabaseMock.reset();
  mockAudit.mockClear();
  supabaseMock.setDefault(RPC, rpcOk());
  supabaseMock.setDefault("events", {
    data: [
      {
        id: "gbm",
        name: "GBM 1",
        points: 3,
        date: "2026-09-30",
        academic_term_id: "fall",
      },
    ],
    error: null,
  });
  supabaseMock.setDefault("academic_terms", {
    data: [
      {
        id: "fall",
        label: "Fall 2026",
        academic_year_start: 2026,
        academic_year_end: 2027,
      },
    ],
    error: null,
  });
  supabaseMock.setDefault("members", {
    data: [
      {
        id: "lan",
        first_name: "Lan",
        last_name: "Tran",
        email: "lan@ucsd.edu",
        year: "Freshman",
        college: "Muir",
        points: 0,
        events_attended: 0,
      },
    ],
    error: null,
  });
});

async function setup() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <AdminImport />
    </QueryClientProvider>,
  );
  await screen.findByRole("option", { name: /GBM 1/ });
  fireEvent.change(screen.getByLabelText("Event *"), {
    target: { value: "gbm" },
  });
  fireEvent.click(screen.getByLabelText("Local CSV file"));
}

it("feeds a Google Form file into the existing matching, duplicate and import/audit flow", async () => {
  await setup();
  const csv =
    "Timestamp,Name (First & Last),School Email?,What year are you?,College\n9/30/2026,Lan Tran,lan@ucsd.edu,1,Muir\n9/30/2026,Lan Tran,lan@ucsd.edu,1,Muir";
  fireEvent.change(screen.getByLabelText("CSV file"), {
    target: {
      files: [new File([csv], "attendance.csv", { type: "text/csv" })],
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load & Preview" }));
  await screen.findByText("Duplicate rows skipped");
  const duplicates = screen
    .getAllByTestId("summary-stat")
    .find((el) => within(el).queryByText("Duplicate rows skipped")) as HTMLElement;
  expect(within(duplicates).getByRole("definition")).toHaveTextContent("1");
  expect(screen.getByRole("checkbox", { name: /full name/ })).toBeChecked();
  const importButton = screen.getByRole("button", {
    name: /Import \(1 update \+ 0 new\)/,
  });
  supabaseMock.setDefault("events", {
    data: { id: "gbm", points: 3, academic_term_id: "fall" },
    error: null,
  });
  fireEvent.click(importButton);
  await screen.findByText("Import complete!");
  expect(requests()[0].credits.map((c) => c.member_id)).toEqual(["lan"]);
  await waitFor(() =>
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ source_type: "manual", source_url: null }),
    ),
  );
});

it("rejects non-CSV files and leaves the import untouched", async () => {
  await setup();
  fireEvent.change(screen.getByLabelText("CSV file"), {
    target: { files: [new File(["bad"], "attendance.xlsx")] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load & Preview" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/\.csv/);
  expect(supabaseMock.usedMethod("members", "insert")).toBe(false);
});

it("creates a new member from the Google Form columns before importing attendance", async () => {
  await setup();
  fireEvent.change(screen.getByLabelText("CSV file"), {
    target: {
      files: [
        new File(
          [
            "Timestamp,Name (First & Last),School Email?,What year are you?,College\n9/30/2026,Minh Nguyen,minh@ucsd.edu,2,Muir",
          ],
          "walk-ins.csv",
        ),
      ],
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load & Preview" }));
  const confirm = await screen.findByRole("button", {
    name: /Import \(0 updates \+ 1 new\)/,
  });
  supabaseMock.setDefault("events", {
    data: { id: "gbm", points: 3, academic_term_id: "fall" },
    error: null,
  });
  supabaseMock.queueResult(RPC, rpcOk({ created: [{ row_key: "row-0", member_id: "minh" }] }));
  fireEvent.click(confirm);
  await screen.findByText("Import complete!");
  expect(requests()[0].creates).toEqual([{
    row_key: "row-0",
    first_name: "Minh",
    last_name: "Nguyen",
    college: "Muir",
    year: "2nd Year",
    email: "minh@ucsd.edu",
    observed_year: "2nd Year",
    known_same_name_ids: [],
  }]);
  expect(supabaseMock.usedMethod("members", "insert")).toBe(false);
  expect(supabaseMock.usedMethod("member_event_attendance", "upsert")).toBe(false);
});

describe("profile enrichment during an import", () => {
  // react-hot-toast keeps its toasts in a module-level store; clear them between tests.
  beforeEach(() => toast.remove());

  const sophomoreCsv =
    "Timestamp,Name (First & Last),School Email?,What year are you?,College\n9/30/2026,Lan Tran,lan@ucsd.edu,2,Muir";
  const lan = {
    id: "lan",
    first_name: "Lan",
    last_name: "Tran",
    email: "lan@ucsd.edu",
    year: "Freshman",
    college: "Muir",
    points: 0,
    events_attended: 0,
  };

  async function previewAndImport() {
    await setup();
    fireEvent.change(screen.getByLabelText("CSV file"), {
      target: {
        files: [new File([sophomoreCsv], "attendance.csv", { type: "text/csv" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load & Preview" }));
    const importButton = await screen.findByRole("button", {
      name: /Import \(1 update \+ 0 new\)/,
    });
    supabaseMock.setDefault("events", {
      data: { id: "gbm", points: 3, academic_term_id: "fall" },
      error: null,
    });
    return importButton;
  }

  it("plans the year advance from the legacy label and reports it once written", async () => {
    supabaseMock.setDefault(RPC, rpcOk({ years_advanced: 1 }));
    const importButton = await previewAndImport();
    fireEvent.click(importButton);
    await screen.findByText("Import complete!");
    expect(requests()[0].credits[0]).toMatchObject({ member_id: "lan", year: { from: "Freshman", to: "2nd Year" } });
    const advanced = screen.getAllByTestId("summary-stat").find((el) => within(el).queryByText("Years advanced")) as HTMLElement;
    expect(within(advanced).getByRole("definition")).toHaveTextContent("1");
    await waitFor(() => expect(mockAudit).toHaveBeenCalled());
    expect(mockAudit.mock.calls[0][0].rows[0].match_details.year_advance).toEqual({ from: "Freshman", to: "2nd Year" });
  });

  it("reports a year the database skipped because it changed after the preview", async () => {
    supabaseMock.setDefault(RPC, rpcOk({ years_skipped: ["row-0"] }));
    const importButton = await previewAndImport();
    fireEvent.click(importButton);
    expect(await screen.findByText(/1 year update was skipped/)).toBeInTheDocument();
  });
});

