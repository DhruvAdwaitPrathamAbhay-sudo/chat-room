"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import { COUNTRIES, CountryData } from "../geographic/countries";

// Dynamically import the Globe component to prevent SSR (server-side rendering) errors in Next.js
const Globe = dynamic(() => import("react-globe.gl"), {
  ssr: false,
  loading: () => <GlobeSkeleton />,
});

interface InteractiveGlobeProps {
  onCountrySelect?: (country: CountryData) => void;
  className?: string;
  showStats?: boolean;
}

// Generate demo connection arcs between some of the country pairs
const ARCS_DATA = [
  { startLat: 20.5937, startLng: 78.9629, endLat: 37.0902, endLng: -95.7129 }, // India to US
  { startLat: 20.5937, startLng: 78.9629, endLat: 55.3781, endLng: -3.436 },  // India to UK
  { startLat: 37.0902, startLng: -95.7129, endLat: 36.2048, endLng: 138.2529 }, // US to Japan
  { startLat: 55.3781, startLng: -3.436, endLat: -14.235, endLng: -51.9253 }, // UK to Brazil
  { startLat: 51.1657, startLng: 10.4515, endLat: -25.2744, endLng: 133.7751 }, // Germany to Australia
  { startLat: 36.2048, startLng: 138.2529, endLat: 1.3521, endLng: 103.8198 }, // Japan to Singapore
  { startLat: 52.1326, startLng: 5.2913, endLat: 23.4241, endLng: 53.8478 },  // Netherlands to UAE
];

// Neutral stat placeholders — real data not yet wired
const DEMO_STATS = {
  peopleOnline: "--",
  activeRooms: "--",
};

