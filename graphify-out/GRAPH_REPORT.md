# Graph Report - .  (2026-06-17)

## Corpus Check
- 230 files · ~165,428 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1608 nodes · 3542 edges · 97 communities (83 shown, 14 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Cabinet Management|Cabinet Management]]
- [[_COMMUNITY_External Events Admin|External Events Admin]]
- [[_COMMUNITY_House Admin Dashboard|House Admin Dashboard]]
- [[_COMMUNITY_Applications Admin|Applications Admin]]
- [[_COMMUNITY_Admin Index & Nav|Admin Index & Nav]]
- [[_COMMUNITY_Admin Resources|Admin Resources]]
- [[_COMMUNITY_Attendance Import|Attendance Import]]
- [[_COMMUNITY_Repository Data Layer|Repository Data Layer]]
- [[_COMMUNITY_House Public Page|House Public Page]]
- [[_COMMUNITY_Fallback & Degraded Content|Fallback & Degraded Content]]
- [[_COMMUNITY_Event Types & Home Cards|Event Types & Home Cards]]
- [[_COMMUNITY_VSA AI Assistant|VSA AI Assistant]]
- [[_COMMUNITY_House Images Manager|House Images Manager]]
- [[_COMMUNITY_Academic Years & Terms|Academic Years & Terms]]
- [[_COMMUNITY_UVSA Network Page|UVSA Network Page]]
- [[_COMMUNITY_Program Content|Program Content]]
- [[_COMMUNITY_Check-in & Sign-up|Check-in & Sign-up]]
- [[_COMMUNITY_Events Admin & Points|Events Admin & Points]]
- [[_COMMUNITY_Leaderboard|Leaderboard]]
- [[_COMMUNITY_AI Assistant Edge Function|AI Assistant Edge Function]]
- [[_COMMUNITY_AI Knowledge Admin|AI Knowledge Admin]]
- [[_COMMUNITY_ACE Family Tree|ACE Family Tree]]
- [[_COMMUNITY_Auth & Session|Auth & Session]]
- [[_COMMUNITY_Event Hooks & Mutations|Event Hooks & Mutations]]
- [[_COMMUNITY_Project Architecture Docs|Project Architecture Docs]]
- [[_COMMUNITY_Avatar & Points Context|Avatar & Points Context]]
- [[_COMMUNITY_Error Classes|Error Classes]]
- [[_COMMUNITY_Calendar & House Event Cards|Calendar & House Event Cards]]
- [[_COMMUNITY_Feedback Forms & Schemas|Feedback Forms & Schemas]]
- [[_COMMUNITY_ACE Families Admin|ACE Families Admin]]
- [[_COMMUNITY_House Events Admin|House Events Admin]]
- [[_COMMUNITY_Legacy House Archive|Legacy House Archive]]
- [[_COMMUNITY_Find My Points|Find My Points]]
- [[_COMMUNITY_VCN Archives|VCN Archives]]
- [[_COMMUNITY_Member Management & Merge|Member Management & Merge]]
- [[_COMMUNITY_Import Audit Panel|Import Audit Panel]]
- [[_COMMUNITY_Event Cards & VCN|Event Cards & VCN]]
- [[_COMMUNITY_ACE Public Page|ACE Public Page]]
- [[_COMMUNITY_House Events Repository|House Events Repository]]
- [[_COMMUNITY_ACE Family Repository|ACE Family Repository]]
- [[_COMMUNITY_My VSA Card|My VSA Card]]
- [[_COMMUNITY_Static Pages|Static Pages]]
- [[_COMMUNITY_Degraded Mode & Points Page|Degraded Mode & Points Page]]
- [[_COMMUNITY_Home Page|Home Page]]
- [[_COMMUNITY_Theme & Site Settings|Theme & Site Settings]]
- [[_COMMUNITY_Cabinet Schema & Design|Cabinet Schema & Design]]
- [[_COMMUNITY_Events Public Page|Events Public Page]]
- [[_COMMUNITY_ACE Family Adapter|ACE Family Adapter]]
- [[_COMMUNITY_Member CRUD|Member CRUD]]
- [[_COMMUNITY_Program Content Admin|Program Content Admin]]
- [[_COMMUNITY_House Config & Leaderboard|House Config & Leaderboard]]
- [[_COMMUNITY_Image Upload Utils|Image Upload Utils]]
- [[_COMMUNITY_Navigation Shell|Navigation Shell]]
- [[_COMMUNITY_Supabase Type Definitions|Supabase Type Definitions]]
- [[_COMMUNITY_ACE Family Cover Art|ACE Family Cover Art]]
- [[_COMMUNITY_Admin Overview & Health|Admin Overview & Health]]
- [[_COMMUNITY_Event Recaps|Event Recaps]]
- [[_COMMUNITY_Program Content Repository|Program Content Repository]]
- [[_COMMUNITY_Date Utilities|Date Utilities]]
- [[_COMMUNITY_Mobile Navigation Drawer|Mobile Navigation Drawer]]
- [[_COMMUNITY_Points Explainer|Points Explainer]]
- [[_COMMUNITY_Import Jobs|Import Jobs]]
- [[_COMMUNITY_Error Boundary|Error Boundary]]
- [[_COMMUNITY_Cloud Deployment Architecture|Cloud Deployment Architecture]]
- [[_COMMUNITY_Presidents Content|Presidents Content]]
- [[_COMMUNITY_Event Recap Editor|Event Recap Editor]]
- [[_COMMUNITY_Analytics Tracking|Analytics Tracking]]
- [[_COMMUNITY_Member Dashboard & Profile|Member Dashboard & Profile]]
- [[_COMMUNITY_ACE Family Import|ACE Family Import]]
- [[_COMMUNITY_Events Repository|Events Repository]]
- [[_COMMUNITY_Site Settings Admin|Site Settings Admin]]
- [[_COMMUNITY_House Detail Page|House Detail Page]]
- [[_COMMUNITY_External Events Repository|External Events Repository]]
- [[_COMMUNITY_Leaderboard Repository|Leaderboard Repository]]
- [[_COMMUNITY_Leaderboard Types|Leaderboard Types]]
- [[_COMMUNITY_Feedback Admin Tab|Feedback Admin Tab]]
- [[_COMMUNITY_Analytics Edge Function|Analytics Edge Function]]
- [[_COMMUNITY_UVSA Schools Repository|UVSA Schools Repository]]
- [[_COMMUNITY_Analytics Admin Page|Analytics Admin Page]]
- [[_COMMUNITY_Gallery Admin|Gallery Admin]]
- [[_COMMUNITY_Gallery Repository|Gallery Repository]]
- [[_COMMUNITY_Skeleton Components|Skeleton Components]]
- [[_COMMUNITY_Year Normalizer|Year Normalizer]]
- [[_COMMUNITY_Admin Layout & Nav|Admin Layout & Nav]]
- [[_COMMUNITY_Feedback Public Page|Feedback Public Page]]
- [[_COMMUNITY_Cabinet Migration Script|Cabinet Migration Script]]
- [[_COMMUNITY_AI Chat Edge Function|AI Chat Edge Function]]
- [[_COMMUNITY_Image Webhook Handler A|Image Webhook Handler A]]
- [[_COMMUNITY_Image Webhook Handler B|Image Webhook Handler B]]
- [[_COMMUNITY_Auth Context|Auth Context]]
- [[_COMMUNITY_Analytics Infrastructure|Analytics Infrastructure]]
- [[_COMMUNITY_Modal Component|Modal Component]]
- [[_COMMUNITY_Events Page Entry|Events Page Entry]]
- [[_COMMUNITY_Date Parser|Date Parser]]

