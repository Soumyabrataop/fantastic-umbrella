"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function DesktopNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems = [
    {
      name: "FEED",
      path: "/feed",
      icon: "◈",
      color: "#00F5FF",
    },
    {
      name: "CREATE",
      path: "/create",
      icon: "✦",
      color: "#FF006E",
    },
    {
      name: "RANKS",
      path: "/leaderboard",
      icon: "★",
      color: "#FFBE0B",
    },
    {
      name: "PROFILE",
      path: "/profile",
      icon: "●",
      color: "#06FFA5",
    },
  ];

  return (
    <nav className="hidden md:block fixed left-0 top-0 bottom-0 w-20 bg-[#240046] border-r-4 border-[#9D4EDD] shadow-[0_0_20px_rgba(157,78,221,0.5)] z-50">
      <div className="flex flex-col items-center h-full py-8 gap-8">
        {/* Logo/Brand - Home Icon */}
        <Link href="/" className="mb-4 group">
          <div className="text-[#9D4EDD] text-3xl font-['Press_Start_2P'] group-hover:text-[#00F5FF] transition-colors retro-glow">
            ⌂
          </div>
        </Link>

        {/* Nav Items */}
        {navItems.map((item) => {
          const isActive = pathname === item.path;

          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex flex-col items-center justify-center w-16 h-16 transition-all relative group ${
                isActive ? "scale-110" : "opacity-70 hover:opacity-100"
              }`}
              title={item.name}
            >
              {/* Active indicator */}
              {isActive && (
                <div
                  className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-12 retro-glow"
                  style={{
                    backgroundColor: item.color,
                    boxShadow: `0 0 10px ${item.color}`,
                  }}
                />
              )}

              {/* Icon */}
              <div
                className={`text-3xl font-['Press_Start_2P'] ${
                  isActive ? "retro-glow" : ""
                }`}
                style={{ color: isActive ? item.color : "#9D4EDD" }}
              >
                {item.icon}
              </div>

              {/* Label - shown on hover */}
              <span
                className={`absolute left-full ml-4 px-3 py-1 bg-[#240046] border-2 border-[#9D4EDD] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-xs font-['Press_Start_2P'] pointer-events-none`}
                style={{
                  color: item.color,
                  fontSize: "8px",
                }}
              >
                {item.name}
              </span>

              {/* Hover glow effect */}
              {!isActive && (
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                  style={{
                    boxShadow: `inset 0 0 20px rgba(157, 78, 221, 0.3)`,
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* Scanline effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.1) 1px, transparent 1px, transparent 2px)",
        }}
      ></div>
    </nav>
  );
}
