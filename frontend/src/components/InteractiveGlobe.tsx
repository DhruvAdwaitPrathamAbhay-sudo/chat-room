"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { CountryData } from "./geographic/countries";
import { FingerprintIcon } from "./ui";

// Dynamic import with SSR disabled for Three.js WebGL canvas
const GlobeScene = dynamic(() => import("./GlobeScene"), {
  ssr: false,
  loading: () => <GlobeFallback />,
});

interface InteractiveGlobeProps {
  onCountrySelect?: (country: CountryData) => void;
  className?: string;
}

export default function InteractiveGlobe({ onCountrySelect, className = "" }: InteractiveGlobeProps) {
  const [webGlSupported, setWebGlSupported] = useState<boolean | null>(null);

  useEffect(() => {
    // WebGL capability check
    try {
      const canvas = document.createElement("canvas");
      const hasWebGL = !!(
        window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
      );
      setWebGlSupported(hasWebGL);
    } catch {
      setWebGlSupported(false);
    }
  }, []);

  if (webGlSupported === false) {
    return <GlobeFallback />;
  }

  return (
    <div className={`relative w-full h-[360px] sm:h-[440px] md:h-[520px] lg:h-[620px] xl:h-[680px] flex items-center justify-center ${className}`}>
      <GlobeScene onCountrySelect={onCountrySelect} />
    </div>
  );
}

function GlobeFallback() {
  return (
    <div className="w-full h-[360px] sm:h-[440px] flex flex-col items-center justify-center">
      <div className="w-36 h-36 sm:w-48 sm:h-48 rounded-full bg-gradient-to-tr from-[#050811] via-[#121d2d] to-[var(--veil-cyan)]/20 border-2 border-[var(--veil-cyan)]/40 flex items-center justify-center shadow-[0_0_40px_rgba(0,240,255,0.2)] animate-pulse">
        <FingerprintIcon className="text-[var(--veil-cyan)] w-14 h-14" />
      </div>
      <p className="mt-4 text-xs text-[var(--veil-text-muted)] font-medium">
        Connecting to global anonymous spaces...
      </p>
    </div>
  );
}
