# Graph Report - .  (2026-07-02)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1746 nodes · 3511 edges · 111 communities (98 shown, 13 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `195c428e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 105|Community 105]]
- [[_COMMUNITY_Community 109|Community 109]]

## God Nodes (most connected - your core abstractions)
1. `withErrorHandling()` - 105 edges
2. `supabase` - 62 edges
3. `PageTitle()` - 50 edges
4. `useAuth()` - 29 edges
5. `getSupabaseImageUrl()` - 24 edges
6. `EventsRepository` - 22 edges
7. `useAcademicTerms()` - 20 edges
8. `getAcademicTermMeta()` - 20 edges
9. `formatDateOnly()` - 20 edges
10. `Event` - 19 edges

## Surprising Connections (you probably didn't know these)
- `ProgramContentCalloutProps` --references--> `ProgramContent`  [EXTRACTED]
  src/components/features/program/ProgramContentCallout.tsx → src/types/index.ts
- `usePointsHistory()` --calls--> `useAuth()`  [EXTRACTED]
  src/hooks/usePoints.ts → src/hooks/useAuth.ts
- `usePointsStats()` --calls--> `useAuth()`  [EXTRACTED]
  src/hooks/usePoints.ts → src/hooks/useAuth.ts
- `useUserRank()` --calls--> `useAuth()`  [EXTRACTED]
  src/hooks/usePoints.ts → src/hooks/useAuth.ts
- `FamilyTreeProps` --references--> `FamAccent`  [EXTRACTED]
  src/components/features/ace/FamilyTree.tsx → src/components/features/ace/FamCover.tsx

## Import Cycles
- None detected.

## Communities (111 total, 13 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (27): CountdownTimer(), CountdownTimerProps, EVENT_TYPE_LABELS, Achievement, AddToCalendarButton(), googleUrl(), Props, EventCardProps (+19 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (43): AdminExternalEvents(), CalendarIcon, EditIcon, EMPTY_EVENT, MapPinIcon, PlusIcon, SaveIcon, STATUS_COLOR (+35 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (30): EVENT_TYPES, EventType, AdminIconProps, AdminResources(), ArchiveIcon, CheckCircleIcon, CopyIcon, dateInputValue() (+22 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (24): FindMyPointsEntry, SelectedYear, useFindMyPoints(), Points(), AcademicYearOption, entryMatches(), FindMyPoints(), FindMyPointsProps (+16 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (47): Ace, AdminAceFamilies, AdminAiFeedback, AdminAiKnowledge, AdminAnalytics, AdminApplications, AdminCabinet, AdminContent (+39 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (23): AcademicTerm, AdminImport(), buildMemberEnrichment(), capitalizeName(), cleanName(), Event, getAcademicYearLabel(), getActionLabel() (+15 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (21): AdminApplications(), fieldStyle(), FormState, StatusFilter, ApplicationCTA(), FallbackOverrides, STATUS_RANK, FALLBACK_APPLICATIONS (+13 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (21): DataRightsRequestTracker(), emptyForm, formatTimestamp(), FormInputProps, FormSelectProps, FormTextareaProps, getExportEligibilityIssues(), isExportEligible() (+13 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (20): ContentUnavailableState(), ContentUnavailableStateProps, DegradedModeBanner(), DegradedModeBannerProps, FALLBACK_GALLERY, FALLBACK_LINKS, EventCard(), useCurrentVcnArchive() (+12 more)

