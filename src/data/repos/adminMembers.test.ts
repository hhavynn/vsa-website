import { adminMembersRepository } from "./adminMembers";
import { postgrestError, supabaseMock } from "../../test-utils/supabaseMock";

jest.mock("../../lib/supabase", () => ({
  get supabase() {
    return require("../../test-utils/supabaseMock").supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

function event(points = 3, term: string | null = "fall") {
  supabaseMock.setDefault("events", {
    data: { id: "event-1", points, academic_term_id: term },
    error: null,
  });
}

it.each([0, 3])(
  "adds attendance with configured points (%s), ignoring duplicates without overwriting",
  async (points) => {
    event(points);
    supabaseMock.setDefault("member_event_attendance", {
      data: [{ id: "attendance-1" }],
      error: null,
    });
    await expect(
      adminMembersRepository.addAttendance("member-1", "event-1"),
    ).resolves.toBe(true);
    expect(
      supabaseMock.queriesFor("member_event_attendance")[0].calls,
    ).toContainEqual({
      method: "upsert",
      args: [
        { member_id: "member-1", event_id: "event-1", points_earned: points },
        { onConflict: "member_id,event_id", ignoreDuplicates: true },
      ],
    });
    expect(supabaseMock.usedMethod("members", "update")).toBe(false);
    expect(supabaseMock.queriesFor("event_attendance")).toHaveLength(0);
    expect(supabaseMock.queriesFor("user_points")).toHaveLength(0);
  },
);

it("reports an existing attendance record without changing its points", async () => {
  event();
  await expect(
    adminMembersRepository.addAttendance("member-1", "event-1"),
  ).resolves.toBe(false);
});

it("blocks additions for events without an academic term", async () => {
  event(3, null);
  await expect(
    adminMembersRepository.addAttendance("member-1", "event-1"),
  ).rejects.toThrow(/academic term/);
  expect(supabaseMock.queriesFor("member_event_attendance")).toHaveLength(0);
});

it("does not write attendance when loading current event points fails", async () => {
  supabaseMock.setDefault("events", {
    data: null,
    error: postgrestError("denied", "42501"),
  });
  await expect(
    adminMembersRepository.addAttendance("member-1", "event-1"),
  ).rejects.toMatchObject({ code: "42501" });
  expect(supabaseMock.queriesFor("member_event_attendance")).toHaveLength(0);
});

it("removes only the selected member/event pair and leaves totals to triggers", async () => {
  supabaseMock.setDefault("member_event_attendance", {
    data: [{ id: "attendance-1" }],
    error: null,
  });
  await adminMembersRepository.removeAttendance("member-1", "event-1");
  expect(supabaseMock.filtersFor("member_event_attendance")).toEqual([
    ["member_id", "member-1"],
    ["event_id", "event-1"],
  ]);
  expect(supabaseMock.usedMethod("member_event_attendance", "delete")).toBe(
    true,
  );
  expect(supabaseMock.queriesFor("members")).toHaveLength(0);
});

it("surfaces denied attendance writes and removals", async () => {
  event();
  supabaseMock.setDefault("member_event_attendance", {
    data: null,
    error: postgrestError("denied", "42501"),
  });
  await expect(
    adminMembersRepository.addAttendance("member-1", "event-1"),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    adminMembersRepository.removeAttendance("member-1", "event-1"),
  ).rejects.toMatchObject({ code: "42501" });
});

it("creates only member profile fields with trimmed names and optional email", async () => {
  supabaseMock.queueResult("members", {
    data: { id: "new-member", first_name: "Lan", last_name: "Tran" },
    error: null,
  });
  await adminMembersRepository.createMember({
    first_name: " Lan ",
    last_name: " Tran ",
    email: "",
    college: "",
    year: "",
  });
  expect(supabaseMock.queriesFor("members")[0].calls).toContainEqual({
    method: "insert",
    args: [
      {
        first_name: "Lan",
        last_name: "Tran",
        email: null,
        college: null,
        year: null,
      },
    ],
  });
});

it("rejects invalid member details before a database write", async () => {
  await expect(
    adminMembersRepository.createMember({
      first_name: " ",
      last_name: "Tran",
      email: "bad",
      college: "",
      year: "",
    }),
  ).rejects.toThrow();
  expect(supabaseMock.queries()).toHaveLength(0);
});

it("rejects an already used normalized email before creating a member", async () => {
  supabaseMock.setDefault("members", {
    data: [{ id: "existing" }],
    error: null,
  });
  await expect(
    adminMembersRepository.createMember({
      first_name: "Lan",
      last_name: "Tran",
      email: " LAN@UCSD.EDU ",
      college: "",
      year: "",
    }),
  ).rejects.toThrow(/already exists/);
  expect(supabaseMock.filtersFor("members")).toContainEqual([
    "email",
    "lan@ucsd.edu",
  ]);
  expect(supabaseMock.usedMethod("members", "insert")).toBe(false);
});

it("does not report success when a removal affected no attendance rows", async () => {
  await expect(
    adminMembersRepository.removeAttendance("member-1", "event-1"),
  ).rejects.toThrow(/not removed/);
});
