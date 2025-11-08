"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import React from "react";

// Button Component matching shadcn/ui style
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  children: React.ReactNode;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "default", size = "default", className, children, ...props },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0";

    const variants = {
      default:
        "bg-primary text-primary-foreground shadow-sm shadow-black/5 hover:bg-primary/90",
      outline:
        "border border-input bg-background shadow-sm shadow-black/5 hover:bg-accent hover:text-accent-foreground",
      secondary:
        "bg-secondary text-secondary-foreground shadow-sm shadow-black/5 hover:bg-secondary/80",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      link: "text-primary underline-offset-4 hover:underline",
    };

    const sizes = {
      default: "h-9 px-4 py-2",
      sm: "h-8 rounded-lg px-3 text-xs",
      lg: "h-10 rounded-lg px-8",
      icon: "h-9 w-9",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

// Orbiting Circles Component
interface OrbitingCirclesProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children?: React.ReactNode;
  reverse?: boolean;
  duration?: number;
  delay?: number;
  radius?: number;
  path?: boolean;
  iconSize?: number;
  speed?: number;
  stroke?: string;
}

const OrbitingCircles = ({
  className,
  children,
  reverse,
  duration = 20,
  radius = 160,
  path = true,
  iconSize = 30,
  speed = 1,
  stroke = "currentColor",
  ...props
}: OrbitingCirclesProps) => {
  const calculatedDuration = duration / speed;
  return (
    <>
      {path && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          version="1.1"
          className="pointer-events-none absolute inset-0 size-full"
        >
          <circle
            className={cn("stroke-white/10 stroke-1", stroke && stroke)}
            strokeDasharray="5 5"
            cx="50%"
            cy="50%"
            r={radius}
            fill="none"
          />
        </svg>
      )}
      {React.Children.map(children, (child, index) => {
        const angle = (360 / React.Children.count(children)) * index;
        return (
          <div
            style={
              {
                "--duration": calculatedDuration,
                "--radius": radius,
                "--angle": angle,
                "--icon-size": `${iconSize}px`,
              } as React.CSSProperties
            }
            className={cn(
              `absolute flex size-[var(--icon-size)] transform-gpu animate-orbit items-center justify-center rounded-full`,
              { "[animation-direction:reverse]": reverse },
              className
            )}
            {...props}
          >
            {child}
          </div>
        );
      })}
    </>
  );
};

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden pb-28 md:pl-20">
      {/* Global Styles and Animations */}
      <style jsx global>{`
        @keyframes orbit {
          0% {
            transform: rotate(0deg) translateY(calc(var(--radius) * 1px))
              rotate(0deg);
          }
          100% {
            transform: rotate(360deg) translateY(calc(var(--radius) * 1px))
              rotate(-360deg);
          }
        }

        @keyframes flip {
          0%,
          100% {
            transform: rotateY(0deg);
          }
          50% {
            transform: rotateY(180deg);
          }
        }

        @keyframes rotate {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes image-glow {
          0%,
          100% {
            opacity: 0.5;
          }
          50% {
            opacity: 0.8;
          }
        }

        .animate-orbit {
          animation: orbit calc(var(--duration) * 1s) linear infinite;
        }

        .animate-flip {
          animation: flip 6s infinite;
        }

        .animate-rotate {
          animation: rotate 10s linear infinite;
        }

        .animate-image-glow {
          animation: image-glow 4s ease-in-out infinite;
        }

        .mask-gradient {
          mask-image: linear-gradient(white, transparent 50%);
        }
      `}</style>

      {/* Hero Section */}
      <div className="relative flex flex-col items-center justify-center w-full py-20">
        <div className="absolute flex lg:hidden size-40 rounded-full bg-blue-500 blur-[10rem] top-0 left-1/2 -translate-x-1/2 -z-10"></div>
        <div className="flex flex-col items-center justify-center gap-y-8 relative">
          <OrbitingCircles speed={0.5} radius={300}></OrbitingCircles>
          <OrbitingCircles speed={0.25} radius={400}></OrbitingCircles>
          <OrbitingCircles speed={0.1} radius={500}></OrbitingCircles>

          <div className="flex flex-col items-center justify-center text-center gap-y-4 bg-background/0">
            <button className="group relative grid overflow-hidden rounded-full px-4 py-2 shadow-[0_1000px_0_0_hsl(0_0%_15%)_inset] transition-colors duration-200 mx-auto">
              <span>
                <span className="spark mask-gradient absolute inset-0 h-[100%] w-[100%] animate-flip overflow-hidden rounded-full [mask:linear-gradient(white,_transparent_50%)] before:absolute before:aspect-square before:w-[200%] before:rotate-[-90deg] before:animate-rotate before:bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)] before:content-[''] before:[inset:0_auto_auto_50%] before:[translate:-50%_-15%]" />
              </span>
              <span className="backdrop absolute inset-[1px] rounded-full bg-background transition-colors duration-200 group-hover:bg-neutral-800" />
              <span className="z-10 py-1 text-sm text-white flex items-center">
                <span className="px-2 py-[0.5px] h-[18px] tracking-wide flex items-center justify-center rounded-full bg-gradient-to-r from-blue-400 to-teal-600 text-[9px] font-medium mr-2 text-white">
                  NEW
                </span>
                <span className="ml-2">
                  Enterprise users can{" "}
                  <a href="mailto:support@algobot.space" className="underline">
                    contact us directly via email
                  </a>{" "}
                  for AI and video generation API
                </span>
              </span>
            </button>
            <h1 className="text-4xl md:text-4xl lg:text-7xl font-bold text-center !leading-tight max-w-4xl mx-auto">
              Create viral videos with <span className="">Zapp AI</span>
            </h1>
            <p className="max-w-xl mx-auto mt-2 text-base lg:text-lg text-center text-muted-foreground">
              Transform your ideas into captivating videos using advanced AI.
              Share, explore, and engage with the community.
            </p>

            <div className="flex items-center justify-center mt-6 gap-x-4 z-20">
              <button
                onClick={() => router.push("/create")}
                className="flex items-center gap-2 group"
              >
                <Button
                  size="lg"
                  className="rounded-xl bg-white text-black hover:bg-gray-200"
                >
                  Start Creating
                  <svg
                    className="size-4 group-hover:translate-x-1 transition-all duration-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Button>
              </button>
              <button
                onClick={() => router.push("/feed")}
                className="flex items-center gap-2 group"
              >
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-xl border-white text-white hover:bg-white hover:text-black"
                >
                  Explore Feed
                </Button>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-5xl font-bold text-center mb-16 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Why Choose Zapp AI?
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-purple-900/20 backdrop-blur-sm rounded-xl p-8 border border-purple-500/20 hover:border-purple-500/50 transition-all">
              <div className="text-5xl mb-4">⚡</div>
              <h3 className="text-2xl font-bold text-purple-300 mb-3">
                AI-Powered Creation
              </h3>
              <p className="text-gray-300">
                Generate unique videos from text using advanced AI models. Your
                imagination is the only limit.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-purple-900/20 backdrop-blur-sm rounded-xl p-8 border border-purple-500/20 hover:border-purple-500/50 transition-all">
              <div className="text-5xl mb-4">🎬</div>
              <h3 className="text-2xl font-bold text-purple-300 mb-3">
                Social Feed
              </h3>
              <p className="text-gray-300">
                Discover and explore an infinite feed of AI-generated videos
                ranked by engagement.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-purple-900/20 backdrop-blur-sm rounded-xl p-8 border border-purple-500/20 hover:border-purple-500/50 transition-all">
              <div className="text-5xl mb-4">🚀</div>
              <h3 className="text-2xl font-bold text-purple-300 mb-3">
                Share & Remix
              </h3>
              <p className="text-gray-300">
                Like, recreate, and share videos. Build upon others' ideas while
                giving them credit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-5xl font-bold text-center mb-12 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            {/* FAQ Item 1 */}
            <details className="bg-purple-900/20 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20 group">
              <summary className="text-xl font-semibold text-purple-300 cursor-pointer list-none flex items-center justify-between">
                What is Zapp AI?
                <span className="text-purple-400 group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <p className="text-gray-300 mt-4 leading-relaxed">
                Zapp AI is an AI-powered video generation platform that
                transforms your text prompts into unique videos using advanced
                AI models. Create, share, and explore endless possibilities!
              </p>
            </details>

            {/* FAQ Item 2 */}
            <details className="bg-purple-900/20 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20 group">
              <summary className="text-xl font-semibold text-purple-300 cursor-pointer list-none flex items-center justify-between">
                How does it work?
                <span className="text-purple-400 group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <p className="text-gray-300 mt-4 leading-relaxed">
                Simply enter your creative text prompt in the CREATE section,
                and our AI models will generate a unique video based on your
                description. You can then share it with the community!
              </p>
            </details>

            {/* FAQ Item 3 */}
            <details className="bg-purple-900/20 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20 group">
              <summary className="text-xl font-semibold text-purple-300 cursor-pointer list-none flex items-center justify-between">
                Is it free to use?
                <span className="text-purple-400 group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <p className="text-gray-300 mt-4 leading-relaxed">
                Yes! Zapp AI is completely free to use. Create unlimited videos,
                explore the feed, and engage with the community at no cost.
              </p>
            </details>

            {/* FAQ Item 4 */}
            <details className="bg-purple-900/20 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20 group">
              <summary className="text-xl font-semibold text-purple-300 cursor-pointer list-none flex items-center justify-between">
                How are videos ranked?
                <span className="text-purple-400 group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <p className="text-gray-300 mt-4 leading-relaxed">
                Videos are ranked based on engagement metrics including likes,
                recreates, and shares. The most popular videos appear at the top
                of the feed!
              </p>
            </details>

            {/* FAQ Item 5 */}
            <details className="bg-purple-900/20 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20 group">
              <summary className="text-xl font-semibold text-purple-300 cursor-pointer list-none flex items-center justify-between">
                Can I recreate videos?
                <span className="text-purple-400 group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <p className="text-gray-300 mt-4 leading-relaxed">
                Absolutely! You can recreate any video you see in the feed. This
                feature allows you to remix and build upon other creators' ideas
                while giving them credit.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-8 px-4 border-t border-gray-800">
        <div className="max-w-7xl mx-auto text-center text-gray-400 text-sm">
          <p>
            © 2025 Zapp AI. All rights reserved. •{" "}
            <a
              href="https://github.com/Soumyabrataop/fantastic-umbrella"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-300 hover:text-white transition-colors underline"
            >
              GitHub
            </a>
            {" • "}
            <a
              href="https://telegram.me/codiifycoders"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-300 hover:text-white transition-colors underline"
            >
              Telegram
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
