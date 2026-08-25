"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { CountryData } from "./geographic/countries";

const GlobeScene = dynamic(() => import("./GlobeScene"), {
  ssr: false,
  loading: () => <GlobeSkeleton />,
});

interface InteractiveGlobeProps {
  onCountrySelect?: (country: CountryData) => void;
  className?: string;
  /** Show the stats panel overlay (people online / active rooms) */
  showStats?: boolean;
}

// Demo stats — wire to real backend data when API supports it
const DEMO_STATS = {
  peopleOnline: 2847,
  activeRooms: 156,
};

export default function InteractiveGlobe({
  onCountrySelect,
  className = "",
  showStats = false,
}: InteractiveGlobeProps) {
  const [webGlOk, setWebGlOk] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setWebGlOk(
        !!(
          window.WebGLRenderingContext &&
          (c.getContext("webgl") || c.getContext("experimental-webgl"))
        )
      );
    } catch {
      setWebGlOk(false);
    }
  }, []);

  if (webGlOk === false) return <GlobeSkeleton />;

  return (
    <div className={`relative w-full h-full ${className}`}>
      <GlobeScene onCountrySelect={onCountrySelect} />

      {/* Stats overlay — bottom right of globe area */}
      {showStats && (
        <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-20 pointer-events-none">
          <div className="flex items-center gap-4 bg-black/70 border border-white/10 backdrop-blur-xl rounded-2xl px-5 py-3 shadow-2xl">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-gray-400 text-xs font-medium">People online</span>
              </div>
              <span className="text-white text-xl font-bold tabular-nums">
                {DEMO_STATS.peopleOnline.toLocaleString()}
              </span>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" style={{ animationDelay: "0.5s" }} />
                <span className="text-gray-400 text-xs font-medium">Active rooms</span>
              </div>
              <span className="text-white text-xl font-bold tabular-nums">
                {DEMO_STATS.activeRooms}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GlobeSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="relative">
        <div className="w-48 h-48 sm:w-64 sm:h-64 lg:w-80 lg:h-80 rounded-full bg-gradient-to-br from-[#050a18] via-[#0a1628] to-[#030609] border border-cyan-500/20 shadow-[0_0_60px_rgba(0,180,255,0.15)] animate-pulse" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
        </div>
      </div>
    </div>
  );
}
