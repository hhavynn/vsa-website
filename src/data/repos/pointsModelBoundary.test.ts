import { leaderboardRepository, LeaderboardRepository } from "./leaderboard";
import { supabaseMock } from "../../test-utils/supabaseMock";

jest.mock("../../lib/supabase", () => ({
  get supabase() {
    return require("../../test-utils/supabaseMock").supabaseMock.client;
  },
}));

const RETIRED = [
  "event_attendance",
  "user_points",
  "event_check_in_secrets",
  "check_in_codes",
  "check_in_code_usage",
  "check_ins",
  "rpc:check_in_to_event",
];
const methods = Object.getOwnPropertyNames(
  LeaderboardRepository.prototype,
).filter((name) => name !== "constructor");

async function tablesTouchedBy(
  method: string,
  ...args: unknown[]
): Promise<string[]> {
  supabaseMock.reset();
  const fn = (
    leaderboardRepository as unknown as Record<
      string,
      (...parameters: unknown[]) => unknown
    >
  )[method];
  await fn.apply(leaderboardRepository, args);
  return supabaseMock.queries().map((query) => query.table);
}

describe("the active member-based points model", () => {
  it.each(methods)(
    "leaderboard.%s never consumes a retired account table or RPC",
    async (method) => {
      const touched = await tablesTouchedBy(method, 2025, 10, 0);
      expect(touched.length).toBeGreaterThan(0);
      expect(touched.filter((table) => RETIRED.includes(table))).toEqual([]);
    },
  );

  it("reads yearly points and House rankings from member views", async () => {
    expect(await tablesTouchedBy("getYearlyLeaderboard", 2025)).toEqual([
      "member_yearly_points",
    ]);
    expect(await tablesTouchedBy("getHouseMemberRankings", 2025)).toEqual([
      "house_member_yearly_points",
    ]);
    expect(await tablesTouchedBy("getHouseMemberRankings", "all")).toEqual([
      "house_member_all_time_points",
    ]);
  });

  it("reads public history and all-time totals through safe member views", async () => {
    expect(
      await tablesTouchedBy("getMemberEventHistory", "member-1", 2025),
    ).toEqual(["member_event_history"]);
    expect(await tablesTouchedBy("getAllTimeLeaderboard")).toEqual([
      "public_members",
    ]);
  });
});