## God Nodes (most connected - your core abstractions)
1. `withErrorHandling()` - 127 edges
2. `supabase` - 59 edges
3. `PageTitle()` - 45 edges
4. `useAuth()` - 34 edges
5. `getSupabaseImageUrl()` - 31 edges
6. `getAcademicTermMeta()` - 27 edges
7. `useAcademicTerms()` - 25 edges
8. `formatDateOnly()` - 23 edges
9. `isSupabaseUnavailable()` - 23 edges
10. `Event` - 19 edges

## Surprising Connections (you probably didn't know these)
- `VSA Admin Editorial Design System (Stitch Prompts)` --conceptually_related_to--> `Yearly Leaderboard System`  [INFERRED]
  stitch-prompts.md → docs/leaderboard-system.md
- `GitHub Push Protection Block (secrets detected)` --conceptually_related_to--> `VSA Playbook Roster (AGENTS.md)`  [INFERRED]
  push_out.txt → AGENTS.md
- `Deployment Guide (Vercel/Netlify)` --references--> `Vercel Primary Deployment`  [EXTRACTED]
  DEPLOYMENT_GUIDE.md → docs/cloud-architecture.md
- `VSA Website README` --references--> `Vercel Primary Deployment`  [EXTRACTED]
  README.md → docs/cloud-architecture.md
