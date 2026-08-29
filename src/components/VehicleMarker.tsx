// 3D vehicle marker: a Three.js scene rendered into a small GLView, pinned to
// the vehicle's map position via MapboxGL.PointAnnotation (same screen-space
// trick as GeofenceRing). Per docs/ARCHITECTURE.md §1/§8: voxel low-poly
// models via expo-three, ≤1,200 tris at LOD0 / ≤400 at LOD1 / ≤120 at LOD2.
//
// NOTE: this renders a procedural box-voxel stand-in (a handful of colored
// BoxGeometry cubes) since the real glTF/.glb voxel asset pipeline (§8) is a
// separate art-production track. Swap `buildVoxelMesh` for a GLTFLoader call
// once real assets land — the LOD/animation plumbing here doesn't change.
import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import MapboxGL from '@rnmapbox/maps';
import type { VehicleId } from '../types';

const VEHICLE_COLORS: Record<VehicleId, number> = {
  veh_camo_tank: 0x4b5320,
  veh_fire_engine: 0xd0342c,
  veh_sedan: 0x9aa5b1,
  veh_ice_cream_truck: 0xffe4ec,
  veh_taxi: 0xf5c518,
};

export type VehicleLod = 'LOD0' | 'LOD1' | 'LOD2';

interface VehicleMarkerProps {
  lat: number;
  lng: number;
  vehicleId: VehicleId;
  headingDeg: number;
  isSelf: boolean;
  ghosted: boolean;
  lod?: VehicleLod;
  size?: number;
}

/** Procedural stand-in for the baked voxel .glb — well under the tri budget at every LOD. */
function buildVoxelMesh(color: number, lod: VehicleLod): THREE.Object3D {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color }); // flat-shaded, unlit — matches the atlas approach in §8

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.7), mat);
  group.add(body);

  if (lod !== 'LOD2') {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.6), mat);
    cabin.position.set(-0.1, 0.42, 0);
    group.add(cabin);
  }

  if (lod === 'LOD0') {
    const wheelGeo = new THREE.BoxGeometry(0.22, 0.22, 0.18);
    const wheelMat = new THREE.MeshBasicMaterial({ color: 0x111318 });
    const offsets: [number, number][] = [
      [0.5, 0.42],
      [0.5, -0.42],
      [-0.5, 0.42],
      [-0.5, -0.42],
    ];
    for (const [x, z] of offsets) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(x, -0.28, z);
      group.add(wheel);
    }
  }

  return group;
}

export function VehicleMarker({
  lat,
  lng,
  vehicleId,
  headingDeg,
  isSelf,
  ghosted,
  lod = 'LOD0',
  size = 56,
}: VehicleMarkerProps) {
  const rafRef = useRef<number | null>(null);

  // Ghosted vehicles are invisible on the broadcast map by design (§4) — the
  // server already omits lat/lng for ghosted others; for self we still show
  // a dimmed marker so the player has feedback that ghost mode is active.
  if (ghosted && !isSelf) return null;

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x000000, 0); // transparent background

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 20);
    camera.position.set(0, 1.6, 2.4);
    camera.lookAt(0, 0, 0);

    const mesh = buildVoxelMesh(VEHICLE_COLORS[vehicleId] ?? 0x00e5ff, lod);
    mesh.rotation.y = (headingDeg * Math.PI) / 180;
    if (ghosted) {
      mesh.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          (child.material as THREE.MeshBasicMaterial).transparent = true;
          (child.material as THREE.MeshBasicMaterial).opacity = 0.35;
        }
      });
    }
    scene.add(mesh);

    // Baked idle loop: ≤2s, sampled at 15fps and interpolated (§8) — a simple
    // bob + yaw wobble stands in for a real baked animation clip.
    const FRAME_MS = 1000 / 15;
    const LOOP_MS = 2000;
    let start = Date.now();

    const renderLoop = () => {
      const t = ((Date.now() - start) % LOOP_MS) / LOOP_MS;
      const phase = Math.floor(t * (LOOP_MS / FRAME_MS)) / (LOOP_MS / FRAME_MS);
      mesh.position.y = Math.sin(phase * Math.PI * 2) * 0.05;
      renderer.render(scene, camera);
      gl.endFrameEXP();
      rafRef.current = requestAnimationFrame(renderLoop);
    };
    renderLoop();
  };

  return (
    <MapboxGL.PointAnnotation
      id={`vehicle-${vehicleId}-${lat.toFixed(5)}-${lng.toFixed(5)}`}
      coordinate={[lng, lat]}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={[styles.wrap, { width: size, height: size, opacity: isSelf ? 1 : 0.9 }]} pointerEvents="none">
        <GLView style={{ width: size, height: size }} onContextCreate={onContextCreate} />
      </View>
    </MapboxGL.PointAnnotation>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});

export default VehicleMarker;
