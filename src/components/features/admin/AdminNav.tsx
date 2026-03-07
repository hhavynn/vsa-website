import { Link, useLocation } from "react-router-dom";

export function AdminNav() {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 mb-8">
      <div className="flex space-x-4">
        <Link
          to="/admin/events"
          className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
            isActive("/admin/events")
              ? "bg-indigo-600 text-white"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
        >
          Events
        </Link>
        <Link
          to="/admin/gallery"
          className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
            isActive("/admin/gallery")
              ? "bg-indigo-600 text-white"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
        >
          Gallery
        </Link>
        <Link
          to="/admin/feedback"
          className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
            isActive("/admin/feedback")
              ? "bg-indigo-600 text-white"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
        >
          Feedback
        </Link>
      </div>
    </nav>
  );
}
