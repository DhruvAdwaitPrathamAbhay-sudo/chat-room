"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { COUNTRIES, CountryData, latLngToVector3 } from "./geographic/countries";
import { createInitialGlobeState, updateGlobeState, GlobeState } from "./GlobeControls";

interface GlobeSceneProps {
  onCountrySelect?: (country: CountryData) => void;
  className?: string;
}

// Earth texture URLs — realistic night-side Earth from NASA/public domain
const EARTH_NIGHT_TEXTURE =
  "https://raw.githubusercontent.com/turban/webgl-earth/master/images/4096-night.jpg";
const EARTH_DAY_TEXTURE =
  "https://raw.githubusercontent.com/turban/webgl-earth/master/images/2_no_clouds_4k.jpg";
const EARTH_SPECULAR_TEXTURE =
  "https://raw.githubusercontent.com/turban/webgl-earth/master/images/water_4k.png";

export default function GlobeScene({ onCountrySelect, className = "" }: GlobeSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCountry, setHoveredCountry] = useState<CountryData | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);
  const stateRef = useRef<GlobeState>(createInitialGlobeState());

  const handleCountrySelect = useCallback(
    (country: CountryData) => {
      setSelectedCountry(country);
      if (onCountrySelect) onCountrySelect(country);
    },
    [onCountrySelect]
  );

  useEffect(() => {
    const targetContainer = containerRef.current;
    if (!targetContainer) return;

    // ── 1. Setup ────────────────────────────────────────────────────────────
    const width = targetContainer.clientWidth || 500;
    const height = targetContainer.clientHeight || 500;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.z = stateRef.current.zoom;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    targetContainer.appendChild(renderer.domElement);

    // ── 2. Stars background ──────────────────────────────────────────────────
    const starGeom = new THREE.BufferGeometry();
    const starCount = 2000;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
      starPositions[i] = (Math.random() - 0.5) * 300;
    }
    starGeom.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.18,
      transparent: true,
      opacity: 0.7,
    });
    scene.add(new THREE.Points(starGeom, starMat));

    // ── 3. Lights ────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x111122, 2));

    // Sunlight from the left-front — illuminates day side
    const sunLight = new THREE.DirectionalLight(0xffffff, 3.5);
    sunLight.position.set(-5, 2, 3);
    scene.add(sunLight);

    // Subtle cyan backlight / atmosphere glow
    const backLight = new THREE.DirectionalLight(0x1a88ff, 0.6);
    backLight.position.set(5, -1, -3);
    scene.add(backLight);

    // ── 4. Globe group ───────────────────────────────────────────────────────
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);
    const GLOBE_RADIUS = 2.0;

    // ── 5. Earth sphere with real texture ────────────────────────────────────
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";

    const globeGeometry = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);

    // Start with a dark procedural texture while real one loads
    const fallbackCanvas = document.createElement("canvas");
    fallbackCanvas.width = 512;
    fallbackCanvas.height = 256;
    const ctx = fallbackCanvas.getContext("2d");
    if (ctx) {
      // Deep dark ocean
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, "#050a18");
      grad.addColorStop(1, "#030609");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 256);

      // Grid lines
      ctx.strokeStyle = "rgba(0, 200, 255, 0.07)";
      ctx.lineWidth = 1;
      for (let x = 0; x < 512; x += 32) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
      }
      for (let y = 0; y < 256; y += 16) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
      }

      // Landmass blobs
      ctx.fillStyle = "#0d1f30";
      for (let i = 0; i < 2000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 256;
        const isLand =
          (y > 40 && y < 200 && (x < 180 || (x > 220 && x < 420))) ||
          (y > 160 && y < 230 && x > 120 && x < 210);
        if (isLand) {
          ctx.beginPath();
          ctx.arc(x, y, Math.random() * 3 + 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // City lights — golden amber
      ctx.fillStyle = "#ffa040";
      for (let i = 0; i < 120; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 256;
        const isLand =
          (y > 50 && y < 190 && (x < 170 || (x > 230 && x < 410)));
        if (isLand) {
          ctx.globalAlpha = Math.random() * 0.8 + 0.2;
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    const fallbackTexture = new THREE.CanvasTexture(fallbackCanvas);
    const globeMaterial = new THREE.MeshPhongMaterial({
      map: fallbackTexture,
      shininess: 8,
      specular: new THREE.Color(0x1a3a5c),
    });
    const globeMesh = new THREE.Mesh(globeGeometry, globeMaterial);
    globeGroup.add(globeMesh);

    // Try loading real NASA night Earth texture
    loader.load(
      EARTH_NIGHT_TEXTURE,
      (nightTex) => {
        nightTex.colorSpace = THREE.SRGBColorSpace;
        globeMaterial.map = nightTex;
        globeMaterial.needsUpdate = true;

        // Load specular for ocean shimmer
        loader.load(EARTH_SPECULAR_TEXTURE, (specTex) => {
          globeMaterial.specularMap = specTex;
          globeMaterial.shininess = 30;
          globeMaterial.specular = new THREE.Color(0x336688);
          globeMaterial.needsUpdate = true;
        });
      },
      undefined,
      () => {
        // Silently keep the fallback texture on error
      }
    );

    // ── 6. Atmosphere glow ───────────────────────────────────────────────────
    const atmGeom = new THREE.SphereGeometry(GLOBE_RADIUS * 1.06, 64, 64);
    const atmMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float rim = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
          rim = pow(rim, 3.0);
          gl_FragColor = vec4(0.1, 0.5, 1.0, 1.0) * rim * 0.7;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    globeGroup.add(new THREE.Mesh(atmGeom, atmMat));

    // Outer softer glow halo
    const haloGeom = new THREE.SphereGeometry(GLOBE_RADIUS * 1.14, 64, 64);
    const haloMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float rim = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
          rim = pow(rim, 5.0);
          gl_FragColor = vec4(0.05, 0.3, 0.9, 1.0) * rim * 0.35;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    globeGroup.add(new THREE.Mesh(haloGeom, haloMat));

    // ── 7. Country markers ───────────────────────────────────────────────────
    const markersGroup = new THREE.Group();
    globeGroup.add(markersGroup);

    const markerMeshes: { mesh: THREE.Mesh; country: CountryData; ring: THREE.Mesh }[] = [];

    COUNTRIES.forEach((country) => {
      const [x, y, z] = latLngToVector3(country.lat, country.lng, GLOBE_RADIUS + 0.025);

      // Inner dot
      const dotGeom = new THREE.SphereGeometry(0.035, 12, 12);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
      const dot = new THREE.Mesh(dotGeom, dotMat);
      dot.position.set(x, y, z);
      markersGroup.add(dot);

      // Pulsing ring
      const ringGeom = new THREE.RingGeometry(0.05, 0.07, 20);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.set(x, y, z);
      ring.lookAt(0, 0, 0);
      markersGroup.add(ring);

      markerMeshes.push({ mesh: dot, country, ring });
    });

    // Connection arcs between country pairs
    const arcPairs: [number, number][] = [
      [0, 1], [0, 2], [1, 4], [2, 3],
      [3, 8], [1, 7], [0, 10], [4, 9],
      [5, 6], [11, 12],
    ];

    arcPairs.forEach(([i, j]) => {
      if (!COUNTRIES[i] || !COUNTRIES[j]) return;
      const sv = new THREE.Vector3(...latLngToVector3(COUNTRIES[i].lat, COUNTRIES[i].lng, GLOBE_RADIUS));
      const ev = new THREE.Vector3(...latLngToVector3(COUNTRIES[j].lat, COUNTRIES[j].lng, GLOBE_RADIUS));
      const mid = sv.clone().add(ev).multiplyScalar(0.5);
      mid.setLength(GLOBE_RADIUS + sv.distanceTo(ev) * 0.28);

      const curve = new THREE.QuadraticBezierCurve3(sv, mid, ev);
      const pts = curve.getPoints(40);
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: 0x00ccff,
        transparent: true,
        opacity: 0.3,
      });
      markersGroup.add(new THREE.Line(geom, mat));
    });

    // ── 8. Raycasting ────────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const getClientPos = (e: MouseEvent | TouchEvent) => ({
      x: "touches" in e ? e.touches[0].clientX : e.clientX,
      y: "touches" in e ? e.touches[0].clientY : e.clientY,
    });

    function castRay(clientX: number, clientY: number) {
      if (!targetContainer) return [];
      const rect = targetContainer.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      return raycaster.intersectObjects(markerMeshes.map((m) => m.mesh));
    }

    function onMouseMove(e: MouseEvent) {
      if (!targetContainer) return;
      const hits = castRay(e.clientX, e.clientY);
      if (hits.length > 0) {
        const hit = markerMeshes.find((m) => m.mesh === hits[0].object);
        if (hit) {
          setHoveredCountry(hit.country);
          targetContainer.style.cursor = "pointer";
          return;
        }
      }
      setHoveredCountry(null);
      targetContainer.style.cursor = stateRef.current.isDragging ? "grabbing" : "grab";
    }

    function onClick(e: MouseEvent) {
      if (stateRef.current.isDragging) return;
      const hits = castRay(e.clientX, e.clientY);
      if (hits.length > 0) {
        const hit = markerMeshes.find((m) => m.mesh === hits[0].object);
        if (hit) {
          handleCountrySelect(hit.country);
          const phi = (90 - hit.country.lat) * (Math.PI / 180);
          const theta = (hit.country.lng + 180) * (Math.PI / 180);
          stateRef.current.targetRotationX = phi - Math.PI / 2;
          stateRef.current.targetRotationY = -theta + Math.PI / 2;
          stateRef.current.targetZoom = 4.2;
          stateRef.current.lastInteractionTime = Date.now();
        }
      }
    }

    // ── 9. Drag & zoom ───────────────────────────────────────────────────────
    let prevPos = { x: 0, y: 0 };
    let dragStartPos = { x: 0, y: 0 };

    function onPointerDown(e: MouseEvent | TouchEvent) {
      const { x, y } = getClientPos(e);
      stateRef.current.isDragging = true;
      stateRef.current.lastInteractionTime = Date.now();
      prevPos = { x, y };
      dragStartPos = { x, y };
    }

    function onPointerMove(e: MouseEvent | TouchEvent) {
      if (!stateRef.current.isDragging) return;
      const { x, y } = getClientPos(e);
      const dx = x - prevPos.x;
      const dy = y - prevPos.y;
      stateRef.current.targetRotationY += dx * 0.006;
      stateRef.current.targetRotationX += dy * 0.006;
      stateRef.current.lastInteractionTime = Date.now();
      prevPos = { x, y };
    }

    function onPointerUp(e: MouseEvent | TouchEvent) {
      const { x, y } = getClientPos(e);
      const dist = Math.hypot(x - dragStartPos.x, y - dragStartPos.y);
      if (dist < 5 && e instanceof MouseEvent) {
        onClick(e);
      }
      stateRef.current.isDragging = false;
      if (targetContainer) targetContainer.style.cursor = "grab";
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      stateRef.current.targetZoom += e.deltaY * 0.003;
      stateRef.current.lastInteractionTime = Date.now();
    }

    targetContainer.addEventListener("mousemove", onMouseMove);
    targetContainer.addEventListener("mousedown", onPointerDown);
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    targetContainer.addEventListener("wheel", onWheel, { passive: false });
    targetContainer.addEventListener("touchstart", onPointerDown, { passive: true });
    window.addEventListener("touchmove", onPointerMove, { passive: true });
    window.addEventListener("touchend", onPointerUp, { passive: true });

    // ── 10. Animation loop ───────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let raf: number;
    let t = 0;

    function animate() {
      raf = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      t += delta;

      updateGlobeState(stateRef.current, delta, 0.12);
      globeGroup.rotation.x = stateRef.current.rotationX;
      globeGroup.rotation.y = stateRef.current.rotationY;
      camera.position.z = stateRef.current.zoom;

      // Animate marker rings — pulsing scale
      markerMeshes.forEach(({ ring }, idx) => {
        const phase = (t * 1.5 + idx * 0.6) % (Math.PI * 2);
        const pulse = 1 + Math.sin(phase) * 0.25;
        ring.scale.setScalar(pulse);
        const mat = ring.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.4 + Math.sin(phase) * 0.3;
      });

      renderer.render(scene, camera);
    }

    animate();

    // ── 11. Resize ───────────────────────────────────────────────────────────
    function onResize() {
      if (!targetContainer) return;
      const w = targetContainer.clientWidth;
      const h = targetContainer.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", onResize);

    // ── Cleanup ──────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      targetContainer.removeEventListener("mousemove", onMouseMove);
      targetContainer.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      targetContainer.removeEventListener("wheel", onWheel);
      targetContainer.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("touchmove", onPointerMove);
      window.removeEventListener("touchend", onPointerUp);

      if (targetContainer.contains(renderer.domElement)) {
        targetContainer.removeChild(renderer.domElement);
      }
      renderer.dispose();
      globeGeometry.dispose();
      globeMaterial.dispose();
      fallbackTexture.dispose();
      starGeom.dispose();
      starMat.dispose();
      atmGeom.dispose();
      atmMat.dispose();
      haloGeom.dispose();
      haloMat.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleCountrySelect]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div
        ref={containerRef}
        className="w-full h-full touch-none cursor-grab select-none"
        aria-label="Interactive 3D Earth globe. Drag to rotate, scroll to zoom."
        role="img"
      />

      {/* Country hover tooltip */}
      {hoveredCountry && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none z-20 animate-in fade-in duration-100">
          <div className="bg-black/80 border border-cyan-400/60 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2.5 shadow-lg shadow-cyan-500/10">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-white text-sm font-semibold">{hoveredCountry.name}</span>
            <span className="text-cyan-400 text-xs font-mono">{hoveredCountry.isoCode}</span>
            {hoveredCountry.activeUsers && (
              <span className="text-gray-400 text-xs">· {hoveredCountry.activeUsers} online</span>
            )}
          </div>
        </div>
      )}

      {/* Country click info panel */}
      {selectedCountry && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none z-20">
          <div className="bg-black/85 border border-white/10 backdrop-blur-xl rounded-2xl px-4 py-3 min-w-[140px] shadow-2xl">
            <p className="text-white font-bold text-sm">{selectedCountry.name}</p>
            <p className="text-gray-400 text-xs mt-0.5">Click to explore</p>
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-20">
        {[
          { label: "+", action: () => { stateRef.current.targetZoom = Math.max(3.5, stateRef.current.targetZoom - 0.5); stateRef.current.lastInteractionTime = Date.now(); } },
          { label: "−", action: () => { stateRef.current.targetZoom = Math.min(9, stateRef.current.targetZoom + 0.5); stateRef.current.lastInteractionTime = Date.now(); } },
          { label: "⊙", action: () => { stateRef.current.targetZoom = 5.5; stateRef.current.targetRotationX = 0.3; stateRef.current.targetRotationY = 0; stateRef.current.lastInteractionTime = Date.now(); } },
        ].map(({ label, action }) => (
          <button
            key={label}
            onClick={action}
            aria-label={label === "+" ? "Zoom in" : label === "−" ? "Zoom out" : "Reset view"}
            className="w-8 h-8 bg-black/60 border border-white/15 hover:border-cyan-400/50 text-white/70 hover:text-white rounded-lg text-sm font-bold transition-all flex items-center justify-center backdrop-blur-sm"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
