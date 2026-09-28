import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  AssistantMessageContent,
  normalizeAssistantText,
  parseBlocks,
} from "./formatAssistantMessage";

function renderMessage(content: string) {
  return render(
    <MemoryRouter>
      <AssistantMessageContent content={content} />
    </MemoryRouter>,
  );
}

// Verbatim shape of a real Ask VSA answer that rendered with raw "*" and "**".
const FLATTENED_ANSWER =
  "There is no single right way to get involved in VSA at UCSD! You can explore our community at your own pace by: " +
  "* **Attending events:** Check our [upcoming events](/events) to see what's happening next. " +
  "* **Joining programs:** You can participate in [ACE (mentorship)](/ace) for family connections or join a [House](/house) for friendly competition. " +
  "* **Building leadership skills:** If you are interested in eventually joining cabinet, look into the [Intern Program](/intern). " +
  "* **Staying updated:** Follow our official Instagram or check our Linktree for the newest updates.";

describe("AssistantMessageContent", () => {
  it("renders a flattened bullet answer as a list with bold labels and no raw markers", () => {
    const { container } = renderMessage(FLATTENED_ANSWER);

    expect(container.textContent).not.toContain("*");
    expect(
      within(screen.getByRole("list")).getAllByRole("listitem"),
    ).toHaveLength(4);
    expect(screen.getByText("Attending events:").tagName).toBe("STRONG");
    expect(screen.getByText("Staying updated:").tagName).toBe("STRONG");
    expect(
      screen.getByRole("link", { name: "ACE (mentorship)" }),
    ).toHaveAttribute("href", "/ace");
    expect(
      screen.getByRole("link", { name: "upcoming events" }),
    ).toHaveAttribute("href", "/events");
  });

  it("renders newline-separated bullets and numbered lists", () => {
    const { container } = renderMessage(
      "Steps:\n1. Sign up\n2. Show up\n\n- **One**\n- Two",
    );

    const [ordered, bullets] = screen.getAllByRole("list");
    expect(ordered.tagName).toBe("OL");
    expect(within(ordered).getAllByRole("listitem")).toHaveLength(2);
    expect(bullets.tagName).toBe("UL");
    expect(within(bullets).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("One").tagName).toBe("STRONG");
    expect(container.textContent).not.toMatch(/[*#]/);
  });

  it("handles italics, bold inside links, headings, and code", () => {
    const { container } = renderMessage(
      "## Houses\nThis is *fun* — see [**House**](/house) and `/points`.",
    );

    expect(screen.getByText("Houses").tagName).toBe("P");
    expect(screen.getByText("fun").tagName).toBe("EM");
    const link = screen.getByRole("link", { name: "House" });
    expect(link).toHaveAttribute("href", "/house");
    expect(within(link).getByText("House").tagName).toBe("STRONG");
    expect(screen.getByText("/points").tagName).toBe("CODE");
    expect(container.textContent).not.toMatch(/[*#`]/);
  });

  it("opens external links in a new tab and refuses unsafe URLs", () => {
    renderMessage(
      "[Linktree](https://linktr.ee/vsa) and [bad](javascript:alert(1)) and [proto](//evil.test)",
    );

    const external = screen.getByRole("link", { name: "Linktree" });
    expect(external).toHaveAttribute("target", "_blank");
    expect(external).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByRole("link", { name: "bad" })).toBeNull();
    expect(screen.queryByRole("link", { name: "proto" })).toBeNull();
  });

  it("encodes link URLs without double-encoding existing escapes", () => {
    renderMessage(
      '[form](https://forms.gle/a%20b"x) and [sneaky](/\\evil.test)',
    );

    expect(screen.getByRole("link", { name: "form" })).toHaveAttribute(
      "href",
      "https://forms.gle/a%20b%22x",
    );
    // A backslash would let "/\host" act like "//host"; it stays in-app.
    expect(screen.getByRole("link", { name: "sneaky" })).toHaveAttribute(
      "href",
      "/%5Cevil.test",
    );
  });

  it("strips unbalanced bold markers left by a truncated answer", () => {
    const { container } = renderMessage("**Note: applications open soon");
    expect(container.textContent).toBe("Note: applications open soon");
  });

  it("leaves ordinary asterisks in math-like text alone and keeps paragraphs", () => {
    const blocks = parseBlocks("First line\nsecond line\n\nNew paragraph");
    expect(blocks).toEqual([
      { type: "paragraph", lines: ["First line", "second line"] },
      { type: "paragraph", lines: ["New paragraph"] },
    ]);
    expect(normalizeAssistantText("2 * 3 = 6")).toBe("2 * 3 = 6");
  });
});