- `House Profile Image Migration Workflow` --semantically_similar_to--> `Event Image Migration Workflow`  [INFERRED] [semantically similar]
  docs/house-image-migration.md → docs/event-image-migration.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Static Asset Migration Pipeline (Supabase → Repo → Vercel)** — docs_event_image_migration_trigger_edge_function, docs_event_image_migration_migrate_images_yml, docs_cloud_architecture_vercel_deployment, docs_event_image_migration_supabase_staging_buffer [EXTRACTED 0.95]
- **VSA AI Agent Roster (Claude + Codex Playbooks)** — docs_claude_subagent_workflow_vsa_subagents, docs_codex_subagent_workflow_codex_playbooks, agents_vsa_playbook_roster, docs_claude_subagent_task_template_task_template, docs_codex_subagent_task_template_codex_task_template [EXTRACTED 0.95]
- **Yearly Leaderboard Data Flow (attendance → terms → view → UI)** — docs_leaderboard_system_member_event_attendance, docs_admin_content_management_academic_terms, docs_leaderboard_system_member_yearly_points_view, docs_leaderboard_system_yearly_leaderboard [EXTRACTED 0.95]

## Communities (97 total, 14 thin omitted)

### Community 0 - "Cabinet Management"
Cohesion: 0.06
Nodes (42): AdminCabinet(), CabinetMember, CATEGORIES, EMPTY_MEMBER, MIGRATION_DATA, ROLE_SUGGESTIONS, UploadedCabinetImage, COLLEGE_OPTIONS (+34 more)

### Community 1 - "External Events Admin"
Cohesion: 0.05
Nodes (43): AdminExternalEvents(), CalendarIcon, EditIcon, EMPTY_EVENT, MapPinIcon, PlusIcon, SaveIcon, STATUS_COLOR (+35 more)

### Community 2 - "House Admin Dashboard"
Cohesion: 0.07
Nodes (50): AdminHouseTab, BackfillPreview, buildAcademicYearOptions(), buildLongName(), collegeKey(), defaultAcademicYearStart(), EMPTY_SUMMARY, getCurrentAcademicYearStart() (+42 more)

### Community 3 - "Applications Admin"
Cohesion: 0.07
Nodes (35): AdminApplications(), emptyForm(), fieldStyle(), formFromLink(), FormState, StatusFilter, ApplicationCTA(), ApplicationCTAProps (+27 more)

### Community 4 - "Admin Index & Nav"
Cohesion: 0.05
Nodes (41): Ace, AdminAceFamilies, AdminAiKnowledge, AdminAnalytics, AdminApplications, AdminCabinet, AdminContent, AdminEvents (+33 more)

### Community 5 - "Admin Resources"
Cohesion: 0.07
Nodes (28): AdminIconProps, AdminResources(), ArchiveIcon, CheckCircleIcon, CopyIcon, dateInputValue(), EditIcon, EMPTY_FORM (+20 more)

### Community 6 - "Attendance Import"
Cohesion: 0.07
Nodes (22): AcademicTerm, AdminImport(), buildMemberEnrichment(), capitalizeName(), cleanName(), Event, getAcademicYearLabel(), getActionLabel() (+14 more)

### Community 7 - "Repository Data Layer"
Cohesion: 0.10
Nodes (7): withErrorHandling(), AiKnowledgeRepository, AuthRepository, ImportJobsRepository, PointsRepository, SignUpFormData, UserProfileFormData

### Community 8 - "House Public Page"
Cohesion: 0.08
Nodes (22): usePublishedHouseAssets(), assetMapByHouse(), AutoBadges, computeBadges(), faqs, getCurrentAcademicYearStart(), getHouseLabel(), getTodayDateOnly() (+14 more)

### Community 9 - "Fallback & Degraded Content"
Cohesion: 0.09
Nodes (24): ContentUnavailableState(), ContentUnavailableStateProps, FALLBACK_CABINET, FALLBACK_EVENTS, FALLBACK_FEEDBACK, FALLBACK_GALLERY, FALLBACK_GET_INVOLVED_PROGRAMS, FALLBACK_HOUSE_STANDINGS_2025_2026 (+16 more)

