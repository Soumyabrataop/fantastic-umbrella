"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function Navbar() {
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
      name: "AUTH",
      path: "/auth",
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
    <nav className="fixed bottom-0 left-0 right-0 bg-[#240046] border-t-4 border-[#9D4EDD] shadow-[0_0_20px_rgba(157,78,221,0.5)] z-50 md:hidden">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-around items-center h-20">
          {navItems.map((item) => {
            const isActive = pathname === item.path;

            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex flex-col items-center justify-center w-full h-full transition-all relative group ${
                  isActive ? "scale-110" : "opacity-70 hover:opacity-100"
                }`}
              >
                {/* Active indicator */}
                {isActive && (
                  <div
                    className="absolute top-0 left-1/2 transform -translate-x-1/2 w-16 h-1 retro-glow"
                    style={{
                      backgroundColor: item.color,
                      boxShadow: `0 0 10px ${item.color}`,
                    }}
                  />
                )}

                {/* Icon */}
                <div
                  className={`text-4xl mb-1 font-['Press_Start_2P'] ${
                    isActive ? "retro-glow" : ""
                  }`}
                  style={{ color: isActive ? item.color : "#9D4EDD" }}
                >
                  {item.icon}
                </div>

                {/* Label */}
                <span
                  className={`text-xs font-['Press_Start_2P'] ${
                    isActive ? "retro-glow" : ""
                  }`}
                  style={{
                    color: isActive ? item.color : "#9D4EDD",
                    fontSize: "8px",
                  }}
                >
                  {item.name}
                </span>

                {/* Hover glow effect */}
                {!isActive && (
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      boxShadow: `inset 0 0 20px rgba(157, 78, 221, 0.3)`,
                    }}
                  />
                )}
              </Link>
            );
          })}
        </div>
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
