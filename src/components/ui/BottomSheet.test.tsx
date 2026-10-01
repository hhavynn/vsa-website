import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { BottomSheet } from "./BottomSheet";

function SheetHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open event</button>
      <button>Background action</button>
      {open && (
        <BottomSheet onClose={() => setOpen(false)} ariaLabel="Event details">
          <button onClick={() => setOpen(false)}>Close event</button>
          <button disabled>Unavailable action</button>
          <a href="#calendar">Add to calendar</a>
        </BottomSheet>
      )}
    </>
  );
}

describe("BottomSheet keyboard accessibility", () => {
  it("wraps Tab and Shift-Tab around enabled sheet controls", async () => {
    render(<SheetHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Open event" }));

    const first = screen.getByRole("button", { name: "Close event" });
    const last = screen.getByRole("link", { name: "Add to calendar" });
    last.focus();
    userEvent.tab();
    expect(first).toHaveFocus();

    userEvent.tab({ shift: true });
    expect(last).toHaveFocus();
  });

  it("focuses the first control and restores the opener and prior scroll lock after Escape", async () => {
    document.body.style.overflow = "clip";
    const { unmount } = render(<SheetHarness />);
    const opener = screen.getByRole("button", { name: "Open event" });
    try {
      await userEvent.click(opener);
      expect(screen.getByRole("button", { name: "Close event" })).toHaveFocus();
      expect(document.body.style.overflow).toBe("hidden");

      userEvent.keyboard("{Escape}");
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(opener).toHaveFocus();
      expect(document.body.style.overflow).toBe("clip");
    } finally {
      unmount();
      document.body.style.overflow = "";
    }
  });

  it("contains attempted background focus and prevents background Escape handlers", async () => {
    render(<SheetHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Open event" }));
    const backgroundHandler = jest.fn();
    document.addEventListener("keydown", backgroundHandler);
    try {
      screen.getByRole("button", { name: "Background action" }).focus();
      const first = screen.getByRole("button", { name: "Close event" });
      expect(first).toHaveFocus();
      fireEvent.keyDown(first, { key: "Escape" });
      expect(backgroundHandler).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
    } finally {
      document.removeEventListener("keydown", backgroundHandler);
    }
  });

  it("portals outside the page and preserves existing inert attributes on unmount", async () => {
    const alreadyInert = document.createElement("div");
    alreadyInert.setAttribute("inert", "");
    document.body.appendChild(alreadyInert);
    const { container, unmount } = render(<SheetHarness />);
    try {
      await userEvent.click(screen.getByRole("button", { name: "Open event" }));
      const dialog = screen.getByRole("dialog");
      expect(container).not.toContainElement(dialog);
      expect(container).toHaveAttribute("inert");

      unmount();
      expect(container).not.toHaveAttribute("inert");
      expect(alreadyInert).toHaveAttribute("inert");
      expect(dialog).not.toBeInTheDocument();
    } finally {
      unmount();
      alreadyInert.remove();
    }
  });

  it("keeps focus on the panel when it contains no focusable controls", () => {
    render(
      <BottomSheet ariaLabel="Information" onClose={() => undefined}>
        Details
      </BottomSheet>,
    );
    const panel = screen.getByRole("dialog");
    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    panel.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(panel).toHaveFocus();
  });
});
