// The identity importer stays off until its migration is applied: by default
// Admin → Import is the Stage A importer and never reads the identity tables
// or calls the new import function. Synthetic members only.
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "react-query";
import AdminImport from "./Import";
import { supabaseMock } from "../../test-utils/supabaseMock";

jest.mock("../../lib/supabase", () => ({
  get supabase() {
    return require("../../test-utils/supabaseMock").supabaseMock.client;
  },
}));
jest.mock("../../components/features/admin/ImportAuditPanel", () => ({ ImportAuditPanel: () => null }));
jest.mock("../../components/features/admin/HistoricalRecoveryPanel", () => ({ HistoricalRecoveryPanel: () => null }));

const lan = { id: "lan", first_name: "Lan", last_name: "Tran", email: "lan@ucsd.edu", year: "2nd Year", college: "Muir", points: 0, events_attended: 0, created_at: "2025-01-01T00:00:00Z" };

beforeEach(() => {
  supabaseMock.reset();
  delete process.env.REACT_APP_ATTENDANCE_IDENTITY_V2;
  supabaseMock.setDefault("events", { data: [{ id: "gbm", name: "GBM 1", points: 3, date: "2026-09-30", academic_term_id: "fall" }], error: null });
  supabaseMock.setDefault("academic_terms", { data: [{ id: "fall", label: "Fall 2026", academic_year_start: 2026, academic_year_end: 2027 }], error: null });
  supabaseMock.setDefault("members", { data: [lan], error: null });
});
afterAll(() => { delete process.env.REACT_APP_ATTENDANCE_IDENTITY_V2; });

async function preview() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AdminImport />
    </QueryClientProvider>,
  );
  await screen.findByRole("option", { name: /GBM 1/ });
  fireEvent.change(screen.getByLabelText("Event *"), { target: { value: "gbm" } });
  fireEvent.click(screen.getByLabelText("Local CSV file"));
  fireEvent.change(screen.getByLabelText("CSV file"), {
    target: { files: [new File(["Name,Email\nLan Tran,lan@ucsd.edu"], "a.csv", { type: "text/csv" })] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Load & Preview" }));
}

const identityReads = () => [
  ...supabaseMock.queriesFor("member_identity_emails"),
  ...supabaseMock.queriesFor("member_year_observations"),
  ...supabaseMock.queriesFor("rpc:admin_apply_attendance_import"),
];

it("serves the Stage A importer by default and never touches the identity schema", async () => {
  await preview();
  await screen.findByLabelText("Import summary");
  expect(screen.getByText("Confidence")).toBeInTheDocument();
  expect(screen.queryByText("Matched by known email")).not.toBeInTheDocument();
  expect(identityReads()).toEqual([]);
});

it("serves the identity importer when the rollout flag is on", async () => {
  process.env.REACT_APP_ATTENDANCE_IDENTITY_V2 = "true";
  await preview();
  expect(await screen.findByText("Matched by known email")).toBeInTheDocument();
  expect(supabaseMock.queriesFor("member_identity_emails").length).toBeGreaterThan(0);
});

it("says the migration is missing, before anything is imported, if the flag is on too early", async () => {
  process.env.REACT_APP_ATTENDANCE_IDENTITY_V2 = "true";
  supabaseMock.setDefault("member_identity_emails", { data: null, error: { code: "PGRST205", message: "Could not find the table" } });
  await preview();
  expect(await screen.findByText(/identity migration \(20261025000000\) is not applied/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Import \(/ })).toBeDisabled();
});