### Community 9 - "Community 9"
Cohesion: 0.10
Nodes (23): useAllPublishedAceFamilyMembers(), usePublishedAceFamilies(), accentFromThemeColor(), ACCENTS, generationDepth(), getDisplayFamName(), hashString(), hexToRgb() (+15 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (24): RevealOnScrollWrapper(), RevealOnScrollWrapperProps, useExternalEvents(), useUVSASchools(), CalendarIcon, CheckCircleIcon, containerVariants, EXTERNAL_SHOWCASE_ORDER (+16 more)

### Community 11 - "Community 11"
Cohesion: 0.13
Nodes (20): getEventTimeLabel(), getTodayDateOnly(), HouseStandingsCard(), LatestMemory, LatestMemoryCard(), NextEventCard(), formatEventDateRange(), formatEventTime() (+12 more)

### Community 12 - "Community 12"
Cohesion: 0.09
Nodes (18): assetMapByHouse(), computeBadges(), faqs, getCurrentAcademicYearStart(), getHouseEventHousesLabel(), getHouseLabel(), getTodayDateOnly(), House() (+10 more)

### Community 13 - "Community 13"
Cohesion: 0.16
Nodes (25): buildLongName(), AttendanceImportStatus, AttendanceMemberLookupMaps, buildMemberLookupMaps(), candidateScore(), capitalizeName(), cleanNameForImport(), contextMatches() (+17 more)

### Community 14 - "Community 14"
Cohesion: 0.10
Nodes (13): AttendanceRecord, COLLEGE_OPTIONS, Member, YearlyTotal, HOUSE_COLORS, HOUSE_LABELS, HOUSE_OPTIONS, HouseName (+5 more)

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (16): academicYearStartFor(), buildCabinetYearForm(), buildTermForm(), CabinetYearForm, cabinetYearToForm(), emptyCabinetYearForm(), emptyTermForm(), fieldStyle (+8 more)

### Community 16 - "Community 16"
Cohesion: 0.10
Nodes (20): CabinetMemberRaw, useCabinetMembers(), useCabinetMemberYearIds(), Avatar(), cabinetImage(), CabinetMember, CompactMemberCard(), containerVariants (+12 more)

### Community 17 - "Community 17"
Cohesion: 0.15
Nodes (19): FamCover(), buildHouseEventCalendarUrl(), datePart(), HouseEventCard(), nextDateOnly(), parseYearSlug(), getSupabaseImageUrl(), SupabaseImageOptions (+11 more)

### Community 18 - "Community 18"
Cohesion: 0.13
Nodes (13): ApplicationCTAProps, ADMIN_APPLICATION_LINKS_QUERY_KEY, PUBLIC_APPLICATION_LINKS_QUERY_KEY, useAdminApplicationLinks(), usePublicApplicationLinks(), maskTargetUrl(), ApplicationLinkFormData, ApplicationLinksRepository (+5 more)

### Community 19 - "Community 19"
Cohesion: 0.12
Nodes (14): useLeaderboardYears(), AutoBadges, LeaderboardRepository, ExternalEventStatus, HouseAllTimePoints, HouseMemberRankEntry, HouseMembership, HouseRecentActivity (+6 more)

### Community 20 - "Community 20"
Cohesion: 0.15
Nodes (16): emptyForm(), fieldStyle, formFromContent(), FormState, ProgramContentManager(), Target, TARGETS, toInputDateTime() (+8 more)

### Community 21 - "Community 21"
Cohesion: 0.14
Nodes (13): AdminVcnArchives(), archivePayloadFromForm(), EMPTY_FORM, toNullable(), VCNArchiveFormState, Props, State, PageError() (+5 more)

### Community 22 - "Community 22"
Cohesion: 0.11
Nodes (19): APPLY, ARG_CATEGORY, ARG_EVENT_ID, ARG_HOUSE_EVENT_ID, CATEGORIES, CategoryConfig, compressToWebP(), downloadBuffer() (+11 more)

### Community 23 - "Community 23"
Cohesion: 0.10
Nodes (20): FeedbackFormProps, AdminEventUpdateFormData, AdminEventUpdateSchema, CheckInCodeFormData, CheckInCodeSchema, CreateEventSchema, DataRightsExportEventSchema, DataRightsRequestFormData (+12 more)

### Community 24 - "Community 24"
Cohesion: 0.09
Nodes (7): AcademicYearOption, getMemberDisplayName(), HouseStanding, LeaderboardEntry, Member, PublicMemberProfileModal(), SelectedYear

### Community 25 - "Community 25"
Cohesion: 0.11
Nodes (12): DEFAULT_FORM, SnippetFormState, SortMode, StatusFilter, toDateInput(), toFormState(), AI_KNOWLEDGE_SOURCE_TYPES, AiKnowledgeSnippet (+4 more)

### Community 26 - "Community 26"
Cohesion: 0.15
Nodes (4): withErrorHandling(), AiKnowledgeRepository, AuthRepository, ImportJobsRepository

### Community 27 - "Community 27"
Cohesion: 0.13
Nodes (15): FamAccent, AccentPalette, ACCENTS, FamilyTree(), FamilyTreeProps, LayoutResult, TreeNode, FamSheet() (+7 more)

### Community 28 - "Community 28"
Cohesion: 0.14
Nodes (13): emptyRecap, EventRecapEditor(), learningFields, operationsFields, RecapTextFieldKey, TextAreaField, useEventRecap(), useEventRecapEventIds() (+5 more)

### Community 29 - "Community 29"
Cohesion: 0.14
Nodes (14): buildAcademicYearOptions(), draftFromEvent(), getCurrentAcademicYearStart(), HouseEventDraft, HouseEventsManager(), HouseEventsManagerProps, UploadedHouseEventImage, validateDraft() (+6 more)

### Community 30 - "Community 30"
Cohesion: 0.14
Nodes (17): AdminHouseTab, BackfillPreview, buildAcademicYearOptions(), collegeKey(), defaultAcademicYearStart(), EMPTY_SUMMARY, getCurrentAcademicYearStart(), getMemberName() (+9 more)

### Community 31 - "Community 31"
Cohesion: 0.14
Nodes (13): Avatar(), AvatarProps, sizeClasses, PointsContext, PointsContextType, PointsProvider(), useAddPoints(), usePoints() (+5 more)

### Community 32 - "Community 32"
Cohesion: 0.12
Nodes (12): DataRightsAdminOption, DataRightsRequest, DataRightsRequestEvent, DataRightsRequestInput, DataRightsRequestPatch, DataRightsRequestsRepository, normalizeInput(), normalizePatch() (+4 more)

### Community 33 - "Community 33"
Cohesion: 0.17
Nodes (11): AdminAceFamilies(), EMPTY_FAMILY_DRAFT, FamilyDraft, fieldStyle(), isValidHex(), MemberRow(), slugify(), useAdminAceFamilies() (+3 more)

### Community 34 - "Community 34"
Cohesion: 0.15
Nodes (15): EMPTY_FORM, EventOption, GalleryAlbum, UploadedGalleryCover, canvasToBlob(), CompressionOptions, createImageBitmapFallback(), fileExtensionForMime() (+7 more)

### Community 35 - "Community 35"
Cohesion: 0.16
Nodes (10): HouseAssetDraft, HouseImagesManagerProps, UploadedHouseImage, UploadedHouseParentImage, ParsedHouseRow, usePublishedHouseAssets(), HouseAssetsRepository, HousePageAssetFormData (+2 more)

### Community 36 - "Community 36"
Cohesion: 0.23
Nodes (11): SignInForm(), useAdmin(), useAuth(), UserMenuProps, SignIn(), Profile(), AdminRoute(), AdminRouteProps (+3 more)

### Community 37 - "Community 37"
Cohesion: 0.12
Nodes (9): AssistantResponse, AssistantStatus, ChatMessage, createMessageId(), getSessionId(), Role, SourceChip, STARTER_QUESTIONS (+1 more)

### Community 38 - "Community 38"
Cohesion: 0.17
Nodes (13): getLegacyHouseArchiveByYear(), getLegacyHouseArchiveYears(), getVerifiedLegacyHouseYears(), LEGACY_HOUSE_ARCHIVE, LegacyHouseArchiveStatus, LegacyHouseArchiveYear, HouseYearSelector(), HouseYearSelectorProps (+5 more)

### Community 39 - "Community 39"
Cohesion: 0.13
Nodes (10): ApiError, AuthenticationError, AuthorizationError, NetworkError, normalizeSupabaseError(), ValidationError, UserProfile, SignInFormData (+2 more)

### Community 40 - "Community 40"
Cohesion: 0.24
Nodes (14): useProgramContent(), formatProgramDateTime(), getProgramMetaParts(), hasPrimaryProgramLink(), isProgramContentHidden(), PROGRAM_STATUS_LABELS, faqs, whatToExpect (+6 more)

### Community 41 - "Community 41"
Cohesion: 0.12
Nodes (16): AcademicQuarter, ApplicationKey, ApplicationStatus, CheckInCodeEventType, DataRightsRequestEventType, DataRightsRequestPriority, ImportJobStatus, ImportRowStatus (+8 more)

### Community 42 - "Community 42"
Cohesion: 0.18
Nodes (11): AdminMergeSuggestions(), Member, MergePair, PaginationControls(), PaginationControlsProps, THEMES, ROWS_PER_PAGE_OPTIONS, RowsPerPageOption (+3 more)

### Community 43 - "Community 43"
Cohesion: 0.15
Nodes (10): inputStyle, STATUS_BADGE, StatusFilter, MemberMatchOption, MemberPhotoRequest, MemberPhotoRequestEvent, MyMemberPhotoRequest, PublicMemberAvatar (+2 more)

### Community 44 - "Community 44"
Cohesion: 0.20
Nodes (5): HouseEventCardProps, HouseEventFormData, HouseEventsRepository, PUBLIC_FIELDS, HouseEvent

### Community 45 - "Community 45"
Cohesion: 0.19
Nodes (4): ImportPlan, AceFamiliesRepository, AceFamily, AceFamilyMember

### Community 46 - "Community 46"
Cohesion: 0.17
Nodes (6): PageTitle(), PageTitleProps, helpfulLinks, committees, faqs, highlights

### Community 47 - "Community 47"
Cohesion: 0.20
Nodes (14): buildAcademicYearOptions(), getCurrentAcademicYearStart(), HouseImagesManager(), AdminHouses(), AcademicQuarter, AcademicTermMeta, formatAcademicYear(), getAcademicQuarter() (+6 more)

### Community 48 - "Community 48"
Cohesion: 0.13
Nodes (14): FALLBACK_CABINET, FALLBACK_EVENTS, FALLBACK_FEEDBACK, FALLBACK_GET_INVOLVED_PROGRAMS, FALLBACK_HOUSE_STANDINGS_2025_2026, FALLBACK_LEADERBOARD, FALLBACK_LEGACY_HOUSE_YEARS, FALLBACK_POINTS (+6 more)

### Community 49 - "Community 49"
Cohesion: 0.15
Nodes (10): DrawerLinkProps, EXPLORE_LINKS, INVOLVEMENT_LINKS, INVOLVEMENT_PREFIXES, MobileDrawer, MobileDrawerProps, NavLink, QUICK_LINKS (+2 more)

### Community 50 - "Community 50"
Cohesion: 0.17
Nodes (10): ArchiveTermOption, EventMemoryStats, FilterKey, FILTERS, getEventTerm(), getEventTermCode(), getEventTermLabel(), HOUSE_EMOJI (+2 more)

### Community 51 - "Community 51"
Cohesion: 0.14
Nodes (5): PointsHistoryEntry, PointsLeaderboardEntry, PointsRepository, PointsStats, UserPoints

### Community 52 - "Community 52"
Cohesion: 0.14
Nodes (11): amys, bigs, buildImportPlan(), byId, json, littles, maxDepth, plan (+3 more)

### Community 53 - "Community 53"
Cohesion: 0.23
Nodes (7): formatDateTime(), formatEventDate(), ImportAuditPanel(), jobLabel(), statusClass(), useImportJobRows(), useRecentImportJobs()

### Community 54 - "Community 54"
Cohesion: 0.23
Nodes (10): RouteTracker(), AnalyticsConsent, AnalyticsConsentContext, AnalyticsConsentContextValue, AnalyticsConsentProvider(), disableGA(), initGA(), isAnalyticsConfigured() (+2 more)

### Community 55 - "Community 55"
Cohesion: 0.18
Nodes (11): ThisWeekInVSA(), FeaturedEventHome(), getEventTimeLabel(), getTodayDateOnly(), Home(), pillars, TYPE_COLOR, Badge() (+3 more)

### Community 56 - "Community 56"
Cohesion: 0.14
Nodes (12): asJson(), CreateImportJobInput, decisionFromRowStatus(), ImportJob, ImportJobEventSummary, ImportJobInsert, ImportJobRecord, ImportJobRow (+4 more)

### Community 57 - "Community 57"
Cohesion: 0.19
Nodes (5): DatabaseError, AiFeedback, AiFeedbackFilters, AiFeedbackRepository, SubmitAiFeedbackInput

### Community 59 - "Community 59"
Cohesion: 0.17
Nodes (5): ADMIN_TOOL_GROUPS, AdminToolCard, AdminToolGroup, DEFAULT_STATS, OverviewStats

### Community 60 - "Community 60"
Cohesion: 0.17
Nodes (4): ErrorBoundary, SiteSettingsProvider(), queryClient, root

### Community 61 - "Community 61"
Cohesion: 0.18
Nodes (4): FamCoverProps, FamPattern, PALETTE, PaletteEntry

### Community 62 - "Community 62"
Cohesion: 0.22
Nodes (8): CabinetMember, CATEGORIES, EMPTY_MEMBER, MIGRATION_DATA, ROLE_SUGGESTIONS, UploadedCabinetImage, COLLEGE_OPTIONS, YEAR_OPTIONS

### Community 63 - "Community 63"
Cohesion: 0.35
Nodes (8): AdminContent(), DEFAULT_PRESIDENTS_CONTENT, PresidentsContent, splitPresidentsMessage(), fetchPresidentsContent(), normalizePresidentsContent(), PRESIDENTS_CONTENT_QUERY_KEY, usePresidentsContent()

### Community 64 - "Community 64"
Cohesion: 0.27
Nodes (8): ManualCheckIn(), ManualCheckInProps, usePointsContext(), useEventAttendance(), supabase, Profile(), CheckInCodeInput(), CheckInCodeInputProps

### Community 65 - "Community 65"
Cohesion: 0.22
Nodes (9): PageLoader(), PageLoaderProps, MemberDashboard(), AttendanceRecord, inputStyle, UCSD_COLLEGES, UserProfile, YEARS (+1 more)

### Community 66 - "Community 66"
Cohesion: 0.27
Nodes (3): NotFoundError, UVSASchoolsRepository, UVSASchool

### Community 67 - "Community 67"
Cohesion: 0.20
Nodes (5): CheckData, ChecklistState, CheckStatus, DEFAULT_STATE, LOADING

### Community 68 - "Community 68"
Cohesion: 0.38
Nodes (6): AdminSettings(), SiteSettingsContext, SiteSettingsContextValue, useSiteSettings(), DEFAULT_SITE_SETTINGS, SiteSettings

### Community 69 - "Community 69"
Cohesion: 0.24
Nodes (7): Theme, ThemeContext, ThemeContextType, ThemeProvider(), useTheme(), ThemeToggle(), ThemeToggleInline()

### Community 70 - "Community 70"
Cohesion: 0.24
Nodes (8): CabinetIntern, faqs, InternCard(), internInitials(), pillars, resolveInternImageUrl(), shadowAreas, whatYouDo

### Community 71 - "Community 71"
Cohesion: 0.24
Nodes (6): useGallery(), useGalleryStats(), GalleryAlbum, GalleryFilters, GalleryRepository, RelatedEvent

### Community 72 - "Community 72"
Cohesion: 0.22
Nodes (7): buildImportPlan(), PersonRow, RoleLabel, slugify(), SweatpantsJson, SweatpantsMember, validateJson()

### Community 73 - "Community 73"
Cohesion: 0.22
Nodes (7): AttendanceImportMember, AttendanceImportRowInput, AttendanceMatchResult, matchAttendanceImportRows(), parseCSV(), splitCSVRow(), matchOne()

### Community 74 - "Community 74"
Cohesion: 0.28
Nodes (7): AcademicTermSelect(), EMPTY_EVENT, findTermForDate(), getSuggestedTermLabel(), UploadedEventImage, useEvents(), extractSupabasePublicObjectName()

### Community 75 - "Community 75"
Cohesion: 0.47
Nodes (7): compareDateOnlyAsc(), compareDateOnlyDesc(), formatDateOnly(), isDateOnlyString(), parseDateOnly(), toDateOnlyString(), ExternalEventCard()

### Community 76 - "Community 76"
Cohesion: 0.25
Nodes (7): GetInvolvedDropdown(), INVOLVEMENT_PREFIXES, InvolvementLink, LINKS, FLAT_NAV_ITEMS, NavItem, NavLinks

### Community 77 - "Community 77"
Cohesion: 0.36
Nodes (3): ExternalEventFilters, ExternalEventsRepository, ExternalEvent

### Community 78 - "Community 78"
Cohesion: 0.39
Nodes (7): createAdminClient(), createAnonClient(), createUserClient(), reportFail(), reportPass(), reportSkip(), runTests()

### Community 79 - "Community 79"
Cohesion: 0.39
Nodes (6): AdminCabinet(), AdminYearsTerms(), useCurrentCabinetInterns(), useCabinetYears(), formatCabinetYearRange(), getCurrentCabinetYear()

### Community 80 - "Community 80"
Cohesion: 0.25
Nodes (4): Feedback, FEEDBACK_STATUS_LABELS, FEEDBACK_TYPE_LABELS, PRIORITY_LABELS

### Community 81 - "Community 81"
Cohesion: 0.32
Nodes (5): ALL_GROUPS, BoardGroup, CabinetRoleExplorer(), CabinetRoleExplorerItem, cabinetRoles

### Community 83 - "Community 83"
Cohesion: 0.46
Nodes (7): build_and_push(), check_prerequisites(), cleanup(), deploy_k8s(), health_check(), main(), deploy.sh script

### Community 85 - "Community 85"
Cohesion: 0.38
Nodes (5): AdminPoints(), CheckIn, initials(), LeaderboardRow, useAcademicTerms()

### Community 86 - "Community 86"
Cohesion: 0.33
Nodes (4): VsaAiAssistant(), BackToTop(), Layout(), NavigationShell

### Community 87 - "Community 87"
Cohesion: 0.38
Nodes (5): AnalyticsConsentBanner(), useAnalyticsConsent(), Footer(), footerGroups, socialLinks

### Community 88 - "Community 88"
Cohesion: 0.29
Nodes (6): validExportBundle, validForm, validPreview, DataRightsDependencyPreviewSchema, DataRightsExportBundleSchema, DataRightsRequestFormSchema

### Community 90 - "Community 90"
Cohesion: 0.40
Nodes (5): FeedbackForm(), FeedbackPage(), FeedbackType, feedbackTypes, getFeedbackType()

### Community 91 - "Community 91"
Cohesion: 0.47
Nodes (4): normalizeYearInput(), OFFICIAL_YEARS, run(), supabase

### Community 92 - "Community 92"
Cohesion: 0.40
Nodes (6): Cabinet(), cabinetYearMatchesQuery(), cabinetYearQueryValue(), groupByRole(), normalizeCabinetYearQuery(), splitExecutiveRoles()

### Community 96 - "Community 96"
Cohesion: 0.50
Nodes (3): inputStyle, PhotoRequestSection(), PhotoRequestSectionProps

### Community 97 - "Community 97"
Cohesion: 0.50
Nodes (3): AuthContext, AuthContextType, AuthProvider()

### Community 101 - "Community 101"
Cohesion: 0.67
Nodes (3): cabinet_images Storage Bucket, Cabinet Management Feature Architecture Design, cabinet_members Table Schema

## Knowledge Gaps
- **477 isolated node(s):** `ContentUnavailableStateProps`, `CountdownTimerProps`, `DegradedModeBannerProps`, `Props`, `State` (+472 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PageTitle()` connect `Community 46` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 8`, `Community 9`, `Community 10`, `Community 12`, `Community 15`, `Community 16`, `Community 17`, `Community 21`, `Community 24`, `Community 25`, `Community 30`, `Community 33`, `Community 34`, `Community 36`, `Community 38`, `Community 40`, `Community 42`, `Community 43`, `Community 50`, `Community 55`, `Community 57`, `Community 59`, `Community 62`, `Community 63`, `Community 65`, `Community 67`, `Community 68`, `Community 70`, `Community 74`, `Community 84`, `Community 85`, `Community 90`, `Community 95`?**
  _High betweenness centrality (0.184) - this node is a cross-community bridge._
- **Why does `supabase` connect `Community 64` to `Community 0`, `Community 2`, `Community 3`, `Community 5`, `Community 11`, `Community 14`, `Community 15`, `Community 16`, `Community 18`, `Community 19`, `Community 20`, `Community 21`, `Community 23`, `Community 24`, `Community 25`, `Community 28`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 33`, `Community 34`, `Community 35`, `Community 36`, `Community 39`, `Community 42`, `Community 43`, `Community 44`, `Community 50`, `Community 51`, `Community 56`, `Community 57`, `Community 59`, `Community 62`, `Community 63`, `Community 65`, `Community 66`, `Community 67`, `Community 68`, `Community 71`, `Community 74`, `Community 77`, `Community 79`, `Community 80`, `Community 82`, `Community 84`, `Community 85`, `Community 97`?**
  _High betweenness centrality (0.158) - this node is a cross-community bridge._
- **Why does `withErrorHandling()` connect `Community 26` to `Community 0`, `Community 2`, `Community 15`, `Community 18`, `Community 19`, `Community 20`, `Community 21`, `Community 25`, `Community 28`, `Community 32`, `Community 33`, `Community 35`, `Community 39`, `Community 43`, `Community 44`, `Community 45`, `Community 51`, `Community 56`, `Community 57`, `Community 66`, `Community 71`, `Community 77`, `Community 82`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **What connects `ContentUnavailableStateProps`, `CountdownTimerProps`, `DegradedModeBannerProps` to the rest of the system?**
  _477 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.056107539450613676 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05297532656023222 - nodes in this community are weakly interconnected._