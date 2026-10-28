import { feedbackRepository } from "./feedback";

const mockInvoke = jest.fn();
const mockFrom = jest.fn();
jest.mock("../../lib/supabase", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));
const input = {
  type: "bug" as const,
  title: " Problem ",
  description: " Details ",
  name: "",
  email: "",
};
beforeEach(() => {
  jest.clearAllMocks();
  mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
});
it("uses the boundary and never forwards identity or arbitrary fields", async () => {
  await feedbackRepository.submit({
    ...input,
    user_id: "untrusted",
    status: "resolved",
  } as typeof input);
  expect(mockInvoke).toHaveBeenCalledWith("submit-feedback", {
    body: {
      type: "bug",
      title: "Problem",
      description: "Details",
      name: "",
      email: "",
    },
  });
  expect(mockFrom).not.toHaveBeenCalled();
});
it("does not report success for failed or invalid responses", async () => {
  for (const result of [
    { data: null, error: null },
    { data: { success: false }, error: null },
    { data: null, error: { message: "internal database detail" } },
  ]) {
    mockInvoke.mockResolvedValue(result);
    await expect(feedbackRepository.submit(input)).rejects.toThrow(
      "Feedback is unavailable. Please try again later.",
    );
  }
});
it("maps quota and session failures to authored messages without exposing upstream errors", async () => {
  for (const [status, expected] of [
    [429, "Too many feedback submissions. Please try again later."],
    [
      401,
      "Your session could not be verified. Sign in again or submit while signed out.",
    ],
  ] as const) {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { context: { status }, message: "private error" },
    });
    await expect(feedbackRepository.submit(input)).rejects.toMatchObject({
      name: "ValidationError",
      message: expected,
    });
  }
});