export default function InteractiveGlobe({
  onCountrySelect,
  className = "",
  showStats = false,
}: InteractiveGlobeProps) {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [webGlOk, setWebGlOk] = useState<boolean | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);
  const [currentZoom, setCurrentZoom] = useState(2.2);
  const [dimensions, setDimensions] = useState({ width: 500, height: 500 });
  const [customMaterial, setCustomMaterial] = useState<THREE.MeshPhongMaterial | null>(null);

  // Monitor parent container size dynamically
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // fallback to width if height is 0 (i.e. parent is flex-based before render)
        setDimensions({
          width: width || 500,
          height: height || width || 500,
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [webGlOk]);

  // Check WebGL availability and load Earth textures
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      const hasWebGL = !!(
        window.WebGLRenderingContext &&
        (c.getContext("webgl") || c.getContext("experimental-webgl"))
      );
      setWebGlOk(hasWebGL);

      if (hasWebGL) {
        const loader = new THREE.TextureLoader();
        loader.load("/earth-blue-marble.jpg", (dayTexture) => {
          loader.load("/earth-night.jpg", (nightTexture) => {
            const material = new THREE.MeshPhongMaterial({
              map: dayTexture,
              emissiveMap: nightTexture,
              emissive: new THREE.Color(0xffffaa),
              emissiveIntensity: 1.8,
              shininess: 25,
              specular: new THREE.Color(0x224466),
            });
            setCustomMaterial(material);
          });
        });
      }
    } catch {
      setWebGlOk(false);
    }
  }, []);

  // Called by react-globe.gl once the canvas & Three.js scene are fully ready.
  // This is the correct place to configure OrbitControls — globeRef.current is
  // guaranteed to be populated when this fires (unlike a useEffect([webGlOk])).
  const handleGlobeReady = () => {
    if (!globeRef.current) return;
    const controls = globeRef.current.controls();
    if (!controls) return;

    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 200;
    controls.maxDistance = 600;

    // Respect the user's OS reduced-motion preference
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!prefersReduced) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.4;

      const onStart = () => { controls.autoRotate = false; };
      const onEnd = () => { setTimeout(() => { controls.autoRotate = true; }, 1500); };
      controls.addEventListener("start", onStart);
      controls.addEventListener("end", onEnd);
    }
  };

  const handleZoomIn = () => {
    if (!globeRef.current) return;
    const nextZoom = Math.max(1.2, currentZoom - 0.35);
    setCurrentZoom(nextZoom);
    globeRef.current.pointOfView({ altitude: nextZoom }, 400);
  };

  const handleZoomOut = () => {
    if (!globeRef.current) return;
    const nextZoom = Math.min(4.0, currentZoom + 0.35);
    setCurrentZoom(nextZoom);
    globeRef.current.pointOfView({ altitude: nextZoom }, 400);
  };

  const handleReset = () => {
    if (!globeRef.current) return;
    setCurrentZoom(2.2);
    setSelectedCountry(null);
    globeRef.current.pointOfView({ lat: 20, lng: 0, altitude: 2.2 }, 600);
  };

  const handlePointClick = (point: any) => {
    const country = point as CountryData;
    setSelectedCountry(country);
    if (onCountrySelect) onCountrySelect(country);

    // Smoothly pan & zoom to the clicked country
    if (globeRef.current) {
      globeRef.current.pointOfView(
        { lat: country.lat, lng: country.lng, altitude: 1.5 },
        800
      );
    }
  };

  if (webGlOk === false) return <GlobeSkeleton />;

  return (
    <div ref={containerRef} className={`relative w-full h-full min-h-[350px] ${className}`}>
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl={customMaterial ? "" : "/earth-night.jpg"}
        globeMaterial={customMaterial || undefined}
        backgroundColor="rgba(0, 0, 0, 0)"
        showAtmosphere={true}
        atmosphereColor="#0088ff"
        atmosphereAltitude={0.18}
        showGraticules={true} // subtle semi-transparent lat/lng grid
        
        // Country markers
        pointsData={COUNTRIES}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => "#00f0ff"}
        pointAltitude={0.03}
        pointRadius={0.04}
        onPointClick={handlePointClick}
        pointLabel={(p: any) => `
          <div style="
            background: rgba(8, 8, 8, 0.95);
            border: 1px solid rgba(0, 240, 255, 0.3);
            border-radius: 12px;
            padding: 8px 12px;
            color: #ffffff;
            font-family: system-ui, sans-serif;
            font-size: 13px;
            box-shadow: 0 4px 20px rgba(0, 240, 255, 0.15);
          ">
            <div style="font-weight: bold; margin-bottom: 2px;">${p.name}</div>
            <div style="color: #00f0ff; font-size: 11px;">Active users: ${p.activeUsers || 0}</div>
          </div>
        `}

        // Network connection arcs
        arcsData={ARCS_DATA}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor={() => "rgba(0, 240, 255, 0.5)"}
        arcDashLength={0.4}
        arcDashGap={2}
        arcDashAnimateTime={2000}
        arcStroke={0.04}
        onGlobeReady={handleGlobeReady}
      />

      {/* Elegant floating information panel near the globe when country selected */}
      {selectedCountry && (
        <div className="absolute left-4 top-4 z-20 pointer-events-none animate-in fade-in duration-200">
          <div className="bg-[#080808]/90 border border-[var(--veil-cyan)]/40 backdrop-blur-xl rounded-2xl p-4 shadow-[0_0_30px_rgba(0,240,255,0.15)] min-w-[160px]">
            <h3 className="text-white font-bold text-sm tracking-tight mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--veil-cyan)] animate-ping" />
              {selectedCountry.name}
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-4 text-gray-400">
                <span>Network Nodes:</span>
                <span className="text-white font-mono font-semibold">Active</span>
              </div>
              <div className="flex justify-between gap-4 text-gray-400">
                <span>Encryption:</span>
                <span className="text-white font-mono font-semibold">Enabled</span>
              </div>
            </div>
            <p className="text-[10px] text-[var(--veil-cyan)] mt-2 font-medium">Click explore in rooms</p>
          </div>
        </div>
      )}

      {/* Styled controls overlay matching the Veil design theme */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-20">
        <button
          onClick={handleZoomIn}
          aria-label="Zoom in"
          className="w-9 h-9 bg-black/60 border border-white/10 hover:border-[var(--veil-cyan)]/50 text-white rounded-xl text-lg font-bold flex items-center justify-center backdrop-blur-md transition-all active:scale-95"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          aria-label="Zoom out"
          className="w-9 h-9 bg-black/60 border border-white/10 hover:border-[var(--veil-cyan)]/50 text-white rounded-xl text-lg font-bold flex items-center justify-center backdrop-blur-md transition-all active:scale-95"
        >
          −
        </button>
        <button
          onClick={handleReset}
          aria-label="Reset view"
          className="w-9 h-9 bg-black/60 border border-white/10 hover:border-[var(--veil-cyan)]/50 text-white rounded-xl text-base flex items-center justify-center backdrop-blur-md transition-all active:scale-95"
        >
          ⊙
        </button>
      </div>

      {/* Hero Activity Indicator / Live Network */}
      {showStats && (
        <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-20 pointer-events-none">
          <div className="flex items-center gap-3 bg-black/80 border border-white/10 backdrop-blur-xl rounded-2xl px-4 py-2.5 shadow-2xl">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-white text-xs font-bold tracking-wider uppercase">Live Network</span>
            </div>
            <div className="w-px h-4 bg-white/15" />
            <span className="text-gray-400 text-xs font-medium">Explore Active Spaces</span>
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