### Community 10 - "Event Types & Home Cards"
Cohesion: 0.11
Nodes (20): EVENT_TYPE_LABELS, getTodayDateOnly(), HouseStandingsCard(), LatestMemory, LatestMemoryCard(), NextEventCard(), ThisWeekInVSA(), formatEventDateRange() (+12 more)

### Community 11 - "VSA AI Assistant"
Cohesion: 0.08
Nodes (15): AssistantResponse, AssistantStatus, ChatMessage, createMessageId(), getSessionId(), Role, SourceChip, STARTER_QUESTIONS (+7 more)

### Community 12 - "House Images Manager"
Cohesion: 0.12
Nodes (18): HouseEventsManager(), buildAcademicYearOptions(), getCurrentAcademicYearStart(), HouseAssetDraft, HouseImagesManager(), HouseImagesManagerProps, UploadedHouseImage, UploadedHouseParentImage (+10 more)

### Community 13 - "Academic Years & Terms"
Cohesion: 0.14
Nodes (22): academicYearStartFor(), buildCabinetYearForm(), buildTermForm(), CabinetYearForm, cabinetYearToForm(), emptyCabinetYearForm(), emptyTermForm(), fieldStyle (+14 more)

### Community 14 - "UVSA Network Page"
Cohesion: 0.13
Nodes (18): Avatar(), AvatarProps, sizeClasses, PointsContext, PointsContextType, PointsProvider(), useAuth(), useAddPoints() (+10 more)

### Community 15 - "Program Content"
Cohesion: 0.10
Nodes (22): useExternalEvents(), useUVSASchools(), CalendarIcon, CheckCircleIcon, containerVariants, EXTERNAL_SHOWCASE_ORDER, ExternalLinkIcon, formatBadgeInitials() (+14 more)

### Community 16 - "Check-in & Sign-up"
Cohesion: 0.15
Nodes (22): useProgramContent(), formatProgramDateTime(), getProgramMetaParts(), hasPrimaryProgramLink(), isProgramContentHidden(), PROGRAM_STATUS_LABELS, faqs, INTERN_CONFIG (+14 more)

### Community 17 - "Events Admin & Points"
Cohesion: 0.14
Nodes (15): AcademicTermSelect(), AdminEvents(), EMPTY_EVENT, findTermForDate(), getSuggestedTermLabel(), UploadedEventImage, AdminPoints(), CheckIn (+7 more)

### Community 18 - "Leaderboard"
Cohesion: 0.14
Nodes (10): EVENT_TYPES, EventType, ManualCheckIn(), ManualCheckInProps, usePointsContext(), useEventAttendance(), supabase, CheckInCodeInput() (+2 more)

### Community 19 - "AI Assistant Edge Function"
Cohesion: 0.09
Nodes (7): useLeaderboardYears(), AcademicYearOption, HouseStanding, Leaderboard(), LeaderboardEntry, Member, SelectedYear

### Community 20 - "AI Knowledge Admin"
Cohesion: 0.09
Nodes (10): allowedOrigins, AssistantStatus, corsHeaders(), countUsage(), getRateLimitReason(), jsonResponse(), KnowledgeSnippet, RecentTurnSchema (+2 more)

### Community 21 - "ACE Family Tree"
Cohesion: 0.12
Nodes (12): DEFAULT_FORM, SnippetFormState, SortMode, StatusFilter, toDateInput(), toFormState(), AI_KNOWLEDGE_SOURCE_TYPES, AiKnowledgeSnippet (+4 more)

### Community 22 - "Auth & Session"
Cohesion: 0.11
Nodes (18): SignInForm(), FeedbackForm(), FeedbackFormProps, AdminEventUpdateFormData, AdminEventUpdateSchema, CheckInCodeFormData, CheckInCodeSchema, CreateEventSchema (+10 more)

### Community 23 - "Event Hooks & Mutations"
Cohesion: 0.14
Nodes (15): FamAccent, AccentPalette, ACCENTS, FamilyTree(), FamilyTreeProps, LayoutResult, TreeNode, FamSheet() (+7 more)

### Community 24 - "Project Architecture Docs"
Cohesion: 0.13
Nodes (9): Props, EventFilters, EventStats, EventWithAttendance, PublicEventPreview, PublishedPastEventArchiveAvailability, CreateEventFormData, UpdateEventFormData (+1 more)

### Community 25 - "Avatar & Points Context"
Cohesion: 0.12
Nodes (20): Coding Conventions (AGENTS.md), Domain-Critical Facts (House Years, Presidents), Repository Layer Mandate, VSA Playbook Roster (AGENTS.md), Architecture Overview (CLAUDE.md), React Provider Hierarchy, Claude Subagent Task Template, vsa-ai-knowledge Subagent (+12 more)

