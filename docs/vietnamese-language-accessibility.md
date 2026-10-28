# Vietnamese text and screen-reader language (#318)

Public pages default to `<html lang="en">`. An English-language page remains
English even if a sentence includes Vietnamese. **Only confirmed Vietnamese
passages and titles** should use `lang="vi"`, per WCAG 2.2 success criterion
3.1.2 (Language of Parts).

Use the existing `<VietnameseText>…</VietnameseText>` component for static
Vietnamese phrases; it renders a span with `lang="vi"` and does not alter
typography. A Vietnamese personal name alone is not sufficient evidence that an
entire sentence or card is Vietnamese, and language detection based on
diacritics or word lists is deliberately **not** implemented.

## Current site examples

- ACE uses explicit language markers for `Anh Chị Em`, `Gia Đình` and the
  documented Big/Little Vietnamese terms.
- The homepage Wrapped section marks the Vietnamese VCN song title.
- The VCN explainer, current-show (including its unpublished/coming-soon
  view) and production archive display the *established* Vietnamese name,
  `Đêm Văn Hóa Việt Nam`, via `VCNNativeName`.

The last name is backed by the existing VCN knowledge-base seed in
`supabase/migrations/20260704000001_ai_knowledge_v2_dedupe.sql`. This is
not an automatically guessed translation.

## Admin-entered and ambiguous content

Do **not** tag all event titles, VCN production names, member names, or free-text
event descriptions as Vietnamese. The existing database fields do not contain
a reviewed language flag. Future editorial work can add an **explicit
administrator-selected language field** and then render only rows marked `vi`
with that attribute. Until that contract and its review workflow exist,
leave dynamically entered content unclassified rather than running unreliable
text detection. This applies to mixed English/Vietnamese show titles as well.

The automated regression suite in `src/routes/accessibility.language.test.tsx`
checks static language markers and protects the English page wrapper. Manual
VoiceOver/Safari pronunciation checks remain necessary before treating #318
as fully accepted.
