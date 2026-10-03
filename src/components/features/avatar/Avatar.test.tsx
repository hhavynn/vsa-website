import { render, screen } from "@testing-library/react";
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
});
