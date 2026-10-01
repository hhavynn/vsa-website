import {
  type PresidentsContent,
  splitPresidentsMessage,
} from "../../../data/presidentsContent";
import {
  getSupabaseImageSrcSet,
  getSupabaseImageUrl,
} from "../../../lib/supabaseImages";

/**
 * The homepage presidents letter. Shared by the homepage and the admin
 * "Preview As Public" dialog so a draft renders with the real layout.
 */
export function PresidentsMessageSection({
  content,
}: {
  content: PresidentsContent;
}) {
  const presidentParagraphs = splitPresidentsMessage(content.message);
  const [presidentsHeading, ...presidentsBody] = presidentParagraphs;
  const possibleSignature = presidentsBody[presidentsBody.length - 1];
  const signatureLines =
    possibleSignature
      ?.split("\n")
      .map((line) => line.trim())
      .filter(Boolean) ?? [];
  const hasSignatureBlock =
    signatureLines.length >= 2 &&
    signatureLines[0].toLowerCase().startsWith("with love");
  const presidentBodyParagraphs = hasSignatureBlock
    ? presidentsBody.slice(0, -1)
    : presidentsBody;
  const signatureName = content.names;
  const signatureRole = content.role;
  const presidentsPhotoUrl = content.photoThumbnailUrl || content.photoUrl;

  return (
    <section className="vsa-message-section scrapbook-board">
      <div className="vsa-container">
        <div className="grid gap-12 lg:grid-cols-[1fr_240px] lg:items-start">
          <div className="scrapbook-paper p-6 sm:p-8 scrapbook-rotate-sm-left">
            <span className="scrapbook-pin" aria-hidden />
            <div className="vsa-section-label">Presidents</div>
            <h2 className="vsa-section-title max-w-[720px]">
              {presidentsHeading}
            </h2>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {presidentBodyParagraphs.map((paragraph, index) => (
                <p
                  key={`${paragraph.slice(0, 24)}-${index}`}
                  className="whitespace-pre-line font-sans text-sm leading-[1.9]"
                  style={{ color: "var(--text2)" }}
                >
                  {paragraph}
                </p>
              ))}
            </div>
            {hasSignatureBlock && (
              <div
                className="mt-7 border-t pt-5"
                style={{ borderColor: "var(--border)" }}
              >
                <div
                  className="font-sans text-sm"
                  style={{ color: "var(--text3)" }}
                >
                  {signatureLines[0]}
                </div>
                <div
                  className="mt-1 font-serif text-xl italic"
                  style={{ color: "var(--color-accent-text)" }}
                >
                  {signatureName}
                </div>
                <div
                  className="mt-1 font-sans text-[11px] uppercase tracking-[0.08em]"
                  style={{ color: "var(--text3)" }}
                >
                  {signatureRole}
                </div>
              </div>
            )}
          </div>
          <div>
            {presidentsPhotoUrl ? (
              <div className="scrapbook-photo rotate-[1.5deg]">
                <img
                  src={getSupabaseImageUrl(presidentsPhotoUrl, {
                    width: 440,
                    height: 586,
                    resize: "cover",
                    quality: 74,
                  })}
                  srcSet={getSupabaseImageSrcSet(
                    presidentsPhotoUrl,
                    [320, 440, 640],
                    {
                      resize: "cover",
                      quality: 74,
                    },
                  )}
                  sizes="(min-width: 1024px) 220px, 70vw"
                  alt={content.names}
                  className="aspect-[3/4] w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ) : (
              <div className="scrapbook-photo flex aspect-[3/4] items-center justify-center">
                <span
                  className="font-serif text-[28px] italic"
                  style={{ color: "var(--text3)" }}
                >
                  A + H
                </span>
              </div>
            )}
            <div
              className="mt-3 border-t py-3"
              style={{ borderColor: "var(--border)" }}
            >
              <div
                className="font-sans text-sm font-semibold"
                style={{ color: "var(--text)" }}
              >
                {content.names}
              </div>
              <div
                className="mt-1 font-sans text-[11px] uppercase tracking-[0.07em]"
                style={{ color: "var(--text3)" }}
              >
                {content.role}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