### Community 26 - "Error Classes"
Cohesion: 0.11
Nodes (11): ApiError, AuthenticationError, AuthorizationError, NetworkError, normalizeSupabaseError(), NotFoundError, ValidationError, PointsHistoryEntry (+3 more)

### Community 27 - "Calendar & House Event Cards"
Cohesion: 0.21
Nodes (15): AddToCalendarButton(), googleUrl(), getEventTimeLabel(), buildHouseEventCalendarUrl(), datePart(), HouseEventCard(), nextDateOnly(), buildGcalAllDayDates() (+7 more)

### Community 28 - "Feedback Forms & Schemas"
Cohesion: 0.17
Nodes (11): AdminAceFamilies(), EMPTY_FAMILY_DRAFT, FamilyDraft, fieldStyle(), isValidHex(), MemberRow(), slugify(), useAdminAceFamilies() (+3 more)

### Community 29 - "ACE Families Admin"
Cohesion: 0.14
Nodes (13): buildAcademicYearOptions(), draftFromEvent(), getCurrentAcademicYearStart(), HouseEventDraft, HouseEventsManagerProps, UploadedHouseEventImage, validateDraft(), isEndAfterStart() (+5 more)

### Community 30 - "House Events Admin"
Cohesion: 0.16
Nodes (14): getLegacyHouseArchiveByYear(), getLegacyHouseArchiveYears(), getVerifiedLegacyHouseYears(), LEGACY_HOUSE_ARCHIVE, LegacyHouseArchiveStatus, LegacyHouseArchiveYear, HouseYearSelector(), HouseYearSelectorProps (+6 more)

### Community 31 - "Legacy House Archive"
Cohesion: 0.12
Nodes (8): FindMyPointsEntry, SelectedYear, AcademicYearOption, entryMatches(), FindMyPointsProps, isExactNameMatch(), normalizeForMatch(), tokenize()

### Community 32 - "Find My Points"
Cohesion: 0.20
Nodes (9): AdminVcnArchives(), archivePayloadFromForm(), EMPTY_FORM, toNullable(), VCNArchiveFormState, useAllVcnArchives(), VCNArchiveFormData, VCNArchivesRepository (+1 more)

### Community 33 - "VCN Archives"
Cohesion: 0.17
Nodes (12): AdminMembers(), AdminMergeSuggestions(), Member, MergePair, PaginationControls(), PaginationControlsProps, THEMES, ROWS_PER_PAGE_OPTIONS (+4 more)

### Community 34 - "Member Management & Merge"
Cohesion: 0.21
Nodes (10): PageLoader(), PageLoaderProps, AuthContext, AuthContextType, AuthProvider(), useAdmin(), UserMenuProps, SignIn() (+2 more)

### Community 35 - "Import Audit Panel"
Cohesion: 0.19
Nodes (9): formatDateTime(), formatEventDate(), ImportAuditPanel(), jobLabel(), statusClass(), useImportJobRows(), useRecentImportJobs(), ImportJobWithEvent (+1 more)

### Community 36 - "Event Cards & VCN"
Cohesion: 0.22
Nodes (12): CountdownTimer(), CountdownTimerProps, EventCard(), EventCardProps, usePublishedVcnArchives(), getSupabaseImageSrcSet(), getSupabaseImageUrl(), SupabaseImageOptions (+4 more)

### Community 37 - "ACE Public Page"
Cohesion: 0.15
Nodes (13): useAllPublishedAceFamilyMembers(), usePublishedAceFamilies(), generationDepth(), Ace(), ACTIVE_FAM_SLOTS, FAM_HEAD_KEYWORDS, FamCardProps, FamHeadCardProps (+5 more)

### Community 38 - "House Events Repository"
Cohesion: 0.20
Nodes (5): HouseEventCardProps, HouseEventFormData, HouseEventsRepository, PUBLIC_FIELDS, HouseEvent

### Community 39 - "ACE Family Repository"
Cohesion: 0.19
Nodes (4): ImportPlan, AceFamiliesRepository, AceFamily, AceFamilyMember

### Community 40 - "My VSA Card"
Cohesion: 0.16
Nodes (11): AttendedEvent, BadgeData, getTop10Gap(), HOUSE_EMOJI, MyVSACard(), MyVSACardProps, RecentActivity(), TYPE_STICKER (+3 more)

