export type CabinetRoleExplorerItem = {
  roleSlug: string;
  roleName: string;
  aliases: string[];
  boardGroup:
    | "Executive Board"
    | "Programming & Member Experience"
    | "Culture & External"
    | "Media & Storytelling"
    | "Finance & Operations"
    | "Legacy";
  status: "current" | "new" | "renamed" | "legacy";
  shortDescription: string;
  responsibilities: string[];
  skillsBuilt: string[];
  worksWith: string[];
  bestFitFor: string[];
  busySeasons: string[];
  historyNote?: string;
  sourceConfidence: "High" | "Medium" | "Low";
  needsConfirmation?: boolean;
  displayOrder: number;
};

export const cabinetRoles: CabinetRoleExplorerItem[] = [
  {
    roleSlug: "president",
    roleName: "President",
    aliases: ["Pres", "Co-President"],
    boardGroup: "Executive Board",
    status: "current",
    shortDescription: "The face and primary leader of the organization, responsible for guiding cabinet vision, overseeing all board members, and ensuring VSA meets its cultural, social, and academic goals.",
    responsibilities: [
      "Oversee and manage the entire Executive and General Board.",
      "Facilitate weekly cabinet and general body meetings.",
      "Serve as the primary liaison to UCSD CSI and the university.",
      "Manage crisis resolution and high-level organizational strategy."
    ],
    skillsBuilt: ["Leadership", "Public Speaking", "Crisis Management", "Strategic Planning"],
    worksWith: ["Entire Cabinet", "UCSD CSI", "UVSA", "Alumni"],
    bestFitFor: ["Visionary leaders", "Strong communicators", "Experienced board members"],
    busySeasons: ["All year"],
    sourceConfidence: "High",
    displayOrder: 1
  },
  {
    roleSlug: "ivp",
    roleName: "Internal Vice President",
    aliases: ["IVP"],
    boardGroup: "Executive Board",
    status: "current",
    shortDescription: "The operational backbone of cabinet, focusing on internal member retention, the intern program, and supporting the President.",
    responsibilities: [
      "Manage the VSA Intern Program and guide new leaders.",
      "Oversee internal cabinet relations and resolve conflicts.",
      "Step in for the President when they are unavailable.",
      "Monitor general member retention and engagement."
    ],
    skillsBuilt: ["Mentorship", "Conflict Resolution", "Program Management"],
    worksWith: ["President", "Interns", "Cabinet"],
    bestFitFor: ["Empathetic listeners", "Mentors", "Organizers"],
    busySeasons: ["Fall (Intern Apps)", "All year"],
    sourceConfidence: "High",
    displayOrder: 2
  },
  {
    roleSlug: "evp",
    roleName: "External Vice President",
    aliases: ["EVP", "ICC", "Intercollegiate Council Chair"],
    boardGroup: "Executive Board",
    status: "current",
    shortDescription: "The bridge between UCSD VSA and the broader UVSA Southern California network.",
    responsibilities: [
      "Represent UCSD at monthly Intercollegiate Council (ICC) meetings.",
      "Coordinate rides and logistics for members attending external events.",
      "Communicate external opportunities to UCSD members.",
      "Maintain relationships with other university VSAs."
    ],
    skillsBuilt: ["Networking", "Logistics", "Professional Communication"],
    worksWith: ["President", "UVSA SoCal", "External VSAs"],
    bestFitFor: ["Social butterflies", "Networkers", "Drivers/Logisticians"],
    busySeasons: ["Fall (Camp)", "Spring (UVSA events)"],
    sourceConfidence: "High",
    displayOrder: 3
  },
  {
    roleSlug: "treasurer",
    roleName: "Treasurer",
    aliases: [],
    boardGroup: "Executive Board",
    status: "current",
    shortDescription: "The financial controller responsible for budgeting, reimbursements, and funding.",
    responsibilities: [
      "Manage the VSA AS and off-campus bank accounts.",
      "Process reimbursements for cabinet purchases.",
      "Apply for AS funding for major events and VCN.",
      "Keep detailed ledgers of all income and expenses."
    ],
    skillsBuilt: ["Financial Planning", "Accounting", "Detail Orientation"],
    worksWith: ["Fundraising Chair", "President", "Events Chair", "VCN Directors"],
    bestFitFor: ["Organized detail-oriented people", "Spreadsheet lovers"],
    busySeasons: ["Beginning of quarters (Budgets)", "Spring (VCN Funding)"],
    sourceConfidence: "High",
    displayOrder: 4
  },
  {
    roleSlug: "secretary",
    roleName: "Secretary",
    aliases: [],
    boardGroup: "Executive Board",
    status: "current",
    shortDescription: "The organizational anchor, managing points, attendance, newsletters, and records.",
    responsibilities: [
      "Take minutes during cabinet meetings.",
      "Track member attendance and update the points leaderboard.",
      "Write and send the weekly VSA newsletter.",
      "Book rooms for GBMs and events."
    ],
    skillsBuilt: ["Organization", "Written Communication", "Data Management"],
    worksWith: ["President", "Media Director", "Events Chair"],
    bestFitFor: ["Highly organized individuals", "Writers", "Punctual people"],
    busySeasons: ["All year (weekly tasks)"],
    sourceConfidence: "High",
    displayOrder: 5
  },
  {
    roleSlug: "vcn-director",
    roleName: "VCN Director",
    aliases: ["VCN Dir"],
    boardGroup: "Culture & External",
    status: "current",
    shortDescription: "The creative and operational lead for Vietnamese Culture Night, managing the entire production.",
    responsibilities: [
      "Write and direct the VCN script/play.",
      "Cast actors and coordinate acting rehearsals.",
      "Oversee the VCN Executive Producer and committee leads.",
      "Ensure the cultural integrity and vision of the show."
    ],
    skillsBuilt: ["Directing", "Project Management", "Creative Writing", "Leadership"],
    worksWith: ["VCN Exec Producer", "Cast", "Dance Coordinators", "Cabinet"],
    bestFitFor: ["Creative visionaries", "Theater lovers", "Strong managers"],
    busySeasons: ["Winter", "Spring (Showtime)"],
    sourceConfidence: "High",
    displayOrder: 6
  },
  {
    roleSlug: "vcn-exec-producer",
    roleName: "VCN Executive Producer",
    aliases: ["VCN EP"],
    boardGroup: "Culture & External",
    status: "current",
    shortDescription: "The logistical counterpart to the Director, handling VCN funding, room bookings, and backstage operations.",
    responsibilities: [
      "Manage the VCN budget and AS funding applications.",
      "Book rehearsal spaces for cast and dance teams.",
      "Coordinate backstage logistics, props, and stage ninjas.",
      "Handle ticketing and front-of-house operations on show day."
    ],
    skillsBuilt: ["Logistics", "Budgeting", "Event Production", "Crisis Management"],
    worksWith: ["VCN Director", "Treasurer", "Stage Managers", "CSI"],
    bestFitFor: ["Organized problem-solvers", "Logistics planners", "Calm under pressure"],
    busySeasons: ["Winter", "Spring (Showtime)"],
    sourceConfidence: "High",
    displayOrder: 7
  },
  {
    roleSlug: "events-chair",
    roleName: "Events Chair",
    aliases: ["Social Chair"],
    boardGroup: "Programming & Member Experience",
    status: "current",
    shortDescription: "The primary planners of VSA's social calendar, creating spaces for members to bond.",
    responsibilities: [
      "Plan and lead logistics for larger social events and retreats.",
      "Coordinate with cabinet for event execution, including GBMs and socials.",
      "Plan and organize the annual Winter Retreat.",
      "Work with Media Chairs to promote VSA social events when relevant."
    ],
    skillsBuilt: ["Event Planning", "Time Management", "Public Speaking", "Creativity"],
    worksWith: ["Secretary", "Treasurer", "PR Chair", "Media Chairs"],
    bestFitFor: ["Outgoing planners", "Creative hosts", "Energetic speakers"],
    busySeasons: ["Fall (Welcome Week)", "Winter Retreat"],
    sourceConfidence: "High",
    displayOrder: 8
  },
  {
    roleSlug: "ace-chair",
    roleName: "ACE Chair",
    aliases: ["Anh Chi Em Chair"],
    boardGroup: "Programming & Member Experience",
    status: "current",
    shortDescription: "The leaders of the ACE (Anh Chị Em) family and mentorship program, fostering a supportive community for general members.",
    responsibilities: [
      "Coordinate Big/Little pairings and family assignments.",
      "Organize ACE-specific events, reveals, and family competitions.",
      "Support family heads and organize family bonding events.",
      "Foster a welcoming environment for new members."
    ],
    skillsBuilt: ["Community Building", "Empathy", "Event Planning"],
    worksWith: ["IVP", "General Members", "Family Heads"],
    bestFitFor: ["Mentors", "Community builders", "Approachable individuals"],
    busySeasons: ["Fall (Pairings/Reveals)", "Winter Retreat"],
    sourceConfidence: "High",
    displayOrder: 9
  },
  {
    roleSlug: "media-director",
    roleName: "Media Director",
    aliases: ["Media"],
    boardGroup: "Media & Storytelling",
    status: "current",
    shortDescription: "The creative lead for VSA's brand, designing graphics, merch, and marketing materials.",
    responsibilities: [
      "Design graphics for Facebook, Instagram, and newsletters.",
      "Create VSA merchandise (shirts, stickers, etc.).",
      "Maintain the VSA brand identity and aesthetics.",
      "Manage the media team or interns."
    ],
    skillsBuilt: ["Graphic Design", "Branding", "Marketing", "Project Management"],
    worksWith: ["PR Chair", "Events Chair", "Secretary"],
    bestFitFor: ["Artists", "Designers", "Visual communicators"],
    busySeasons: ["All year (weekly graphics)"],
    sourceConfidence: "High",
    displayOrder: 10
  },
  {
    roleSlug: "pr-chair",
    roleName: "Public Relations Chair",
    aliases: ["PR"],
    boardGroup: "Media & Storytelling",
    status: "new",
    shortDescription: "A newer role focused on video storytelling, event recaps, trailers, TikToks, and public-facing event content.",
    responsibilities: [
      "Film and edit video content for VSA social media (TikTok, Reels).",
      "Create hype videos, event trailers, and recap videos.",
      "Manage social media engagement strategies.",
      "Work with Media to ensure consistent branding."
    ],
    skillsBuilt: ["Video Editing", "Social Media Strategy", "Content Creation"],
    worksWith: ["Media Director", "Historian", "Events Chair"],
    bestFitFor: ["Videographers", "Social media savvy", "Storytellers"],
    busySeasons: ["All year (event-driven)"],
    historyNote: "PR Chair is a newer role focused heavily on dynamic video content, working alongside Historian and Media.",
    sourceConfidence: "High",
    displayOrder: 11
  },
  {
    roleSlug: "historian",
    roleName: "Historian",
    aliases: [],
    boardGroup: "Media & Storytelling",
    status: "current",
    shortDescription: "The documentarian of VSA, capturing memories through photography.",
    responsibilities: [
      "Photograph all VSA events, GBMs, and socials.",
      "Edit and upload photo albums in a timely manner.",
      "Manage the end-of-year banquet slideshow/video.",
      "Maintain the VSA camera equipment and photo archives."
    ],
    skillsBuilt: ["Photography", "Photo Editing", "Archiving"],
    worksWith: ["PR Chair", "Media Director", "Events Chair"],
    bestFitFor: ["Photographers", "Observers", "Memory keepers"],
    busySeasons: ["All year (event-driven)", "Spring (Banquet)"],
    sourceConfidence: "High",
    displayOrder: 12
  },
  {
    roleSlug: "fundraising-chair",
    roleName: "Fundraising Chair",
    aliases: ["Fundraiser"],
    boardGroup: "Finance & Operations",
    status: "current",
    shortDescription: "The driving force behind VSA's independent revenue through food sales, sponsorships, and events.",
    responsibilities: [
      "Plan and execute food fundraisers on Library Walk.",
      "Organize restaurant fundraisers (e.g., boba/food nights).",
      "Seek out sponsorships or grants for VSA.",
      "Work with Treasurer to manage fundraiser profits."
    ],
    skillsBuilt: ["Sales", "Event Planning", "Negotiation", "Logistics"],
    worksWith: ["Treasurer", "Events Chair"],
    bestFitFor: ["Hustlers", "Foodies", "Sales-oriented people"],
    busySeasons: ["All year (consistent sales)"],
    sourceConfidence: "High",
    displayOrder: 13
  },
  {
    roleSlug: "cpc",
    roleName: "Cultural Philanthropy Chair",
    aliases: ["CPC", "Philanthropy"],
    boardGroup: "Culture & External",
    status: "current",
    shortDescription: "The advocate for community service, cultural awareness, and philanthropic outreach within VSA.",
    responsibilities: [
      "Plan volunteering events and community service opportunities for members.",
      "Promote cultural awareness and historical education within the general body.",
      "Connect with local San Diego Vietnamese cultural organizations, community groups, and charters to build exposure, outreach, and partnership opportunities for VSA.",
      "Organize fundraising campaigns and events for philanthropic causes."
    ],
    skillsBuilt: ["Advocacy", "Event Planning", "Public Speaking"],
    worksWith: ["CRC", "Fundraising Chair", "EVP"],
    bestFitFor: ["Volunteers", "Advocates", "Community-minded people"],
    busySeasons: ["Spring (Philanthropy events)"],
    sourceConfidence: "High",
    displayOrder: 14
  },
  {
    roleSlug: "crc",
    roleName: "Community Relations Chair",
    aliases: ["CRC", "Outreach"],
    boardGroup: "Culture & External",
    status: "current",
    shortDescription: "The primary coordinator for the House System and cabinet liaison for San Diego community involvement.",
    responsibilities: [
      "Serves as the main cabinet point person for the House System, coordinating house engagement, communication, and house-related planning across VSA.",
      "Support House Heads and Parents in planning house events, tracking standings, and fostering house spirit.",
      "Connect VSA members with external San Diego community events and local cultural activities.",
      "Coordinate inter-house competitions and joint activities to maintain general member engagement."
    ],
    skillsBuilt: ["Mentorship", "Networking", "Event Planning"],
    worksWith: ["CPC", "EVP", "President", "House Heads", "ACE Chair"],
    bestFitFor: ["Organizers", "Community builders", "House system enthusiasts"],
    busySeasons: ["All year (weekly house tracking)"],
    sourceConfidence: "High",
    displayOrder: 15
  }
];