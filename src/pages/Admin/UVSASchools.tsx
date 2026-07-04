import { ComponentType, FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import toast from "react-hot-toast";
import {
  FaExternalLinkAlt,
  FaPen,
  FaPlus,
  FaSave,
  FaTimes,
  FaTrash,
} from "react-icons/fa";
import { IconBaseProps } from "react-icons";
import { PageTitle } from "../../components/common/PageTitle";
import { Button } from "../../components/ui/Button";
import {
  DEFAULT_UVSA_NETWORK_PAGE_SETTINGS,
  UVSANetworkPageSettingsInput,
  uvsaNetworkSettingsRepository,
} from "../../data/repos/uvsaNetworkSettings";
import { uvsaSchoolsRepository } from "../../data/repos/uvsaSchools";
import { UVSAConfidenceLevel, UVSASchool, UVSASystemType } from "../../types";

const SYSTEM_TYPES: UVSASystemType[] = ["UC", "CSU", "Private"];
const CONFIDENCE_LEVELS: UVSAConfidenceLevel[] = ["high", "medium", "low"];
const settingsQueryKey = ["uvsa-network-page-settings"];
const schoolsQueryKey = ["admin-uvsa-schools"];
const publicSchoolsQueryKey = ["uvsa-schools"];
const ExternalLinkAltIcon = FaExternalLinkAlt as ComponentType<IconBaseProps>;
const PenIcon = FaPen as ComponentType<IconBaseProps>;
const PlusIcon = FaPlus as ComponentType<IconBaseProps>;
const SaveIcon = FaSave as ComponentType<IconBaseProps>;
const TimesIcon = FaTimes as ComponentType<IconBaseProps>;
const TrashIcon = FaTrash as ComponentType<IconBaseProps>;

type SchoolForm = {
  id?: string;
  school_name: string;
  short_name: string;
  slug: string;
  system_type: UVSASystemType;
  city: string;
  vsa_name: string;
  instagram_url: string;
  linktree_url: string;
  website_url: string;
  facebook_url: string;
  youtube_url: string;
  tiktok_url: string;
  description: string;
  known_for: string;
  recurring_events: string;
  logo_url: string;
  image_url: string;
  confidence_level: UVSAConfidenceLevel;
  verification_notes: string;
  is_active: boolean;
  sort_order: number;
};

const emptySchoolForm: SchoolForm = {
  school_name: "",
  short_name: "",
  slug: "",
  system_type: "UC",
  city: "",
  vsa_name: "",
  instagram_url: "",
  linktree_url: "",
  website_url: "",
  facebook_url: "",
  youtube_url: "",
  tiktok_url: "",
  description: "",
  known_for: "",
  recurring_events: "",
  logo_url: "",
  image_url: "",
  confidence_level: "high",
  verification_notes: "",
  is_active: true,
  sort_order: 0,
};

const labelCls =
  "block text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary";
const inputCls =
  "mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary shadow-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20";

function toNullable(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToText(value: string[] | null | undefined) {
  return (value || []).join("\n");
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getNextSchoolFormWithShortName(
  form: SchoolForm,
  shortName: string,
): SchoolForm {
  const currentGeneratedSlug = slugify(form.short_name);
  const shouldSyncSlug =
    form.slug.trim().length === 0 || form.slug === currentGeneratedSlug;

  return {
    ...form,
    short_name: shortName,
    slug: shouldSyncSlug ? slugify(shortName) : form.slug,
  };
}

function schoolToForm(school: UVSASchool): SchoolForm {
  return {
    id: school.id,
    school_name: school.school_name,
    short_name: school.short_name,
    slug: school.slug,
    system_type: school.system_type,
    city: school.city || "",
    vsa_name: school.vsa_name || "",
    instagram_url: school.instagram_url || "",
    linktree_url: school.linktree_url || "",
    website_url: school.website_url || "",
    facebook_url: school.facebook_url || "",
    youtube_url: school.youtube_url || "",
    tiktok_url: school.tiktok_url || "",
    description: school.description || "",
    known_for: listToText(school.known_for),
    recurring_events: listToText(school.recurring_events),
    logo_url: school.logo_url || "",
    image_url: school.image_url || "",
    confidence_level: school.confidence_level,
    verification_notes: school.verification_notes || "",
    is_active: school.is_active,
    sort_order: school.sort_order,
  };
}

function formToSchool(form: SchoolForm): Partial<UVSASchool> {
  return {
    ...(form.id ? { id: form.id } : {}),
    school_name: form.school_name.trim(),
    short_name: form.short_name.trim(),
    slug: slugify(form.slug || form.short_name),
    system_type: form.system_type,
    city: toNullable(form.city),
    vsa_name: toNullable(form.vsa_name),
    instagram_url: toNullable(form.instagram_url),
    linktree_url: toNullable(form.linktree_url),
    website_url: toNullable(form.website_url),
    facebook_url: toNullable(form.facebook_url),
    youtube_url: toNullable(form.youtube_url),
    tiktok_url: toNullable(form.tiktok_url),
    description: toNullable(form.description),
    known_for: toList(form.known_for),
    recurring_events: toList(form.recurring_events),
    logo_url: toNullable(form.logo_url),
    image_url: toNullable(form.image_url),
    confidence_level: form.confidence_level,
    verification_notes: toNullable(form.verification_notes),
    is_active: form.is_active,
    sort_order: form.sort_order,
  };
}

function settingsToInput(
  settings: typeof DEFAULT_UVSA_NETWORK_PAGE_SETTINGS,
): UVSANetworkPageSettingsInput {
  const { updated_at: _updatedAt, ...input } = settings;
  return input;
}

export default function AdminUVSASchools() {
  const queryClient = useQueryClient();
  const [schoolForm, setSchoolForm] = useState<SchoolForm>(emptySchoolForm);
  const [settingsForm, setSettingsForm] =
    useState<UVSANetworkPageSettingsInput>(
      settingsToInput(DEFAULT_UVSA_NETWORK_PAGE_SETTINGS),
    );
  const [isEditingSchool, setIsEditingSchool] = useState(false);

  const schoolsQuery = useQuery(schoolsQueryKey, () =>
    uvsaSchoolsRepository.getAllSchools(),
  );
  const settingsQuery = useQuery(settingsQueryKey, () =>
    uvsaNetworkSettingsRepository.getSettings(),
  );

  useEffect(() => {
    if (settingsQuery.data) {
      setSettingsForm(settingsToInput(settingsQuery.data));
    }
  }, [settingsQuery.data]);

  const sortedSchools = useMemo(
    () =>
      [...(schoolsQuery.data || [])].sort(
        (a, b) =>
          a.sort_order - b.sort_order ||
          a.short_name.localeCompare(b.short_name),
      ),
    [schoolsQuery.data],
  );

  const saveSchoolMutation = useMutation(
    (form: SchoolForm) =>
      uvsaSchoolsRepository.upsertSchool(formToSchool(form)),
    {
      onSuccess: () => {
        toast.success("UVSA school saved");
        queryClient.invalidateQueries(schoolsQueryKey);
        queryClient.invalidateQueries(publicSchoolsQueryKey);
        setSchoolForm(emptySchoolForm);
        setIsEditingSchool(false);
      },
      onError: () => {
        toast.error("Unable to save UVSA school");
      },
    },
  );

  const deleteSchoolMutation = useMutation(
    (id: string) => uvsaSchoolsRepository.deleteSchool(id),
    {
      onSuccess: () => {
        toast.success("UVSA school deleted");
        queryClient.invalidateQueries(schoolsQueryKey);
        queryClient.invalidateQueries(publicSchoolsQueryKey);
      },
      onError: () => {
        toast.error("Unable to delete UVSA school");
      },
    },
  );

  const saveSettingsMutation = useMutation(
    (form: UVSANetworkPageSettingsInput) =>
      uvsaNetworkSettingsRepository.updateSettings(form),
    {
      onSuccess: () => {
        toast.success("UVSA network page copy saved");
        queryClient.invalidateQueries(settingsQueryKey);
      },
      onError: () => {
        toast.error("Unable to save page copy");
      },
    },
  );

  const handleSchoolSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!schoolForm.school_name.trim() || !schoolForm.short_name.trim()) {
      toast.error("School name and short name are required");
      return;
    }
    saveSchoolMutation.mutate({
      ...schoolForm,
      slug: slugify(schoolForm.slug || schoolForm.short_name),
    });
  };

  const handleSettingsSubmit = (event: FormEvent) => {
    event.preventDefault();
    saveSettingsMutation.mutate(settingsForm);
  };

  const startEdit = (school: UVSASchool) => {
    setSchoolForm(schoolToForm(school));
    setIsEditingSchool(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmDelete = (school: UVSASchool) => {
    if (
      window.confirm(`Delete ${school.short_name} from the UVSA network page?`)
    ) {
      deleteSchoolMutation.mutate(school.id);
    }
  };

  return (
    <>
      <PageTitle title="UVSA Network Admin" />
      <div className="min-h-screen bg-bg px-4 py-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
                Public content
              </p>
              <h1 className="mt-2 font-serif text-3xl text-text-primary sm:text-4xl">
                UVSA Network
              </h1>
            </div>
            <a
              href="/uvsa-network"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface2"
            >
              View public page <ExternalLinkAltIcon size={12} />
            </a>
          </header>

          <form
            onSubmit={handleSettingsSubmit}
            className="rounded-md border border-border bg-surface p-5 shadow-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-serif text-2xl text-text-primary">
                  Page copy
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Edit the hero, intro, section headings, stat chips, and empty
                  states.
                </p>
              </div>
              <Button
                type="submit"
                className="gap-2"
                loading={saveSettingsMutation.isLoading}
              >
                <SaveIcon size={14} /> Save copy
              </Button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField
                label="Hero kicker"
                value={settingsForm.hero_kicker}
                onChange={(hero_kicker) =>
                  setSettingsForm({ ...settingsForm, hero_kicker })
                }
              />
              <TextField
                label="Hero title"
                value={settingsForm.hero_title}
                onChange={(hero_title) =>
                  setSettingsForm({ ...settingsForm, hero_title })
                }
              />
              <TextField
                label="Hero emphasis"
                value={settingsForm.hero_emphasis}
                onChange={(hero_emphasis) =>
                  setSettingsForm({ ...settingsForm, hero_emphasis })
                }
              />
              <TextField
                label="Intro heading"
                value={settingsForm.intro_heading}
                onChange={(intro_heading) =>
                  setSettingsForm({ ...settingsForm, intro_heading })
                }
              />
              <TextareaField
                label="Hero description"
                value={settingsForm.hero_description}
                onChange={(hero_description) =>
                  setSettingsForm({ ...settingsForm, hero_description })
                }
              />
              <TextareaField
                label="Intro body"
                value={settingsForm.intro_body}
                onChange={(intro_body) =>
                  setSettingsForm({ ...settingsForm, intro_body })
                }
              />
              <TextareaField
                label="Intro note"
                value={settingsForm.intro_note}
                onChange={(intro_note) =>
                  setSettingsForm({ ...settingsForm, intro_note })
                }
              />
              <TextareaField
                label="Showcase description"
                value={settingsForm.showcase_description}
                onChange={(showcase_description) =>
                  setSettingsForm({ ...settingsForm, showcase_description })
                }
              />
              <TextField
                label="School stat label"
                value={settingsForm.stat_school_count_label}
                onChange={(stat_school_count_label) =>
                  setSettingsForm({ ...settingsForm, stat_school_count_label })
                }
              />
              <TextField
                label="Competitions stat label"
                value={settingsForm.stat_competitions_label}
                onChange={(stat_competitions_label) =>
                  setSettingsForm({ ...settingsForm, stat_competitions_label })
                }
              />
              <TextField
                label="Community stat label"
                value={settingsForm.stat_community_label}
                onChange={(stat_community_label) =>
                  setSettingsForm({ ...settingsForm, stat_community_label })
                }
              />
              <TextField
                label="Upcoming heading"
                value={settingsForm.upcoming_heading}
                onChange={(upcoming_heading) =>
                  setSettingsForm({ ...settingsForm, upcoming_heading })
                }
              />
              <TextField
                label="Showcase heading"
                value={settingsForm.showcase_heading}
                onChange={(showcase_heading) =>
                  setSettingsForm({ ...settingsForm, showcase_heading })
                }
              />
              <TextField
                label="Schools heading"
                value={settingsForm.schools_heading}
                onChange={(schools_heading) =>
                  setSettingsForm({ ...settingsForm, schools_heading })
                }
              />
              <TextareaField
                label="Empty state title"
                value={settingsForm.empty_state_title}
                onChange={(empty_state_title) =>
                  setSettingsForm({ ...settingsForm, empty_state_title })
                }
              />
              <TextareaField
                label="Empty state message"
                value={settingsForm.empty_state_message}
                onChange={(empty_state_message) =>
                  setSettingsForm({ ...settingsForm, empty_state_message })
                }
              />
            </div>
          </form>

          <form
            onSubmit={handleSchoolSubmit}
            className="rounded-md border border-border bg-surface p-5 shadow-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-serif text-2xl text-text-primary">
                  {isEditingSchool
                    ? `Edit ${schoolForm.short_name}`
                    : "Add school"}
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Manage logos, descriptions, social links, tags, and display
                  order.
                </p>
              </div>
              <div className="flex gap-2">
                {isEditingSchool && (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      setSchoolForm(emptySchoolForm);
                      setIsEditingSchool(false);
                    }}
                  >
                    <TimesIcon size={14} /> Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  className="gap-2"
                  loading={saveSchoolMutation.isLoading}
                >
                  {isEditingSchool ? (
                    <SaveIcon size={14} />
                  ) : (
                    <PlusIcon size={14} />
                  )}
                  {isEditingSchool ? "Save school" : "Add school"}
                </Button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField
                label="School name"
                value={schoolForm.school_name}
                onChange={(school_name) =>
                  setSchoolForm({ ...schoolForm, school_name })
                }
              />
              <TextField
                label="Short name"
                value={schoolForm.short_name}
                onChange={(short_name) =>
                  setSchoolForm(
                    getNextSchoolFormWithShortName(schoolForm, short_name),
                  )
                }
              />
              <TextField
                label="Slug"
                value={schoolForm.slug}
                onChange={(slug) =>
                  setSchoolForm({ ...schoolForm, slug: slugify(slug) })
                }
              />
              <SelectField
                label="System type"
                value={schoolForm.system_type}
                options={SYSTEM_TYPES}
                onChange={(system_type) =>
                  setSchoolForm({ ...schoolForm, system_type })
                }
              />
              <TextField
                label="City"
                value={schoolForm.city}
                onChange={(city) => setSchoolForm({ ...schoolForm, city })}
              />
              <TextField
                label="VSA name"
                value={schoolForm.vsa_name}
                onChange={(vsa_name) =>
                  setSchoolForm({ ...schoolForm, vsa_name })
                }
              />
              <TextField
                label="Logo URL"
                value={schoolForm.logo_url}
                onChange={(logo_url) =>
                  setSchoolForm({ ...schoolForm, logo_url })
                }
              />
              <TextField
                label="Image URL"
                value={schoolForm.image_url}
                onChange={(image_url) =>
                  setSchoolForm({ ...schoolForm, image_url })
                }
              />
              <TextField
                label="Instagram URL"
                value={schoolForm.instagram_url}
                onChange={(instagram_url) =>
                  setSchoolForm({ ...schoolForm, instagram_url })
                }
              />
              <TextField
                label="Linktree URL"
                value={schoolForm.linktree_url}
                onChange={(linktree_url) =>
                  setSchoolForm({ ...schoolForm, linktree_url })
                }
              />
              <TextField
                label="Website URL"
                value={schoolForm.website_url}
                onChange={(website_url) =>
                  setSchoolForm({ ...schoolForm, website_url })
                }
              />
              <TextField
                label="Facebook URL"
                value={schoolForm.facebook_url}
                onChange={(facebook_url) =>
                  setSchoolForm({ ...schoolForm, facebook_url })
                }
              />
              <TextField
                label="YouTube URL"
                value={schoolForm.youtube_url}
                onChange={(youtube_url) =>
                  setSchoolForm({ ...schoolForm, youtube_url })
                }
              />
              <TextField
                label="TikTok URL"
                value={schoolForm.tiktok_url}
                onChange={(tiktok_url) =>
                  setSchoolForm({ ...schoolForm, tiktok_url })
                }
              />
              <TextareaField
                label="Description"
                value={schoolForm.description}
                onChange={(description) =>
                  setSchoolForm({ ...schoolForm, description })
                }
              />
              <TextareaField
                label="Known for"
                value={schoolForm.known_for}
                onChange={(known_for) =>
                  setSchoolForm({ ...schoolForm, known_for })
                }
                helper="One tag per line, or comma-separated."
              />
              <TextareaField
                label="Recurring events"
                value={schoolForm.recurring_events}
                onChange={(recurring_events) =>
                  setSchoolForm({ ...schoolForm, recurring_events })
                }
                helper="One event per line, or comma-separated."
              />
              <TextareaField
                label="Verification notes"
                value={schoolForm.verification_notes}
                onChange={(verification_notes) =>
                  setSchoolForm({ ...schoolForm, verification_notes })
                }
              />
              <TextField
                label="Sort order"
                type="number"
                value={String(schoolForm.sort_order)}
                onChange={(sort_order) =>
                  setSchoolForm({
                    ...schoolForm,
                    sort_order: Number(sort_order) || 0,
                  })
                }
              />
              <SelectField
                label="Confidence"
                value={schoolForm.confidence_level}
                options={CONFIDENCE_LEVELS}
                onChange={(confidence_level) =>
                  setSchoolForm({ ...schoolForm, confidence_level })
                }
              />
              <label className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface2 px-3 py-2 text-sm text-text-primary">
                <span>Show on public page</span>
                <input
                  type="checkbox"
                  checked={schoolForm.is_active}
                  onChange={(event) =>
                    setSchoolForm({
                      ...schoolForm,
                      is_active: event.target.checked,
                    })
                  }
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className="relative h-6 w-11 rounded-full bg-border transition-colors after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-surface after:shadow-sm after:transition-transform peer-checked:bg-brand-600 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600/40"
                />
              </label>
            </div>
          </form>

          <section className="rounded-md border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl text-text-primary">
                  Schools
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  {sortedSchools.length} schools in the admin list.
                </p>
              </div>
              {schoolsQuery.isLoading && (
                <span className="text-sm text-text-secondary">
                  Loading schools...
                </span>
              )}
            </div>

            {schoolsQuery.error ? (
              <p className="mt-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                Unable to load UVSA schools.
              </p>
            ) : (
              <div className="mt-6 divide-y divide-border">
                {sortedSchools.map((school) => (
                  <div
                    key={school.id}
                    className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-serif text-xl text-text-primary">
                          {school.short_name}
                        </h3>
                        <span className="rounded-md bg-surface2 px-2 py-1 text-xs text-text-secondary">
                          {school.system_type}
                        </span>
                        {!school.is_active && (
                          <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                            Hidden
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-text-secondary">
                        {school.school_name}
                        {school.city ? ` - ${school.city}` : ""}
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm text-text-secondary">
                        {school.description || "No description yet."}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => startEdit(school)}
                      >
                        <PenIcon size={12} /> Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2 text-red-700"
                        onClick={() => confirmDelete(school)}
                        disabled={deleteSchoolMutation.isLoading}
                      >
                        <TrashIcon size={12} /> Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
}) {
  return (
    <label>
      <span className={labelCls}>{label}</span>
      <input
        type={type}
        className={inputCls}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper?: string;
}) {
  return (
    <label>
      <span className={labelCls}>{label}</span>
      <textarea
        className={`${inputCls} min-h-[96px] resize-y`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {helper && (
        <span className="mt-1 block text-xs text-text-secondary">{helper}</span>
      )}
    </label>
  );
}

function SelectField<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: TValue;
  options: TValue[];
  onChange: (value: TValue) => void;
}) {
  return (
    <label>
      <span className={labelCls}>{label}</span>
      <select
        className={inputCls}
        value={value}
        onChange={(event) => onChange(event.target.value as TValue)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
