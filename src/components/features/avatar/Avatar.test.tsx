import { fireEvent, render, screen } from "@testing-library/react";
import { Avatar } from "./Avatar";

describe("public member avatar", () => {
  it("renders an approved photo without an authenticated session", () => {
    const { rerender } = render(
      <Avatar avatarUrl="/images/approved-avatar.webp" />,
    );
    expect(screen.getByAltText("")).toHaveAttribute(
      "src",
      "/images/approved-avatar.webp",
    );

    rerender(<Avatar avatarUrl={null} />);
    expect(screen.queryByAltText("")).not.toBeInTheDocument();
  });

  it("shows the silhouette instead of a broken image when the photo fails to load", () => {
    render(<Avatar avatarUrl="/images/removed-avatar.webp" />);
    fireEvent.error(screen.getByAltText(""));
    expect(screen.queryByAltText("")).not.toBeInTheDocument();
    expect(screen.getByTestId("avatar-placeholder")).toBeInTheDocument();
  });
});
