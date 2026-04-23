import { Link, useLocation } from "react-router-dom";

const NAV_LINKS = [
  { to: "/admin/content",          label: "Content" },
  { to: "/admin/events",           label: "Events" },
  { to: "/admin/gallery",          label: "Gallery" },
  { to: "/admin/feedback",         label: "Feedback" },
  { to: "/admin/import",           label: "Import" },
  { to: "/admin/members",          label: "Members" },
  { to: "/admin/merge-suggestions",label: "Merge" },
  { to: "/admin/points",           label: "Points" },
  { to: "/admin/cabinet",          label: "Cabinet" },
];

export function AdminNav() {
  const { pathname } = useLocation();

  return (
    <nav className="border-b border-zinc-200 dark:border-[#27272a] mb-8 -mx-8 px-8 flex gap-0.5 overflow-x-auto">
      {NAV_LINKS.map(({ to, label }) => (
        <Link
          key={to}
          to={to}
          className={`px-3 py-2.5 text-[13px] font-medium border-b-2 -mb-px shrink-0 transition-colors ${
            pathname === to
              ? "border-indigo-600 text-[#09090b] dark:text-[#fafafa]"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