### Community 41 - "Static Pages"
Cohesion: 0.17
Nodes (6): PageTitle(), PageTitleProps, helpfulLinks, committees, faqs, highlights

### Community 42 - "Degraded Mode & Points Page"
Cohesion: 0.26
Nodes (11): DegradedModeBanner(), DegradedModeBannerProps, useFindMyPoints(), useCurrentVcnArchive(), Points(), currentFromArchive(), formatArchiveDate(), VCN_PLACEHOLDER (+3 more)

### Community 43 - "Home Page"
Cohesion: 0.18
Nodes (12): RevealOnScrollWrapper(), RevealOnScrollWrapperProps, usePresidentsContent(), EventRow(), getTodayDateOnly(), Home(), pillars, TYPE_COLOR (+4 more)

### Community 44 - "Theme & Site Settings"
Cohesion: 0.16
Nodes (9): SiteSettingsProvider(), Theme, ThemeContext, ThemeContextType, ThemeProvider(), useTheme(), ThemeToggle(), ThemeToggleInline() (+1 more)

### Community 45 - "Cabinet Schema & Design"
Cohesion: 0.15
Nodes (15): cabinet_images Storage Bucket, Cabinet Management Feature Architecture Design, cabinet_members Table Schema, academic_terms Table, Admin Years Route (/admin/years), cabinet_years Table, Archive Year Scoping Rule, is_published Filter Pattern (+7 more)

### Community 46 - "Events Public Page"
Cohesion: 0.19
Nodes (13): useInfiniteEvents(), usePublishedPastEventArchiveAvailability(), ArchiveTermOption, EventMemoryStats, Events(), FilterKey, FILTERS, getEventTerm() (+5 more)

### Community 47 - "ACE Family Adapter"
Cohesion: 0.18
Nodes (10): accentFromThemeColor(), ACCENTS, hashString(), hexToRgb(), membersToTreeNodes(), patternForFamily(), PATTERNS, VIET_NUMBERS (+2 more)

### Community 48 - "Member CRUD"
Cohesion: 0.15
Nodes (4): AttendanceRecord, COLLEGE_OPTIONS, Member, YearlyTotal

### Community 49 - "Program Content Admin"
Cohesion: 0.19
Nodes (10): emptyForm(), fieldStyle, formFromContent(), FormState, ProgramContentManager(), Target, TARGETS, toInputDateTime() (+2 more)

### Community 50 - "House Config & Leaderboard"
Cohesion: 0.21
Nodes (10): HOUSE_COLORS, HOUSE_LABELS, HOUSE_OPTIONS, HouseName, isHouseName(), normalizeHouse(), HOUSE_EMOJI, HouseMemberLeaderboard() (+2 more)

### Community 51 - "Image Upload Utils"
Cohesion: 0.23
Nodes (11): canvasToBlob(), CompressionOptions, createImageBitmapFallback(), fileExtensionForMime(), getUploadExtension(), ImageUploadPreset, isRasterImage(), loadImage() (+3 more)

### Community 52 - "Navigation Shell"
Cohesion: 0.19
Nodes (9): GetInvolvedDropdown(), INVOLVEMENT_PREFIXES, InvolvementLink, LINKS, MobileDrawer, FLAT_NAV_ITEMS, NavItem, NavLinks (+1 more)

### Community 53 - "Supabase Type Definitions"
Cohesion: 0.15
Nodes (12): AcademicQuarter, ApplicationKey, ApplicationStatus, CheckInCodeEventType, ImportJobStatus, ImportRowStatus, ImportSourceType, ProgramContentStatus (+4 more)

### Community 54 - "ACE Family Cover Art"
Cohesion: 0.17
Nodes (5): FamCover(), FamCoverProps, FamPattern, PALETTE, PaletteEntry

### Community 55 - "Admin Overview & Health"
Cohesion: 0.17
Nodes (5): ADMIN_TOOL_GROUPS, AdminToolCard, AdminToolGroup, DEFAULT_STATS, OverviewStats

### Community 56 - "Event Recaps"
Cohesion: 0.26
Nodes (6): DatabaseError, EventRecapFormData, EventRecapsRepository, normalizeRecapInput(), normalizeText(), EventRecap

