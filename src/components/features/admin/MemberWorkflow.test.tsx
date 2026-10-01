import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "react-query";
import { AddMemberModal } from "./AddMemberModal";
import { MemberAttendanceModal } from "./MemberAttendanceModal";
import { adminMembersRepository } from "../../../data/repos/adminMembers";

jest.mock("../../../data/repos/adminMembers", () => ({
  adminMembersRepository: {
    createMember: jest.fn(),
    getHistory: jest.fn(),
    getAttendanceEvents: jest.fn(),
    addAttendance: jest.fn(),
    removeAttendance: jest.fn(),
  },
}));

const member = {
  id: "lan",
  first_name: "Lan",
  last_name: "Tran",
  points: 0,
  events_attended: 0,
};
const gbm = {
  id: "gbm",
  name: "GBM 1",
  points: 3,
  date: "2026-09-30T18:00:00-07:00",
  academic_term_id: "fall",
  academic_terms: { label: "Fall 2026" },
};
const mockRepo = jest.mocked(adminMembersRepository);

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
beforeEach(() => {
  jest.clearAllMocks();
  mockRepo.getHistory.mockResolvedValue({ member, records: [], yearly: [] });
  mockRepo.getAttendanceEvents.mockResolvedValue([gbm]);
  mockRepo.createMember.mockResolvedValue(member);
  mockRepo.addAttendance.mockResolvedValue(true);
  mockRepo.removeAttendance.mockResolvedValue();
});

function mount(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, cacheTime: 0 },
      mutations: { retry: false },
    },
  });
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return client;
}

it("creates a member with optional email and keeps invalid names from saving", async () => {
  const onCreated = jest.fn();
  mount(<AddMemberModal onClose={jest.fn()} onCreated={onCreated} />);
  fireEvent.click(screen.getByRole("button", { name: "Create member" }));
  expect(await screen.findByText("First name is required")).toBeInTheDocument();
  expect(mockRepo.createMember).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("First name"), {
    target: { value: "Lan" },
  });
  fireEvent.change(screen.getByLabelText("Last name"), {
    target: { value: "Tran" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create member" }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith(member));
  expect(mockRepo.createMember).toHaveBeenCalledWith({
    first_name: "Lan",
    last_name: "Tran",
    email: "",
    college: "",
    year: "",
  });
});

it("adds attendance and immediately reloads history, totals and shared point caches", async () => {
  const onChanged = jest.fn().mockResolvedValue(undefined);
  const client = mount(
    <MemberAttendanceModal
      memberId="lan"
      onClose={jest.fn()}
      onChanged={onChanged}
    />,
  );
  const invalidate = jest.spyOn(client, "invalidateQueries");
  await screen.findByRole("option", { name: /GBM 1/ });
  fireEvent.change(screen.getByLabelText("Add event attendance"), {
    target: { value: "gbm" },
  });
  mockRepo.getHistory.mockResolvedValue({
    member: { ...member, points: 3, events_attended: 1 },
    records: [{ event_id: "gbm", points_earned: 3, events: gbm }],
    yearly: [],
  });
  fireEvent.click(screen.getByRole("button", { name: "Add attendance" }));
  await screen.findByText("3 pts (All-Time) · 1 event");
  expect(mockRepo.addAttendance).toHaveBeenCalledWith("lan", "gbm");
  expect(onChanged).toHaveBeenCalled();
  expect(
    screen.getByRole("option", { name: /GBM 1.*Attended/ }),
  ).toBeDisabled();
  expect(invalidate).toHaveBeenCalledWith(["find-my-points"]);
});

it("confirms the member and event before removing attendance, then refreshes totals", async () => {
  mockRepo.getHistory.mockResolvedValue({
    member: { ...member, points: 3, events_attended: 1 },
    records: [{ event_id: "gbm", points_earned: 3, events: gbm }],
    yearly: [],
  });
  mount(
    <MemberAttendanceModal
      memberId="lan"
      onClose={jest.fn()}
      onChanged={jest.fn()}
    />,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Remove GBM 1 attendance" }),
  );
  expect(
    screen.getByText(/Remove Lan Tran’s attendance at GBM 1/),
  ).toBeInTheDocument();
  expect(mockRepo.removeAttendance).not.toHaveBeenCalled();
  mockRepo.getHistory.mockResolvedValue({ member, records: [], yearly: [] });
  fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));
  await screen.findByText("0 pts (All-Time) · 0 events");
  expect(mockRepo.removeAttendance).toHaveBeenCalledWith("lan", "gbm");
});

it("shows a failed history load and keeps attendance controls unavailable", async () => {
  mockRepo.getHistory.mockRejectedValue(new Error("offline"));
  const consoleError = jest
    .spyOn(console, "error")
    .mockImplementation(() => undefined);
  mount(
    <MemberAttendanceModal
      memberId="lan"
      onClose={jest.fn()}
      onChanged={jest.fn()}
    />,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(/load attendance/);
  expect(
    screen.queryByRole("button", { name: "Add attendance" }),
  ).not.toBeInTheDocument();
  consoleError.mockRestore();
});
