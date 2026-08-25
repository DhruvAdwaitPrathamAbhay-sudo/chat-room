"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { COUNTRIES, CountryData, latLngToVector3 } from "./geographic/countries";
import { createInitialGlobeState, updateGlobeState, GlobeState } from "./GlobeControls";

interface GlobeSceneProps {
  onCountrySelect?: (country: CountryData) => void;
  className?: string;
}

export default function GlobeScene({ onCountrySelect, className = "" }: GlobeSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCountry, setHoveredCountry] = useState<CountryData | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);
  const stateRef = useRef<GlobeState>(createInitialGlobeState());

  useEffect(() => {
    const targetContainer = containerRef.current;
    if (!targetContainer) return;

    // ── 1. Setup Scene, Camera, Renderer ──────────────────────────────────────
    const width = targetContainer.clientWidth || 320;
    const height = targetContainer.clientHeight || 320;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = stateRef.current.zoom;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    targetContainer.appendChild(renderer.domElement);

    // ── 2. Lights ─────────────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0x1a2b3c, 1.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00f0ff, 2.2);
    dirLight.position.set(5, 3, 5);
    scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0x005588, 1.4);
    backLight.position.set(-5, -3, -5);
    scene.add(backLight);

    // ── 3. Earth Group & Texture Generation ───────────────────────────────────
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    const GLOBE_RADIUS = 2.0;

    // Procedural Dark Earth Canvas Texture
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 1024;
    textureCanvas.height = 512;
    const ctx = textureCanvas.getContext("2d");

    if (ctx) {
      // Deep dark navy/black ocean background
      ctx.fillStyle = "#050811";
      ctx.fillRect(0, 0, 1024, 512);

      // Subtle longitude & latitude grid lines
      ctx.strokeStyle = "rgba(0, 240, 255, 0.09)";
      ctx.lineWidth = 1;

      for (let x = 0; x <= 1024; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
      }
      for (let y = 0; y <= 512; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1024, y);
        ctx.stroke();
      }

      // Stylized continent landmass dots
      ctx.fillStyle = "#121d2d";
      for (let i = 0; i < 4500; i++) {
        const x = Math.random() * 1024;
        const y = Math.random() * 512;
        // Simple land distribution clustering
        if (
          (y > 70 && y < 390 && (x < 360 || (x > 440 && x < 860))) ||
          (y > 290 && y < 460 && x > 240 && x < 410)
        ) {
          ctx.beginPath();
          ctx.arc(x, y, Math.random() * 2.5 + 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // City light points in electric cyan
      ctx.fillStyle = "#00f0ff";
      for (let i = 0; i < 200; i++) {
        const x = Math.random() * 1024;
        const y = Math.random() * 512;
        if (
          (y > 90 && y < 360 && (x < 330 || (x > 470 && x < 840)))
        ) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const earthTexture = new THREE.CanvasTexture(textureCanvas);
    const globeGeometry = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
    const globeMaterial = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.65,
      metalness: 0.15,
    });

    const globeMesh = new THREE.Mesh(globeGeometry, globeMaterial);
    globeGroup.add(globeMesh);

    // ── 4. Atmosphere Rim Glow ────────────────────────────────────────────────
    const atmosphereGeometry = new THREE.SphereGeometry(GLOBE_RADIUS * 1.08, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
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
          float intensity = pow(0.68 - dot(vNormal, vec3(0, 0, 1.0)), 2.2);
          gl_FragColor = vec4(0.0, 0.94, 1.0, 1.0) * intensity * 0.5;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });

    const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    globeGroup.add(atmosphereMesh);

    // ── 5. Country Markers & Network Arcs ─────────────────────────────────────
    const markersGroup = new THREE.Group();
    globeGroup.add(markersGroup);

    const markerMeshes: { mesh: THREE.Mesh; country: CountryData }[] = [];

    COUNTRIES.forEach((country) => {
      const [x, y, z] = latLngToVector3(country.lat, country.lng, GLOBE_RADIUS + 0.03);

      // Marker Dot
      const markerGeom = new THREE.SphereGeometry(0.045, 16, 16);
      const markerMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
      const markerMesh = new THREE.Mesh(markerGeom, markerMat);
      markerMesh.position.set(x, y, z);
      markersGroup.add(markerMesh);

      // Pulsing outer ring
      const ringGeom = new THREE.RingGeometry(0.06, 0.085, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.position.set(x, y, z);
      ringMesh.lookAt(0, 0, 0);
      markersGroup.add(ringMesh);

      markerMeshes.push({ mesh: markerMesh, country });
    });

    // Network Arcs between pairs of countries
    const arcPairs = [
      [0, 1], // India <-> US
      [0, 2], // India <-> UK
      [1, 4], // US <-> Japan
      [2, 3], // UK <-> Germany
      [3, 8], // Germany <-> France
      [1, 7], // US <-> Canada
      [0, 10], // India <-> Singapore
      [4, 9], // Japan <-> South Korea
    ];

    arcPairs.forEach(([i, j]) => {
      if (!COUNTRIES[i] || !COUNTRIES[j]) return;
      const startVec = new THREE.Vector3(...latLngToVector3(COUNTRIES[i].lat, COUNTRIES[i].lng, GLOBE_RADIUS));
      const endVec = new THREE.Vector3(...latLngToVector3(COUNTRIES[j].lat, COUNTRIES[j].lng, GLOBE_RADIUS));

      const midVec = startVec.clone().add(endVec).multiplyScalar(0.5);
      const distance = startVec.distanceTo(endVec);
      midVec.setLength(GLOBE_RADIUS + distance * 0.25);

      const curve = new THREE.QuadraticBezierCurve3(startVec, midVec, endVec);
      const points = curve.getPoints(32);
      const curveGeom = new THREE.BufferGeometry().setFromPoints(points);

      const curveMat = new THREE.LineBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.35,
      });

      const arcLine = new THREE.Line(curveGeom, curveMat);
      markersGroup.add(arcLine);
    });

    // ── 6. Pointer & Raycasting ───────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onPointerMove(e: MouseEvent | TouchEvent) {
      if (!targetContainer) return;
      const rect = targetContainer.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      mouse.x = ((clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(
        markerMeshes.map((m) => m.mesh)
      );

      if (intersects.length > 0) {
        const hit = markerMeshes.find((m) => m.mesh === intersects[0].object);
        if (hit) {
          setHoveredCountry(hit.country);
          targetContainer.style.cursor = "pointer";
          return;
        }
      }

      setHoveredCountry(null);
      targetContainer.style.cursor = stateRef.current.isDragging ? "grabbing" : "grab";
    }

    function onPointerClick(e: MouseEvent) {
      if (!targetContainer) return;
      const rect = targetContainer.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(
        markerMeshes.map((m) => m.mesh)
      );

      if (intersects.length > 0) {
        const hit = markerMeshes.find((m) => m.mesh === intersects[0].object);
        if (hit) {
          setSelectedCountry(hit.country);
          if (onCountrySelect) onCountrySelect(hit.country);

          // Smoothly rotate globe to center selected country
          const phi = (90 - hit.country.lat) * (Math.PI / 180);
          const theta = (hit.country.lng + 180) * (Math.PI / 180);
          stateRef.current.targetRotationX = phi - Math.PI / 2;
          stateRef.current.targetRotationY = -theta + Math.PI / 2;
          stateRef.current.targetZoom = 4.2;
          stateRef.current.lastInteractionTime = Date.now();
        }
      }
    }

    // ── 7. Drag & Zoom Event Handlers ────────────────────────────────────────
    let previousPointerPosition = { x: 0, y: 0 };

    function onPointerDown(e: MouseEvent | TouchEvent) {
      stateRef.current.isDragging = true;
      stateRef.current.isInteracting = true;
      stateRef.current.lastInteractionTime = Date.now();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      previousPointerPosition = { x: clientX, y: clientY };
    }

    function onPointerDrag(e: MouseEvent | TouchEvent) {
      if (!stateRef.current.isDragging) return;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - previousPointerPosition.x;
      const deltaY = clientY - previousPointerPosition.y;

      stateRef.current.targetRotationY += deltaX * 0.006;
      stateRef.current.targetRotationX += deltaY * 0.006;
      stateRef.current.lastInteractionTime = Date.now();

      previousPointerPosition = { x: clientX, y: clientY };
    }

    function onPointerUp() {
      stateRef.current.isDragging = false;
      if (targetContainer) {
        targetContainer.style.cursor = "grab";
      }
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      stateRef.current.targetZoom += e.deltaY * 0.003;
      stateRef.current.lastInteractionTime = Date.now();
    }

    targetContainer.addEventListener("mousemove", onPointerMove);
    targetContainer.addEventListener("click", onPointerClick);
    targetContainer.addEventListener("mousedown", onPointerDown);
    window.addEventListener("mousemove", onPointerDrag);
    window.addEventListener("mouseup", onPointerUp);
    targetContainer.addEventListener("wheel", onWheel, { passive: false });

    // Touch events for mobile
    targetContainer.addEventListener("touchstart", onPointerDown, { passive: true });
    targetContainer.addEventListener("touchmove", onPointerDrag, { passive: true });
    targetContainer.addEventListener("touchend", onPointerUp, { passive: true });

    // ── 8. Animation Loop ─────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let animationFrameId: number;

    function animate() {
      animationFrameId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      updateGlobeState(stateRef.current, delta, 0.15);

      // Apply rotation to globe group
      globeGroup.rotation.x = stateRef.current.rotationX;
      globeGroup.rotation.y = stateRef.current.rotationY;
      camera.position.z = stateRef.current.zoom;

      renderer.render(scene, camera);
    }

    animate();

    // ── 9. Resize Listener ───────────────────────────────────────────────────
    function handleResize() {
      if (!targetContainer) return;
      const newWidth = targetContainer.clientWidth;
      const newHeight = targetContainer.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    }

    window.addEventListener("resize", handleResize);

    // ── Cleanup ──────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      targetContainer.removeEventListener("mousemove", onPointerMove);
      targetContainer.removeEventListener("click", onPointerClick);
      targetContainer.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("mousemove", onPointerDrag);
      window.removeEventListener("mouseup", onPointerUp);
      targetContainer.removeEventListener("wheel", onWheel);
      targetContainer.removeEventListener("touchstart", onPointerDown);
      targetContainer.removeEventListener("touchmove", onPointerDrag);
      targetContainer.removeEventListener("touchend", onPointerUp);

      if (targetContainer.contains(renderer.domElement)) {
        targetContainer.removeChild(renderer.domElement);
      }
      renderer.dispose();
      globeGeometry.dispose();
      globeMaterial.dispose();
      earthTexture.dispose();
      atmosphereGeometry.dispose();
      atmosphereMaterial.dispose();
    };
  }, [onCountrySelect]);

  return (
    <div className={`relative w-full h-full min-h-[340px] ${className}`}>
      <div ref={containerRef} className="w-full h-full min-h-[340px] touch-none cursor-grab" />

      {/* Hover & Active Country Tooltip Overlay */}
      {hoveredCountry && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[var(--veil-surface)]/95 border border-[var(--veil-cyan)]/60 backdrop-blur-md px-4 py-2 rounded-full text-xs font-semibold text-white flex items-center gap-2 shadow-[0_0_20px_rgba(0,240,255,0.2)] pointer-events-none z-10 animate-in fade-in duration-150">
          <span className="w-2 h-2 rounded-full bg-[var(--veil-cyan)] animate-ping" />
          <span>{hoveredCountry.name} ({hoveredCountry.isoCode})</span>
          {hoveredCountry.activeUsers && (
            <span className="text-[var(--veil-cyan)] font-mono">
              • {hoveredCountry.activeUsers} online
            </span>
          )}
        </div>
      )}

      {selectedCountry && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[var(--veil-surface-2)]/95 border border-[var(--veil-cyan)]/60 backdrop-blur-md px-5 py-2.5 rounded-2xl text-xs text-center text-white shadow-2xl pointer-events-none z-10">
          <span className="font-bold text-[var(--veil-cyan)]">{selectedCountry.name} Selected</span>
          <p className="text-[11px] text-[var(--veil-text-muted)] mt-0.5">
            Connecting to anonymous peers in {selectedCountry.region}...
          </p>
        </div>
      )}
    </div>
  );
}
