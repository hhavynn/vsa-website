import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import toast from "react-hot-toast";
import { SchoolLogoField } from "./SchoolLogoField";
import { OWN_LOGO_URL } from "../../../test-utils/uvsaFixtures";

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

const school = { slug: "ucsd", short_name: "UCSD" };
const png = () => new File(["x"], "pfp.png", { type: "image/png" });
const fileInput = () =>
  screen.getByLabelText("Upload school logo file") as HTMLInputElement;

function setup(value = "") {
  const onChange = jest.fn();
  const onUpload = jest.fn().mockResolvedValue(OWN_LOGO_URL);
  render(
    <SchoolLogoField
      school={school}
      value={value}
      onChange={onChange}
      onUpload={onUpload}
    />,
  );
  return { onChange, onUpload };
}

describe("SchoolLogoField", () => {
  it("shows a placeholder preview, Upload Image, a URL field, and a disabled Remove when empty", () => {
    setup();
    expect(screen.getByText("School Logo / Instagram PFP")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "UCSD logo placeholder" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Upload Image" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/paste image url/i)).toHaveValue("");
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
  });

  it("previews the current logo", () => {
    setup(OWN_LOGO_URL);
    expect(screen.getByAltText("UCSD logo")).toHaveAttribute(
      "src",
      OWN_LOGO_URL,
    );
    expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
  });

  it("uploads a chosen file and writes the public URL into the form", async () => {
    const { onChange, onUpload } = setup();
    const file = png();
    fireEvent.change(fileInput(), { target: { files: [file] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(OWN_LOGO_URL));
    expect(onUpload).toHaveBeenCalledWith(file);
    expect(toast.success).toHaveBeenCalled();
  });

  it("rejects an unsupported file type before uploading", () => {
    const { onChange, onUpload } = setup();
    fireEvent.change(fileInput(), {
      target: {
        files: [new File(["x"], "logo.svg", { type: "image/svg+xml" })],
      },
    });
    expect(onUpload).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/PNG, JPG, or WebP/),
    );
  });

  it("keeps the existing logo and reports an error when the upload fails", async () => {
    const onChange = jest.fn();
    const onUpload = jest.fn().mockRejectedValue(new Error("boom"));
    render(
      <SchoolLogoField
        school={school}
        value={OWN_LOGO_URL}
        onChange={onChange}
        onUpload={onUpload}
      />,
    );

    fireEvent.change(fileInput(), { target: { files: [png()] } });

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("accepts a pasted URL", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText(/paste image url/i), {
      target: { value: "https://cdn.example.com/a.png" },
    });
    expect(onChange).toHaveBeenCalledWith("https://cdn.example.com/a.png");
  });

  it("clears the logo on Remove", () => {
    const { onChange } = setup(OWN_LOGO_URL);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("warns when the pasted URL could not be shown publicly", () => {
    setup("http://insecure.example.com/a.png");
    expect(screen.getByRole("alert")).toHaveTextContent(
      /can’t be shown publicly/i,
    );
  });
});