### Community 57 - "Program Content Repository"
Cohesion: 0.30
Nodes (7): ProgramContentCalloutProps, ProgramContentFormData, ProgramContentRepository, PUBLIC_PROGRAM_CONTENT_SELECT, ProgramContent, ProgramPageKey, ProgramSectionKey

### Community 58 - "Date Utilities"
Cohesion: 0.30
Nodes (10): compareDateOnlyAsc(), compareDateOnlyDesc(), formatDateOnly(), isDateOnlyString(), parseDateOnly(), toDateOnlyString(), getHouseEventHousesLabel(), HouseEventPreviewCard() (+2 more)

### Community 59 - "Mobile Navigation Drawer"
Cohesion: 0.17
Nodes (8): DrawerLinkProps, EXPLORE_LINKS, INVOLVEMENT_LINKS, INVOLVEMENT_PREFIXES, MobileDrawerProps, NavLink, QUICK_LINKS, UserMenu

### Community 61 - "Import Jobs"
Cohesion: 0.17
Nodes (10): asJson(), CreateImportJobInput, decisionFromRowStatus(), ImportJob, ImportJobEventSummary, ImportJobInsert, ImportJobRecord, ImportJobRow (+2 more)

### Community 62 - "Error Boundary"
Cohesion: 0.20
Nodes (5): ErrorBoundary, Props, State, PageError(), PageErrorProps

### Community 63 - "Cloud Deployment Architecture"
Cohesion: 0.25
Nodes (11): Deployment Guide (Vercel/Netlify), AWS EKS Backup Deployment, GitHub Actions CI/CD Pipeline, Supabase Backend, Vercel Primary Deployment, migrate-images.yml GitHub Action, Event Image Migration Workflow, Supabase Storage as Staging Buffer (+3 more)

### Community 64 - "Presidents Content"
Cohesion: 0.40
Nodes (7): AdminContent(), DEFAULT_PRESIDENTS_CONTENT, PresidentsContent, splitPresidentsMessage(), fetchPresidentsContent(), normalizePresidentsContent(), PRESIDENTS_CONTENT_QUERY_KEY

### Community 65 - "Event Recap Editor"
Cohesion: 0.22
Nodes (7): emptyRecap, EventRecapEditor(), learningFields, operationsFields, RecapTextFieldKey, TextAreaField, useEventRecap()

### Community 66 - "Analytics Tracking"
Cohesion: 0.29
Nodes (6): RouteTracker(), initGA(), trackPageView(), Window, root, reportWebVitals()

### Community 67 - "Member Dashboard & Profile"
Cohesion: 0.24
Nodes (8): Achievement, MemberDashboard(), AttendanceRecord, inputStyle, UCSD_COLLEGES, UserProfile, YEARS, EventAttendance

### Community 68 - "ACE Family Import"
Cohesion: 0.22
Nodes (7): buildImportPlan(), PersonRow, RoleLabel, slugify(), SweatpantsJson, SweatpantsMember, validateJson()

### Community 70 - "Site Settings Admin"
Cohesion: 0.42
Nodes (6): AdminSettings(), SiteSettingsContext, SiteSettingsContextValue, useSiteSettings(), DEFAULT_SITE_SETTINGS, SiteSettings

### Community 71 - "House Detail Page"
Cohesion: 0.44
Nodes (7): parseYearSlug(), getCurrentAcademicYearStart(), getHouseColor(), getHouseLabel(), HouseDetail(), resolveHouseYear(), getLosAngelesDateOnly()

### Community 72 - "External Events Repository"
Cohesion: 0.36
Nodes (3): ExternalEventFilters, ExternalEventsRepository, ExternalEvent

### Community 73 - "Leaderboard Repository"
Cohesion: 0.22
Nodes (4): LeaderboardRepository, HouseAllTimePoints, HouseMemberRankEntry, HouseRecentActivity

### Community 74 - "Leaderboard Types"
Cohesion: 0.22
Nodes (7): ExternalEventStatus, HouseMembership, MemberYearlyPoints, ResourceLinkVisibility, User, UVSAConfidenceLevel, UVSASystemType

### Community 75 - "Feedback Admin Tab"
Cohesion: 0.25
Nodes (4): Feedback, FEEDBACK_STATUS_LABELS, FEEDBACK_TYPE_LABELS, PRIORITY_LABELS

### Community 79 - "Gallery Admin"
Cohesion: 0.29
Nodes (5): EMPTY_FORM, EventOption, GalleryAlbum, UploadedGalleryCover, extractSupabasePublicObjectName()

