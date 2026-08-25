/**
 * frontend/src/components/GlobeControls.ts
 *
 * Smooth inertia damping and touch/mouse interaction helper for the 3D WebGL Globe.
 */

export interface GlobeState {
  rotationX: number;
  rotationY: number;
  targetRotationX: number;
  targetRotationY: number;
  zoom: number;
  targetZoom: number;
  isDragging: boolean;
  isInteracting: boolean;
  lastInteractionTime: number;
}

export function createInitialGlobeState(): GlobeState {
  return {
    rotationX: 0.3,
    rotationY: 0,
    targetRotationX: 0.3,
    targetRotationY: 0,
    zoom: 5.5,
    targetZoom: 5.5,
    isDragging: false,
    isInteracting: false,
    lastInteractionTime: Date.now(),
  };
}

export function updateGlobeState(
  state: GlobeState,
  delta: number,
  autoRotateSpeed: number = 0.15
): void {
  // Damping factor for smooth momentum
  const damping = Math.min(delta * 6, 0.2);

  // Auto-rotation when idle for > 2 seconds
  const now = Date.now();
  if (!state.isDragging && now - state.lastInteractionTime > 2000) {
    state.targetRotationY += autoRotateSpeed * delta;
  }

  // Smooth lerp to target rotations and zoom
  state.rotationX += (state.targetRotationX - state.rotationX) * damping;
  state.rotationY += (state.targetRotationY - state.rotationY) * damping;
  state.zoom += (state.targetZoom - state.zoom) * damping;

  // Clamp vertical tilt angle to prevent flipping
  state.targetRotationX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, state.targetRotationX));
  // Clamp zoom range
  state.targetZoom = Math.max(3.5, Math.min(9.0, state.targetZoom));
}
