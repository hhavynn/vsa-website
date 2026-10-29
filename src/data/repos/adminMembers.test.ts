import { adminMembersRepository } from "./adminMembers";
import { memberRosterCsv } from "../../lib/memberRosterExport";
import { photoRequestsRepository } from "./photoRequests";
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


const rosterRow = (index: number) => ({
  id: `member-${String(index).padStart(4, "0")}`,
  first_name: index === 1204 ? "Matthew" : "Member",
  last_name: index === 1204 ? "Van" : String(index),
  college: null,
  year: null,
  house: null,
  email: null,
  points: index,
  events_attended: 0,
  created_at: "",
  needs_review: false,
});

describe("full admin roster pagination", () => {
  it("loads members beyond the first 1,000 without dropping low or high-point records", async () => {
    const all = Array.from({ length: 1205 }, (_, index) => rosterRow(index));
    supabaseMock.setDefault("members", { data: all, error: null });

    const rows = await adminMembersRepository.listAllMembers();

    expect(rows).toHaveLength(1205);
    expect(rows.find((row) => row.first_name === "Matthew" && row.last_name === "Van")).toBeDefined();
    const queries = supabaseMock.queriesFor("members");
    expect(queries).toHaveLength(3);
    expect(queries.map((q) => q.calls.find((c) => c.method === "limit")?.args)).toEqual([[500], [500], [500]]);
    expect(queries[0].calls).not.toContainEqual({ method: "gt", args: ["id", "member-0499"] });
    expect(queries[1].calls).toContainEqual({ method: "gt", args: ["id", "member-0499"] });
    expect(queries[2].calls).toContainEqual({ method: "gt", args: ["id", "member-0999"] });
    expect(queries[0].calls).toContainEqual({ method: "order", args: ["id", { ascending: true }] });
  });

  it("stops after an exact page boundary without returning a truncated roster", async () => {
    supabaseMock.setDefault("members", {
      data: Array.from({ length: 1000 }, (_, index) => rosterRow(index)),
      error: null,
    });
    await expect(adminMembersRepository.listAllMembers()).resolves.toHaveLength(1000);
    expect(supabaseMock.queriesFor("members")).toHaveLength(3);
  });

  it("rejects the entire list when a later batch fails", async () => {
    supabaseMock.queueResult("members", {
      data: Array.from({ length: 500 }, (_, index) => rosterRow(index)),
      error: null,
    });
    supabaseMock.queueResult("members", {
      data: null,
      error: postgrestError("second page denied", "42501"),
    });
    await expect(adminMembersRepository.listAllMembers()).rejects.toMatchObject({ code: "42501" });
    expect(supabaseMock.queriesFor("members")).toHaveLength(2);
  });
});



describe("admin roster CSV export safety", () => {
  it("quotes commas, quotes and line breaks, defuses spreadsheet formulas, and preserves Unicode", () => {
    const csv = memberRosterCsv([
      {
        ...rosterRow(1),
        first_name: '=HYPERLINK("https://example.invalid","click")',
        last_name: 'Nguyễn, "Văn"\nTran',
        email: ' +SUM(1,2)@example.invalid',
        college: 'Sixth',
        year: '3',
        current_house: 'Rarity',
      },
    ], false);
    expect(csv.startsWith("\uFEFFFirst Name,")).toBe(true);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('"Nguyễn, ""Văn""\nTran"');
    expect(csv).toContain('"\' +SUM(1,2)@example.invalid"');
    expect(csv).toContain(',Rarity,1,0\n');
    expect(csv.endsWith('\n')).toBe(true);
  });

  it("exports unknown rather than a misleading unassigned House after a denied lookup", () => {
    const csv = memberRosterCsv([{ ...rosterRow(1), current_house: null }], true);
    expect(csv).toContain(',unknown,1,0');
  });
});

describe("approved-avatar view completeness", () => {
  it("loads approved avatars beyond 1,000 without treating them as missing", async () => {
    const data = Array.from({ length: 1101 }, (_, index) => ({
      member_id: `member-${String(index).padStart(4, "0")}`,
      avatar_url: `https://example.invalid/photo-${index}.webp`,
    }));
    // This fixture returns server-sized pages explicitly: the shared mock's
    // default keyset helper only models the `id` column, not `member_id`.
    for (let start = 0; start < data.length; start += 500) {
      supabaseMock.queueResult("public_member_avatars", {
        data: data.slice(start, start + 500),
        error: null,
      });
    }
    const avatars = await photoRequestsRepository.getPublicMemberAvatars();
    expect(avatars.size).toBe(1101);
    expect(avatars.get("member-1100")).toContain("photo-1100.webp");
    const queries = supabaseMock.queriesFor("public_member_avatars");
    expect(queries).toHaveLength(3);
    expect(queries[1].calls).toContainEqual({ method: "gt", args: ["member_id", "member-0499"] });
  });

  it("does not return partial approved-avatar status when a later page fails", async () => {
    supabaseMock.queueResult("public_member_avatars", {
      data: Array.from({ length: 500 }, (_, index) => ({
        member_id: `member-${String(index).padStart(4, "0")}`,
        avatar_url: "https://example.invalid/avatar.webp",
      })),
      error: null,
    });
    supabaseMock.queueResult("public_member_avatars", {
      data: null, error: postgrestError("denied", "42501"),
    });
    await expect(photoRequestsRepository.getPublicMemberAvatars()).rejects.toMatchObject({ code: "42501" });
  });
});
