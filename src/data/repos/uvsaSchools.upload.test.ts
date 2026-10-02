import { uvsaSchoolsRepository } from "./uvsaSchools";
import { ValidationError } from "../errors";

const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockFrom = jest.fn();
jest.mock("../../lib/supabase", () => ({
  supabase: {
    storage: {
      from: (bucket: string) => {
        mockFrom(bucket);
        return {
          upload: (...args: unknown[]) => mockUpload(...args),
          getPublicUrl: (...args: unknown[]) => mockGetPublicUrl(...args),
        };
      },
    },
  },
}));
const mockPrepare = jest.fn();
jest.mock("../../lib/imageUpload", () => ({
  prepareImageForUpload: (...args: unknown[]) => mockPrepare(...args),
  getUploadExtension: () => "webp",
}));

// jsdom (Jest 27) has no Web Crypto; browsers do.
let uuidCounter = 0;
Object.defineProperty(globalThis, "crypto", {
  configurable: true,
  value: {
    randomUUID: () =>
      `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, "0")}`,
  },
});

const png = () => new File(["bytes"], "pfp.png", { type: "image/png" });

beforeEach(() => {
  jest.clearAllMocks();
  mockPrepare.mockImplementation(async (file: File) => ({
    file: new File([file], "pfp.webp", { type: "image/webp" }),
  }));
  mockUpload.mockResolvedValue({ error: null });
  mockGetPublicUrl.mockImplementation((path: string) => ({
    data: {
      publicUrl: `https://test.supabase.co/storage/v1/object/public/uvsa_school_assets/${path}`,
    },
  }));
});

describe("uvsaSchoolsRepository.uploadSchoolLogo", () => {
  it("compresses with the logo preset and uploads under the school slug in the dedicated bucket", async () => {
    const url = await uvsaSchoolsRepository.uploadSchoolLogo("ucsd", png());

    expect(mockPrepare).toHaveBeenCalledWith(expect.any(File), "logo");
    expect(mockFrom).toHaveBeenCalledWith("uvsa_school_assets");
    const [path, file, options] = mockUpload.mock.calls[0];
    expect(path).toMatch(/^ucsd\/logo-[\w-]+\.webp$/);
    expect(file.type).toBe("image/webp");
    expect(options).toMatchObject({
      contentType: "image/webp",
      cacheControl: "31536000",
    });
    expect(url).toBe(
      `https://test.supabase.co/storage/v1/object/public/uvsa_school_assets/${path}`,
    );
  });

  it("never overwrites an existing object (unique path, no upsert)", async () => {
    await uvsaSchoolsRepository.uploadSchoolLogo("ucsd", png());
    await uvsaSchoolsRepository.uploadSchoolLogo("ucsd", png());
    expect(mockUpload.mock.calls[0][0]).not.toBe(mockUpload.mock.calls[1][0]);
    expect(mockUpload.mock.calls[0][2]).not.toHaveProperty("upsert");
  });

  it("rejects unsupported types without touching storage", async () => {
    const svg = new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" });
    await expect(
      uvsaSchoolsRepository.uploadSchoolLogo("ucsd", svg),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("surfaces storage errors", async () => {
    mockUpload.mockResolvedValue({
      error: {
        message: "new row violates row-level security policy",
        code: "42501",
        details: "",
      },
    });
    await expect(
      uvsaSchoolsRepository.uploadSchoolLogo("ucsd", png()),
    ).rejects.toBeDefined();
    expect(mockGetPublicUrl).not.toHaveBeenCalled();
  });

  it("refuses an empty slug", async () => {
    await expect(
      uvsaSchoolsRepository.uploadSchoolLogo("  ", png()),
    ).rejects.toBeDefined();
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
