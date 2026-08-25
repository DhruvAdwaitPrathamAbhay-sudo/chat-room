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
    <div className={`relative w-full h-[320px] sm:h-[380px] md:h-[440px] max-w-lg mx-auto flex items-center justify-center ${className}`}>
      <GlobeScene onCountrySelect={onCountrySelect} />
    </div>
  );
}

function GlobeFallback() {
  return (
    <div className="w-full h-[320px] sm:h-[380px] max-w-lg mx-auto flex flex-col items-center justify-center">
      <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-tr from-[#070c14] via-[#162436] to-[var(--veil-cyan)]/20 border-2 border-[var(--veil-cyan)]/40 flex items-center justify-center shadow-[0_0_30px_rgba(0,229,255,0.15)] animate-pulse">
        <FingerprintIcon className="text-[var(--veil-cyan)] w-12 h-12" />
      </div>
      <p className="mt-3 text-xs text-[var(--veil-text-muted)] font-medium">
        Connecting to global anonymous spaces...
      </p>
    </div>
  );
}