### Community 80 - "Gallery Repository"
Cohesion: 0.29
Nodes (4): GalleryAlbum, GalleryFilters, GalleryRepository, RelatedEvent

### Community 82 - "Year Normalizer"
Cohesion: 0.47
Nodes (4): normalizeYearInput(), OFFICIAL_YEARS, run(), supabase

### Community 84 - "Feedback Public Page"
Cohesion: 0.50
Nodes (4): FeedbackPage(), FeedbackType, feedbackTypes, getFeedbackType()

### Community 86 - "AI Chat Edge Function"
Cohesion: 0.40
Nodes (3): ChatRequestSchema, corsHeaders, FALLBACK_RESPONSES

### Community 89 - "Auth Context"
Cohesion: 0.50
Nodes (4): Admin Analytics Page (/admin/analytics), analytics-proxy Edge Function, GA4 OAuth Refresh Token Credentials, REACT_APP_GA4_MEASUREMENT_ID Env Var

## Knowledge Gaps
- **434 isolated node(s):** `queryClient`, `FallbackOverrides`, `STATUS_RANK`, `ContentUnavailableStateProps`, `CountdownTimerProps` (+429 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PageTitle()` connect `Static Pages` to `Cabinet Management`, `External Events Admin`, `House Admin Dashboard`, `Applications Admin`, `Admin Index & Nav`, `Admin Resources`, `Attendance Import`, `House Public Page`, `Fallback & Degraded Content`, `Academic Years & Terms`, `Program Content`, `Check-in & Sign-up`, `Events Admin & Points`, `AI Assistant Edge Function`, `ACE Family Tree`, `Feedback Forms & Schemas`, `House Events Admin`, `Find My Points`, `VCN Archives`, `Member Management & Merge`, `Event Cards & VCN`, `ACE Public Page`, `Degraded Mode & Points Page`, `Home Page`, `Events Public Page`, `Admin Overview & Health`, `Points Explainer`, `Presidents Content`, `Member Dashboard & Profile`, `Site Settings Admin`, `House Detail Page`, `Analytics Admin Page`, `Gallery Admin`, `Feedback Public Page`?**
  _High betweenness centrality (0.113) - this node is a cross-community bridge._
- **Why does `withErrorHandling()` connect `Repository Data Layer` to `Cabinet Management`, `Applications Admin`, `Admin Resources`, `House Public Page`, `House Images Manager`, `Academic Years & Terms`, `Events Admin & Points`, `Leaderboard`, `ACE Family Tree`, `Auth & Session`, `Project Architecture Docs`, `Error Classes`, `Feedback Forms & Schemas`, `Find My Points`, `House Events Repository`, `ACE Family Repository`, `Event Recaps`, `Program Content Repository`, `Import Jobs`, `Events Repository`, `External Events Repository`, `Leaderboard Repository`, `Leaderboard Types`, `UVSA Schools Repository`, `Gallery Repository`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `supabase` connect `Leaderboard` to `Cabinet Management`, `House Admin Dashboard`, `Applications Admin`, `Admin Resources`, `Attendance Import`, `Event Types & Home Cards`, `House Images Manager`, `Academic Years & Terms`, `UVSA Network Page`, `Events Admin & Points`, `AI Assistant Edge Function`, `ACE Family Tree`, `Auth & Session`, `Project Architecture Docs`, `Error Classes`, `Feedback Forms & Schemas`, `ACE Families Admin`, `Find My Points`, `VCN Archives`, `Member Management & Merge`, `House Events Repository`, `My VSA Card`, `Events Public Page`, `Member CRUD`, `Admin Overview & Health`, `Event Recaps`, `Program Content Repository`, `Import Jobs`, `Presidents Content`, `Member Dashboard & Profile`, `Site Settings Admin`, `External Events Repository`, `Feedback Admin Tab`, `Analytics Admin Page`, `Gallery Admin`, `Gallery Repository`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **What connects `queryClient`, `FallbackOverrides`, `STATUS_RANK` to the rest of the system?**
  _440 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Cabinet Management` be split into smaller, more focused modules?**
  _Cohesion score 0.05902980713033314 - nodes in this community are weakly interconnected._
- **Should `External Events Admin` be split into smaller, more focused modules?**
  _Cohesion score 0.05384150030248034 - nodes in this community are weakly interconnected._
- **Should `House Admin Dashboard` be split into smaller, more focused modules?**
  _Cohesion score 0.07205513784461152 - nodes in this community are weakly interconnected._