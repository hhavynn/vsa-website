import { fireEvent, render, screen } from "@testing-library/react";
import { PresidentsMessageSection, presidentInitials } from "./PresidentsMessage";
import type { PresidentsContent } from "../../../data/presidentsContent";

const content = (over: Partial<PresidentsContent> = {}): PresidentsContent => ({
  names: "Fictional Anh & Fictional Bao",
  role: "Co-Presidents",
  message: "A heading\n\nA paragraph.",
  photoUrl: "/images/home/fictional-presidents.webp",
  photoThumbnailUrl: "",
  ...over,
});

describe("presidents letter photo", () => {
  it("derives the placeholder initials from the presidents' names", () => {
    expect(presidentInitials("April Pham & Havyn Nguyen")).toBe("A + H");
    expect(presidentInitials("Anh Tran and Bao Le")).toBe("A + B");
    expect(presidentInitials("Solo President")).toBe("S");
  });

  it("falls back to the initials when the photo fails to load", () => {
    render(<PresidentsMessageSection content={content()} />);
    fireEvent.error(screen.getByAltText("Fictional Anh & Fictional Bao"));
    expect(screen.queryByAltText("Fictional Anh & Fictional Bao")).not.toBeInTheDocument();
    expect(screen.getByText("F + F")).toBeInTheDocument();
  });

  it("shows the initials when there is no photo", () => {
    render(<PresidentsMessageSection content={content({ photoUrl: "" })} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("F + F")).toBeInTheDocument();
  });
});
