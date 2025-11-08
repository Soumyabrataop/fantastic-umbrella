"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function DesktopNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems = [
    {
      name: "Home",
      path: "/",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      name: "Feed",
      path: "/feed",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
          />
        </svg>
      ),
    },
    {
      name: "Create",
      path: "/create",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      ),
    },
    {
      name: "Profile",
      path: "/profile",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
  ];

  return (
    <nav className="hidden md:block fixed left-0 top-0 bottom-0 w-20 bg-gradient-to-b from-gray-900 via-black to-gray-900 border-r border-gray-800 z-50 backdrop-blur-xl">
      <div className="flex flex-col items-center h-full py-6 gap-2">
        {/* Nav Items */}
        <div className="flex-1 flex flex-col gap-2 mt-4">
          {navItems.map((item) => {
            const isActive = pathname === item.path;

            return (
              <Link
                key={item.path}
                href={item.path}
                className="relative group"
                title={item.name}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 bg-gradient-to-b from-purple-500 to-pink-500 rounded-r-full shadow-lg shadow-purple-500/50" />
                )}

                {/* Icon Container */}
                <div
                  className={`
                    flex items-center justify-center w-16 h-16 mx-2 rounded-xl transition-all duration-300
                    ${
                      isActive
                        ? "bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-white shadow-lg shadow-purple-500/20"
                        : "text-gray-500 hover:text-white hover:bg-gray-800/50"
                    }
                  `}
                >
                  {item.icon}
                </div>

                {/* Tooltip */}
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap border border-gray-700 shadow-xl">
                  {item.name}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-r-4 border-r-gray-900" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Bottom Section - User/Settings */}
        {user && (
          <div className="mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-500/30">
              {user.email?.[0].toUpperCase() || "U"}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
