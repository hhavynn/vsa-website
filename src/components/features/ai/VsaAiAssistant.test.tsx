import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { FALLBACK_ASK_VSA } from "../../../config/publicFallbackContent";
import { VsaAiAssistant } from "./VsaAiAssistant";

interface RequestBody {
  message: string;
  sessionId: string;
  recentTurns: Array<{ role: "user" | "assistant"; content: string }>;
  currentPage: string;
}

const originalFetch = globalThis.fetch;
const originalScrollTo = HTMLElement.prototype.scrollTo;
let requests: RequestBody[];
let consoleError: jest.SpyInstance;

function response(
  answer: string,
  status = "answered",
  httpStatus = 200,
): Response {
  return {
    ok: httpStatus >= 200 && httpStatus < 300,
    status: httpStatus,
    json: async () => ({ answer, status, sources: [] }),
  } as Response;
}

function backend(reply: (body: RequestBody, index: number) => Response) {
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as RequestBody;
    requests.push(body);
    return reply(body, requests.length - 1);
  };
}

async function openAssistant() {
  render(
    <MemoryRouter>
      <VsaAiAssistant />
    </MemoryRouter>,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Ask VSA (open assistant)" }),
  );
}

async function ask(message: string) {
  fireEvent.change(
    screen.getByRole("textbox", { name: "Ask VSA a question" }),
    {
      target: { value: message },
    },
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Send Ask VSA message" }),
  );
  await waitFor(() =>
    expect(screen.queryByText("Checking VSA info...")).not.toBeInTheDocument(),
  );
}

beforeEach(() => {
  requests = [];
  localStorage.clear();
  HTMLElement.prototype.scrollTo = () => undefined;
  consoleError = jest
    .spyOn(console, "error")
    .mockImplementation(() => undefined);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  HTMLElement.prototype.scrollTo = originalScrollTo;
  consoleError.mockRestore();
});

it("keeps the full answer visible while follow-up history satisfies the server limit", async () => {
  const longAnswer = "Approved VSA information. ".repeat(40);
  backend((body, index) => {
    if (body.recentTurns.some((turn) => turn.content.length > 500)) {
      return response("", "error", 400);
    }
    return response(
      index === 0 ? longAnswer : "You can attend a public event.",
    );
  });
  await openAssistant();
  await ask("What is VSA?");
  expect(screen.getByText(longAnswer.trim())).toBeInTheDocument();

  await ask("How can I join?");

  expect(
    screen.getByText("You can attend a public event."),
  ).toBeInTheDocument();
  expect(requests[1].recentTurns).toEqual([
    { role: "user", content: "What is VSA?" },
    { role: "assistant", content: longAnswer.slice(0, 500) },
  ]);
  expect(
    screen.queryByRole("button", { name: "Retry" }),
  ).not.toBeInTheDocument();
});

it("retries the failed question once using only the conversation before that question", async () => {
  backend((_body, index) => {
    if (index === 0) return response("VSA is open to all students.");
    if (index === 1) throw new TypeError("Network unavailable");
    return response("Check the Events page.");
  });
  await openAssistant();
  await ask("What is VSA?");
  await ask("What events are coming up?");
  await userEvent.click(screen.getByRole("button", { name: "Retry" }));

  expect(await screen.findByText("Check the Events page.")).toBeInTheDocument();
  expect(screen.getAllByText("What events are coming up?")).toHaveLength(1);
  expect(screen.queryByText(FALLBACK_ASK_VSA.message)).not.toBeInTheDocument();
  expect(requests[2].message).toBe("What events are coming up?");
  expect(requests[2].recentTurns).toEqual([
    { role: "user", content: "What is VSA?" },
    { role: "assistant", content: "VSA is open to all students." },
  ]);
});

it("renders one failure message and announces it through one live region", async () => {
  backend(() => response("", "error", 503));
  await openAssistant();
  await ask("What is VSA?");

  expect(screen.getAllByText(FALLBACK_ASK_VSA.message)).toHaveLength(1);
  expect(screen.getByRole("status")).toHaveTextContent(
    FALLBACK_ASK_VSA.message,
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
});

it("does not send error or rate-limit messages back as approved conversation history", async () => {
  backend((_body, index) => {
    if (index === 0) return response("", "error", 500);
    if (index === 1) return response("Try again later.", "rate_limited", 429);
    return response("VSA welcomes all students.");
  });
  await openAssistant();
  await ask("What is ACE?");
  await ask("What is a House?");
  await ask("What is VSA?");

  expect(screen.getByText("VSA welcomes all students.")).toBeInTheDocument();
  expect(requests[2].recentTurns).toEqual([
    { role: "user", content: "What is ACE?" },
    { role: "user", content: "What is a House?" },
  ]);
});

it("labels who is speaking in text, not only by bubble colour and side", async () => {
  backend(() => response("VSA is open to all students."));
  await openAssistant();
  await ask("What is VSA?");

  // eslint-disable-next-line testing-library/no-node-access -- locating the message group around a bubble
  const yourTurn = screen.getByText("What is VSA?").closest(".max-w-\\[88\\%\\]") as HTMLElement;
  expect(within(yourTurn).getByText("You")).toBeInTheDocument();
  const answer = screen.getByText("VSA is open to all students.");
  // eslint-disable-next-line testing-library/no-node-access -- locating the message group around a bubble
  const answerTurn = answer.closest(".max-w-\\[88\\%\\]") as HTMLElement;
  expect(within(answerTurn).getByText("Ask VSA")).toBeInTheDocument();
});

it("links to real alternatives after rate limits, temporary disablement, and fallback", async () => {
  backend((_body, index) => {
    if (index === 0) return response("Give Ask VSA about five minutes, or browse Events.", "rate_limited", 429);
    if (index === 1) return response("Ask VSA is taking a break right now.", "unavailable", 200);
    return response("Some live site data is unavailable right now.", "fallback");
  });
  await openAssistant();
  await ask("What's happening this week?");
  await ask("How do I join?");
  await ask("What is VCN?");

  expect(screen.getByText(/five minutes/)).toBeInTheDocument();
  expect(screen.getByText("Taking a break")).toBeInTheDocument();
  expect(screen.getByText("Not sure yet")).toBeInTheDocument();

  const navs = screen.getAllByRole("navigation", { name: "Other ways to get VSA information" });
  expect(navs).toHaveLength(3);
  for (const nav of navs) {
    expect(within(nav).getByRole("link", { name: "Events" })).toHaveAttribute("href", "/events");
    expect(within(nav).getByRole("link", { name: "Get Involved" })).toHaveAttribute("href", "/get-involved");
    expect(within(nav).getByRole("link", { name: "Points" })).toHaveAttribute("href", "/points");
    expect(within(nav).getByRole("link", { name: "Send feedback" })).toHaveAttribute("href", "/feedback");
  }
  expect(requests[2].recentTurns).toEqual([
    { role: "user", content: "What's happening this week?" },
    { role: "user", content: "How do I join?" },
  ]);
});

it("offers links on network errors while preserving Retry", async () => {
  backend(() => response("", "error", 503));
  await openAssistant();
  await ask("What events are happening?");
  expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  const nav = screen.getByRole("navigation", { name: "Other ways to get VSA information" });
  expect(within(nav).getByRole("link", { name: "Events" })).toHaveAttribute("href", "/events");
});
