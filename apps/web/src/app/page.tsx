"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect authenticated users to feed
  useEffect(() => {
    if (!loading && user) {
      router.push("/feed");
    }
  }, [user, loading, router]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1423] retro-scanlines">
        <div className="text-center">
          <div id="ghost">
            <div id="red">
              <div id="top0"></div>
              <div id="top1"></div>
              <div id="top2"></div>
              <div id="top3"></div>
              <div id="top4"></div>
              <div id="st0"></div>
              <div id="st1"></div>
              <div id="st2"></div>
              <div id="st3"></div>
              <div id="st4"></div>
              <div id="st5"></div>
              <div id="an1"></div>
              <div id="an2"></div>
              <div id="an3"></div>
              <div id="an4"></div>
              <div id="an6"></div>
              <div id="an7"></div>
              <div id="an8"></div>
              <div id="an9"></div>
              <div id="an10"></div>
              <div id="an11"></div>
              <div id="an12"></div>
              <div id="an13"></div>
              <div id="an15"></div>
              <div id="an16"></div>
              <div id="an17"></div>
              <div id="an18"></div>
            </div>
            <div id="eye"></div>
            <div id="eye1"></div>
            <div id="pupil"></div>
            <div id="pupil1"></div>
            <div id="shadow"></div>
          </div>
          <p className="text-[#00F5FF] text-2xl font-['VT323'] mt-8 retro-glow">
            LOADING ZAPP...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1A1423] relative overflow-hidden retro-scanlines pb-28">
      {/* Social Links - Top Right */}
      <div className="absolute top-6 right-6 z-20 flex items-center gap-4">
        <a
          href="https://github.com/Soumyabrataop/fantastic-umbrella"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          className="group relative transition-all duration-300 hover:scale-110"
        >
          <svg
            version="1.1"
            viewBox="0 0 100 100"
            className="w-10 h-10 text-[#00F5FF] retro-glow transition-all duration-300 group-hover:drop-shadow-[0_0_15px_#00F5FF] group-hover:scale-110"
          >
            <path
              d="M50,4C24.7,4,4,24.7,4,50c0,20.3,13.2,37.5,31.5,43.6c2.3,0.4,3.1-1,3.1-2.2c0-1.1,0-4.8-0.1-8.7c-12.8,2.8-15.5-5.4-15.5-5.4c-2.1-5.3-5.1-6.7-5.1-6.7c-4.2-2.9,0.3-2.8,0.3-2.8c4.6,0.3,7,4.7,7,4.7c4.1,7,10.8,5,13.5,3.8c0.4-3,1.6-5,2.9-6.2c-10.2-1.2-20.9-5.1-20.9-22.6c0-5,1.8-9.1,4.7-12.3c-0.5-1.2-2-5.9,0.4-12.3c0,0,3.8-1.2,12.6,4.7c3.7-1,7.6-1.5,11.5-1.5c3.9,0,7.9,0.5,11.5,1.5c8.7-5.9,12.6-4.7,12.6-4.7c2.5,6.3,0.9,11.1,0.4,12.3c2.9,3.2,4.7,7.3,4.7,12.3c0,17.6-10.7,21.4-20.9,22.5c1.6,1.4,3.1,4.3,3.1,8.6c0,6.2-0.1,11.2-0.1,12.7c0,1.2,0.8,2.7,3.2,2.2C82.8,87.4,96,70.3,96,50C96,24.7,75.3,4,50,4z"
              fill="currentColor"
            />
          </svg>
        </a>

        <a
          href="https://telegram.me/codiifycoders"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Telegram"
          className="group relative transition-all duration-300 hover:scale-110"
        >
          <svg
            version="1.1"
            viewBox="0 0 100 100"
            className="w-10 h-10 text-[#FF006E] retro-glow transition-all duration-300 group-hover:drop-shadow-[0_0_15px_#FF006E] group-hover:scale-110"
          >
            <path
              d="M95,9.9c-1.3-1.1-3.4-1.2-7-0.1c0,0,0,0,0,0c-2.5,0.8-24.7,9.2-44.3,17.3c-17.6,7.3-31.9,13.7-33.6,14.5  c-1.9,0.6-6,2.4-6.2,5.2c-0.1,1.8,1.4,3.4,4.3,4.7c3.1,1.6,16.8,6.2,19.7,7.1c1,3.4,6.9,23.3,7.2,24.5c0.4,1.8,1.6,2.8,2.2,3.2  c0.1,0.1,0.3,0.3,0.5,0.4c0.3,0.2,0.7,0.3,1.2,0.3c0.7,0,1.5-0.3,2.2-0.8c3.7-3,10.1-9.7,11.9-11.6c7.9,6.2,16.5,13.1,17.3,13.9  c0,0,0.1,0.1,0.1,0.1c1.9,1.6,3.9,2.5,5.7,2.5c0.6,0,1.2-0.1,1.8-0.3c2.1-0.7,3.6-2.7,4.1-5.4c0-0.1,0.1-0.5,0.3-1.2  c3.4-14.8,6.1-27.8,8.3-38.7c2.1-10.7,3.8-21.2,4.8-26.8c0.2-1.4,0.4-2.5,0.5-3.2C96.3,13.5,96.5,11.2,95,9.9z M30,58.3l47.7-31.6  c0.1-0.1,0.3-0.2,0.4-0.3c0,0,0,0,0,0c0.1,0,0.1-0.1,0.2-0.1c0.1,0,0.1,0,0.2-0.1c-0.1,0.1-0.2,0.4-0.4,0.6L66,38.1  c-8.4,7.7-19.4,17.8-26.7,24.4c0,0,0,0,0,0.1c0,0-0.1,0.1-0.1,0.1c0,0,0,0.1-0.1,0.1c0,0.1,0,0.1-0.1,0.2c0,0,0,0.1,0,0.1  c0,0,0,0,0,0.1c-0.5,5.6-1.4,15.2-1.8,19.5c0,0,0,0,0-0.1C36.8,81.4,31.2,62.3,30,58.3z"
              fill="currentColor"
            />
          </svg>
        </a>
      </div>

      {/* Retro Grid Background */}
      <div className="absolute inset-0 opacity-20">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
            linear-gradient(#9D4EDD 1px, transparent 1px),
            linear-gradient(90deg, #9D4EDD 1px, transparent 1px)
          `,
            backgroundSize: "50px 50px",
          }}
        ></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-16">
          {/* Headline */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-6xl font-['Press_Start_2P'] leading-tight px-4">
              <span className="text-[#FF006E]">ZAPP AI</span>
              <br />
              <span className="text-[#00F5FF]">VIDEO GENERATOR</span>
            </h1>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
            <button
              onClick={() => router.push("/feed")}
              className="retro-btn group flex items-center gap-4"
            >
              <span>▶ EXPLORE</span>
            </button>

            <button
              onClick={() => router.push("/create")}
              className="retro-btn"
              style={{
                background: "linear-gradient(180deg, #00F5FF 0%, #9D4EDD 100%)",
                color: "#1A1423",
              }}
            >
              ✦ CREATE ✦
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Feature 1 */}
          <div className="retro-card p-6 hover:scale-105 transition-transform">
            <div className="mb-6 text-center">
              <div className="text-6xl text-[#FFBE0B] retro-glow mb-4">⚡</div>
            </div>
            <h3
              className="text-2xl font-['Press_Start_2P'] text-[#FF006E] mb-4 text-center"
              style={{ fontSize: "14px" }}
            >
              AI POWERED
            </h3>
            <p className="text-[#00F5FF] text-xl font-['VT323'] text-center leading-relaxed">
              GENERATE UNIQUE VIDEOS FROM TEXT USING ADVANCED AI MODELS
            </p>
          </div>

          {/* Feature 2 */}
          <div className="retro-card p-6 hover:scale-105 transition-transform">
            <div className="mb-6 text-center">
              <div className="text-6xl text-[#00F5FF] retro-glow mb-4">◈</div>
            </div>
            <h3
              className="text-2xl font-['Press_Start_2P'] text-[#9D4EDD] mb-4 text-center"
              style={{ fontSize: "14px" }}
            >
              SOCIAL FEED
            </h3>
            <p className="text-[#FFBE0B] text-xl font-['VT323'] text-center leading-relaxed">
              INFINITE SCROLL WITH VIDEOS RANKED BY ENGAGEMENT
            </p>
          </div>

          {/* Feature 3 */}
          <div className="retro-card p-6 hover:scale-105 transition-transform">
            <div className="mb-6 text-center">
              <div className="text-6xl text-[#06FFA5] retro-glow mb-4">↻</div>
            </div>
            <h3
              className="text-2xl font-['Press_Start_2P'] text-[#00F5FF] mb-4 text-center"
              style={{ fontSize: "14px" }}
            >
              SHARE EPIC
            </h3>
            <p className="text-[#FF006E] text-xl font-['VT323'] text-center leading-relaxed">
              LIKE, RECREATE AND SHARE YOUR FAVORITE VIDEOS
            </p>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto mt-24">
          <h2 className="text-3xl font-['Press_Start_2P'] text-[#00F5FF] text-center mb-12 retro-glow">
            FAQ
          </h2>

          <div className="space-y-4">
            {/* FAQ Item 1 */}
            <details className="retro-card p-6 group">
              <summary
                className="text-xl font-['Press_Start_2P'] text-[#FF006E] cursor-pointer list-none flex items-center justify-between"
                style={{ fontSize: "14px" }}
              >
                WHAT IS ZAPP?
                <span className="text-[#00F5FF] group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <p className="text-[#00F5FF] text-lg font-['VT323'] mt-4 leading-relaxed">
                ZAPP is an AI-powered video generation platform that transforms
                your text prompts into unique videos using advanced AI models.
                Create, share, and explore endless possibilities!
              </p>
            </details>

            {/* FAQ Item 2 */}
            <details className="retro-card p-6 group">
              <summary
                className="text-xl font-['Press_Start_2P'] text-[#FF006E] cursor-pointer list-none flex items-center justify-between"
                style={{ fontSize: "14px" }}
              >
                HOW DOES IT WORK?
                <span className="text-[#00F5FF] group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <p className="text-[#00F5FF] text-lg font-['VT323'] mt-4 leading-relaxed">
                Simply enter your creative text prompt in the CREATE section,
                and our AI models will generate a unique video based on your
                description. You can then share it with the community!
              </p>
            </details>

            {/* FAQ Item 3 */}
            <details className="retro-card p-6 group">
              <summary
                className="text-xl font-['Press_Start_2P'] text-[#FF006E] cursor-pointer list-none flex items-center justify-between"
                style={{ fontSize: "14px" }}
              >
                IS IT FREE TO USE?
                <span className="text-[#00F5FF] group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <p className="text-[#00F5FF] text-lg font-['VT323'] mt-4 leading-relaxed">
                Yes! ZAPP is completely free to use. Create unlimited videos,
                explore the feed, and engage with the community at no cost.
              </p>
            </details>

            {/* FAQ Item 4 */}
            <details className="retro-card p-6 group">
              <summary
                className="text-xl font-['Press_Start_2P'] text-[#FF006E] cursor-pointer list-none flex items-center justify-between"
                style={{ fontSize: "14px" }}
              >
                HOW ARE VIDEOS RANKED?
                <span className="text-[#00F5FF] group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <p className="text-[#00F5FF] text-lg font-['VT323'] mt-4 leading-relaxed">
                Videos are ranked based on engagement metrics including likes,
                recreates, and shares. The most popular videos appear at the top
                of the feed and leaderboard!
              </p>
            </details>

            {/* FAQ Item 5 */}
            <details className="retro-card p-6 group">
              <summary
                className="text-xl font-['Press_Start_2P'] text-[#FF006E] cursor-pointer list-none flex items-center justify-between"
                style={{ fontSize: "14px" }}
              >
                CAN I RECREATE VIDEOS?
                <span className="text-[#00F5FF] group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <p className="text-[#00F5FF] text-lg font-['VT323'] mt-4 leading-relaxed">
                Absolutely! You can recreate any video you see in the feed. This
                feature allows you to remix and build upon other creators' ideas
                while giving them credit.
              </p>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
