// Attendance import reliability: complete member reads, failed reads, and real-world CSV
// shapes, through the page. Synthetic members only; no network.
import { fireEvent, render, screen, within } from "@testing-library/react";
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
jest.mock("../../components/features/admin/HistoricalRecoveryPanel", () => ({
  HistoricalRecoveryPanel: () => null,
}));
jest.mock("../../data/repos/importJobs", () => ({
  ...jest.requireActual("../../data/repos/importJobs"),
  importJobsRepository: { createJob: jest.fn().mockResolvedValue(undefined) },
}));

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const filler = (n: number) => ({
  id: uuid(n), first_name: `Filler${n}`, last_name: `Person${n}`, email: `filler${n}@ucsd.edu`,
  year: "2nd Year", college: "Warren", points: 0, events_attended: 0,
});

beforeEach(() => {
  supabaseMock.reset();
  toast.remove();
  supabaseMock.setDefault("events", {
    data: [{ id: "gbm", name: "GBM 1", points: 3, date: "2026-09-30", academic_term_id: "fall" }],
    error: null,
  });
  supabaseMock.setDefault("academic_terms", {
    data: [{ id: "fall", label: "Fall 2026", academic_year_start: 2026, academic_year_end: 2027 }],
    error: null,
  });
});

async function preview(csv: string) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AdminImport />
    </QueryClientProvider>,
  );
  await screen.findByRole("option", { name: /GBM 1/ });
  fireEvent.change(screen.getByLabelText("Event *"), { target: { value: "gbm" } });
  fireEvent.click(screen.getByLabelText("Local CSV file"));
  fireEvent.change(screen.getByLabelText("CSV file"), {
    target: { files: [new File([csv], "attendance.csv", { type: "text/csv" })] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load & Preview" }));
}

const stat = (label: string) => {
  const item = screen.getAllByTestId("summary-stat").find((el) => within(el).queryByText(label));
  if (!item) throw new Error(`No summary stat labelled "${label}"`);
  return within(item).getByRole("definition").textContent;
};
const memberInserts = () =>
  supabaseMock.queriesFor("members").flatMap((q) => q.calls).filter((c) => c.method === "insert");

describe("member roster beyond the 1,000-row cap", () => {
  it("matches a member who sorts after the first 1,000 instead of creating a duplicate", async () => {
    const late = { ...filler(1400), first_name: "Thao", last_name: "Pham", email: "thao@ucsd.edu" };
    supabaseMock.setDefault("members", {
      data: [...Array.from({ length: 1500 }, (_, i) => filler(i + 1)).filter((m) => m.id !== late.id), late],
      error: null,
    });
    await preview("Name,Email\nThao Pham,thao@ucsd.edu");
    await screen.findByLabelText("Import summary");
    expect(stat("Existing members receiving attendance")).toBe("1");
    expect(stat("New members being created")).toBe("0");
  });
});

describe("a failed member read", () => {
  it("blocks the import instead of treating every attendee as new", async () => {
    supabaseMock.queueResult("members", { data: null, error: { message: "permission denied for table members", code: "42501" } });
    await preview("Name,Email\nThao Pham,thao@ucsd.edu");
    expect(await screen.findByText("Matching did not run, so nothing can be imported.")).toBeInTheDocument();
    expect(screen.getByText("Insufficient permissions")).toBeInTheDocument();
    expect(stat("New members being created")).toBe("0");
    expect(screen.getByRole("button", { name: /Import \(/ })).toBeDisabled();
    expect(memberInserts()).toEqual([]);
  });

  it("blocks the import when the event's attendance cannot be read", async () => {
    supabaseMock.setDefault("members", { data: [filler(1)], error: null });
    supabaseMock.queueResult("member_event_attendance", { data: null, error: { message: "JWT expired", code: "PGRST301" } });
    await preview("Name,Email\nFiller1 Person1,filler1@ucsd.edu");
    expect(await screen.findByText("Matching did not run, so nothing can be imported.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Import \(/ })).toBeDisabled();
  });

  it("recovers on a retry once the read succeeds", async () => {
    supabaseMock.setDefault("members", { data: [filler(1)], error: null });
    supabaseMock.queueResult("members", { data: null, error: { message: "network request failed" } });
    await preview("Name,Email\nFiller1 Person1,filler1@ucsd.edu");
    await screen.findByText("Matching did not run, so nothing can be imported.");
    fireEvent.click(screen.getByRole("button", { name: /Re-run matching/ }));
    await screen.findByText("Matched by known email");
    expect(screen.queryByText("Matching did not run, so nothing can be imported.")).not.toBeInTheDocument();
    expect(stat("Existing members receiving attendance")).toBe("1");
  });
});

describe("real-world CSV shapes", () => {
  it("reads quoted commas, multiline answers, a BOM and CRLF without shifting columns", async () => {
    supabaseMock.setDefault("members", { data: [], error: null });
    const csv = [
      "﻿Timestamp,Email Address,Name (First & Last),Comments,What year are you?",
      '10/1/2026,new.one@ucsd.edu,"Le, Bao","great,\r\nthanks",1st',
      "",
    ].join("\r\n");
    await preview(csv);
    await screen.findByLabelText("Import summary");
    expect(stat("Valid source rows")).toBe("1");
    expect(screen.getByText("Le Bao")).toBeInTheDocument();
    expect(screen.getByText("new.one@ucsd.edu")).toBeInTheDocument();
    expect(screen.getAllByText("1st Year").length).toBeGreaterThan(0);
  });

  it("refuses a file with an unclosed quote instead of merging the rows after it into one cell", async () => {
    supabaseMock.setDefault("members", { data: [], error: null });
    await preview('Name,Comment\nAn Tran,"forgot to close\nBao Le,hi\nChi Vo,hey');
    expect(await screen.findByText(/quotation mark opened on line 2 is never closed/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Import summary")).not.toBeInTheDocument();
  });

  it("explains a file with no name column instead of creating nameless members", async () => {
    supabaseMock.setDefault("members", { data: [], error: null });
    await preview("Timestamp,Email Address\n10/1/2026,a@ucsd.edu");
    expect(await screen.findByText(/No name column is mapped/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Import \(/ })).toBeDisabled();
  });
});
