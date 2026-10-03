import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { SignInForm } from "./SignInForm";
import { supabaseMock } from "../../../test-utils/supabaseMock";

jest.unmock("@supabase/supabase-js");
const mockSignIn = jest.fn();
const mockSignOut = jest.fn();
jest.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({ signIn: mockSignIn, signOut: mockSignOut }),
}));
jest.mock("../../../lib/supabase", () => ({
  get supabase() {
    return require("../../../test-utils/supabaseMock").supabaseMock.client;
  },
}));

function Destination() {
  const location = useLocation();
  return (
    <div>
      Approved admin destination: {location.pathname}
      {location.search}
    </div>
  );
}

function renderSignIn(pathname = "/admin/events", search = "?event=existing") {
  render(
    <MemoryRouter
      initialEntries={[
        { pathname: "/admin/login", state: { from: { pathname, search } } },
      ]}
    >
      <Routes>
        <Route path="/admin/login" element={<SignInForm />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "admin@example.invalid" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "test-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
}

beforeEach(() => {
  supabaseMock.reset();
  mockSignIn.mockResolvedValue({ id: "approved-admin" });
  mockSignOut.mockResolvedValue(undefined);
});

it("opens the requested admin page after verifying the signed-in account", async () => {
  supabaseMock.queueResult("user_profiles", {
    data: { is_admin: true },
    error: null,
  });
  renderSignIn();
  expect(
    await screen.findByText(
      "Approved admin destination: /admin/events?event=existing",
    ),
  ).toBeInTheDocument();
  expect(supabaseMock.filtersFor("user_profiles")).toEqual([
    ["id", "approved-admin"],
  ]);
  expect(mockSignOut).not.toHaveBeenCalled();
});

it("signs a non-admin out and keeps the admin panel closed", async () => {
  supabaseMock.queueResult("user_profiles", {
    data: { is_admin: false },
    error: null,
  });
  renderSignIn();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /not authorized for the admin panel/i,
  );
  expect(mockSignOut).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByText(/Approved admin destination:/),
  ).not.toBeInTheDocument();
});

it("signs out when admin authorization cannot be verified", async () => {
  supabaseMock.queueResult("user_profiles", {
    data: null,
    error: { message: "Unavailable" },
  });
  renderSignIn();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unable to verify admin access.",
  );
  expect(mockSignOut).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByText(/Approved admin destination:/),
  ).not.toBeInTheDocument();
});

it("defaults a member-page destination to the admin overview", async () => {
  supabaseMock.queueResult("user_profiles", {
    data: { is_admin: true },
    error: null,
  });
  renderSignIn("/profile", "");
  expect(
    await screen.findByText("Approved admin destination: /admin"),
  ).toBeInTheDocument();
});

it("keeps failed credentials generic and does not query profile data", async () => {
  mockSignIn.mockRejectedValue(new Error("Private account detail"));
  renderSignIn();
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Incorrect email or password.",
    ),
  );
  expect(supabaseMock.queriesFor("user_profiles")).toHaveLength(0);
});
