import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackForm } from "./FeedbackForm";
import { ValidationError } from "../../../data/errors";

const mockSubmit = jest.fn();
const mockSuccess = jest.fn();
const mockInsert = jest.fn();
jest.mock("../../../data/repos/feedback", () => ({
  feedbackRepository: { submit: (...args: unknown[]) => mockSubmit(...args) },
}));
jest.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));
jest.mock("../../../lib/supabase", () => ({
  supabase: {
    from: () => ({ insert: (...args: unknown[]) => mockInsert(...args) }),
  },
}));
jest.mock("react-hot-toast", () => ({
  toast: { success: (...args: unknown[]) => mockSuccess(...args) },
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockSubmit.mockResolvedValue(undefined);
});
async function fillAndSubmit() {
  await userEvent.type(screen.getByLabelText("Subject"), "Feedback subject");
  await userEvent.type(screen.getByLabelText("Message"), "Feedback details");
  await userEvent.click(
    screen.getByRole("button", { name: "Submit Feedback" }),
  );
}
it("submits anonymously through the repository, preserves pending/success states and resets", async () => {
  let finish: () => void = () => undefined;
  mockSubmit.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  const onSuccess = jest.fn();
  render(<FeedbackForm onSuccess={onSuccess} />);
  await fillAndSubmit();
  await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("button", { name: "Sending..." })).toBeDisabled();
  expect(mockSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Feedback subject",
      description: "Feedback details",
    }),
  );
  expect(mockInsert).not.toHaveBeenCalled();
  await act(async () => {
    finish();
  });
  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  expect(mockSuccess).toHaveBeenCalledWith("Thank you for your feedback!");
  expect(screen.getByLabelText("Subject")).toHaveValue("");
});
it("shows a controlled rejection, preserves input and never announces success", async () => {
  mockSubmit.mockRejectedValue(
    new ValidationError(
      "Too many feedback submissions. Please try again later.",
    ),
  );
  render(<FeedbackForm />);
  await fillAndSubmit();
  expect(
    await screen.findByText(
      "Too many feedback submissions. Please try again later.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Subject")).toHaveValue("Feedback subject");
  expect(mockSuccess).not.toHaveBeenCalled();
});
