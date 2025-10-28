"use client";

export default function VideoLoader() {
  return (
    <div className="relative h-screen w-full bg-gray-900 dark:bg-black flex items-center justify-center p-4">
      {/* Centered Container - Matching video card style */}
      <div className="relative w-full max-w-md h-full bg-black rounded-3xl border-4 border-black dark:border-purple-500 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] dark:shadow-[12px_12px_0px_0px_rgba(168,85,247,1)] overflow-hidden flex items-center justify-center">
        <div className="text-center">
          {/* Ghost Loader */}
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
          <p className="text-[#9D4EDD] text-xl font-['VT323'] mt-8">
            LOADING VIDEO...
          </p>
        </div>
      </div>
    </div>
  );
}
