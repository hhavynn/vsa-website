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

beforeEach(() => {
  supabaseMock.reset();
  mockAudit.mockClear();
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
  expect(
    supabaseMock
      .queriesFor("member_event_attendance")
      .some((q) =>
        q.calls.some(
          (c) =>
            c.method === "upsert" && JSON.stringify(c.args).includes("lan"),
        ),
      ),
  ).toBe(true);
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
  supabaseMock.queueResult("members", { data: [], error: null });
  supabaseMock.queueResult("members", { data: [{ id: "minh" }], error: null });
  fireEvent.click(confirm);
  await screen.findByText("Import complete!");
  expect(
    supabaseMock.queriesFor("members").flatMap((query) => query.calls),
  ).toContainEqual({
    method: "insert",
    args: [
      [
        {
          first_name: "Minh",
          last_name: "Nguyen",
          college: "Muir",
          year: "2nd Year",
          email: "minh@ucsd.edu",
          needs_review: false,
        },
      ],
    ],
  });
  expect(
    supabaseMock
      .queriesFor("member_event_attendance")
      .flatMap((query) => query.calls),
  ).toContainEqual({
    method: "upsert",
    args: [
      [{ member_id: "minh", event_id: "gbm", points_earned: 3 }],
      { onConflict: "member_id,event_id", ignoreDuplicates: true },
    ],
  });
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

  const auditedEnrichedCount = () =>
    (mockAudit.mock.calls[0]?.[0]?.rows ?? []).map(
      (row: { match_details: { enriched_members_count: number } }) =>
        row.match_details.enriched_members_count,
    );

  it("announces the profile update only when it was saved", async () => {
    const importButton = await previewAndImport();
    fireEvent.click(importButton);

    expect(await screen.findByText(/enriched 1 profile/)).toBeInTheDocument();
    expect(screen.queryByText(/did not save/)).not.toBeInTheDocument();
    await waitFor(() => expect(mockAudit).toHaveBeenCalled());
    expect(auditedEnrichedCount()).toEqual([1]);
  });

  it("reports a profile update that failed instead of counting it as enriched", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const importButton = await previewAndImport();
      // Import-time reads of `members` (latest record), then the profile update, which is rejected.
      supabaseMock.queueResult("members", { data: [lan], error: null });
      supabaseMock.queueResult("members", {
        data: null,
        error: { code: "over_request_rate_limit", message: "paused" },
      });
      fireEvent.click(importButton);

      expect(await screen.findByText(/1 profile update did not save/)).toBeInTheDocument();
      expect(screen.queryByText(/enriched 1 profile/)).not.toBeInTheDocument();
      // Attendance was still recorded, and the audit says nothing was enriched.
      expect(
        supabaseMock.queriesFor("member_event_attendance").some((q) => q.calls.some((c) => c.method === "upsert")),
      ).toBe(true);
      await waitFor(() => expect(mockAudit).toHaveBeenCalled());
      expect(auditedEnrichedCount()).toEqual([0]);
    } finally {
      consoleError.mockRestore();
    }
  });
});
