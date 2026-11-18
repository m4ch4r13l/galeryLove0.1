import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { CorridorLayout, MemoryItem } from '../types/gallery';
import {
  computeCorridorLayout,
  computeLookAngles,
  shortestAngleDelta,
} from '../utils/galleryLogic';
import {
  createFallbackArtworkTexture,
  createMarbleFloorTextures,
  createRunnerCarpetTexture,
  createSoftParticleTexture,
  createWallPlasterTexture,
} from './proceduralTextures';

export interface GallerySceneCallbacks {
  onSelectMemory: (index: number) => void;
  onHoverMemory: (index: number | null) => void;
  onPointerLockChange?: (locked: boolean) => void;
  onWebGLError: () => void;
}

// Pre-allocated scratch vectors for zero-GC animation loop
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _desiredVel = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class GallerySceneController {
  private container: HTMLElement;
  private callbacks: GallerySceneCallbacks;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private lastFrameTimeMs = performance.now();
  private elapsedSeconds = 0;

  // FPS Camera State
  private yaw = 0;
  private pitch = 0;
  private readonly maxPitch = Math.PI * 0.36;
  private readonly eyeHeight = 1.75;
  private walkVelocity = new THREE.Vector3();
  private walkBobPhase = 0;
  private lookPointerId: number | null = null;
  private isPointerLocked = false;
  private lastPointerPos = { x: 0, y: 0 };
  private prefersReducedMotion = false;

  private environmentGroup = new THREE.Group();
  private framesGroup = new THREE.Group();
  private sculptureGroup = new THREE.Group();
  private interactableMeshes: THREE.Mesh[] = [];
  private frameLamps: THREE.MeshStandardMaterial[] = [];
  private disposableTextures: THREE.Texture[] = [];
  private disposableGeometries: THREE.BufferGeometry[] = [];
  private disposableMaterials: THREE.Material[] = [];
  private frameArtworkResources: Array<{ texture: THREE.Texture; material: THREE.Material }> = [];

  private particleSystem: THREE.Points;
  private sculptureCrystal: THREE.Mesh | null = null;
  private sculptureRing: THREE.Mesh | null = null;

  private layout: CorridorLayout;
  private textureLoader = new THREE.TextureLoader();
  private raycaster = new THREE.Raycaster();
  private pointerNDC = new THREE.Vector2(-99, -99);
  private pointerDownPos = { x: 0, y: 0 };
  private lastRaycastTime = 0;
  private hoveredIndex: number | null = null;

  private keysPressed = new Set<string>();
  private virtualWalk = { forward: 0, strafe: 0 };
  private cameraTransitionActive = false;
  private transitionCamPos = new THREE.Vector3(0, 1.75, 7.6);
  private transitionYaw = 0;
  private transitionPitch = 0;

  private frameId = 0;
  private disposed = false;
  private maxAnisotropy = 1;
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;

  // Shared materials for frames
  private goldFrameMat: THREE.MeshStandardMaterial;
  private roseFilletMat: THREE.MeshStandardMaterial;
  private matBoardMat: THREE.MeshStandardMaterial;
  private plaqueMat: THREE.MeshStandardMaterial;
  private lampShadeMat: THREE.MeshStandardMaterial;

  // Bound event listeners
  private handleResizeBound: () => void;
  private handlePointerMoveBound: (e: PointerEvent) => void;
  private handlePointerDownBound: (e: PointerEvent) => void;
  private handlePointerUpBound: (e: PointerEvent) => void;
  private handlePointerCancelBound: (e: PointerEvent) => void;
  private handleDoubleClickBound: () => void;
  private handlePointerLockChangeBound: () => void;
  private handleKeyDownBound: (e: KeyboardEvent) => void;
  private handleKeyUpBound: (e: KeyboardEvent) => void;
  private handleWindowBlurBound: () => void;
  private handleContextLostBound: (e: Event) => void;

  constructor(
    container: HTMLElement,
    initialMemories: MemoryItem[],
    callbacks: GallerySceneCallbacks
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.layout = computeCorridorLayout(initialMemories.length);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.maxAnisotropy = this.isSoftwareGl
      ? 1
      : Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    container.appendChild(this.renderer.domElement);

    // Scene & Horizon-matched Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0917);
    this.scene.fog = new THREE.FogExp2(0x0b0917, 0.022);

    // Studio IBL Environment (RoomEnvironment) for realistic brass/marble speculars
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.envRenderTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    pmremGenerator.dispose();

    // First-Person Camera spawned on open central runner facing down the corridor vista
    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 150);
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(0, this.eyeHeight, 7.6);
    this.camera.rotation.set(0, 0, 0, 'YXZ');
    this.prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.renderer.domElement.style.cursor = 'grab';
    this.renderer.domElement.style.touchAction = 'none';

    // Balanced warm/cool lighting rig
    const hemiLight = new THREE.HemisphereLight(0xd8c8ff, 0x1a142d, 0.9);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffe6d0, 1.35);
    keyLight.position.set(4, 9, 8);
    if (!this.isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 40;
      keyLight.shadow.camera.left = -8;
      keyLight.shadow.camera.right = 8;
      keyLight.shadow.camera.top = 18;
      keyLight.shadow.camera.bottom = -18;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(keyLight);

    // Subtle warm gallery accent lights along corridor (capped <= 4 unshadowed lights)
    const accentPositions = [2, -6, -14, -22];
    accentPositions.forEach((z) => {
      const pLight = new THREE.PointLight(0xffcfb8, 2.4, 14, 1.6);
      pLight.position.set(0, 3.8, z);
      this.scene.add(pLight);
    });

    // Shared frame materials
    this.goldFrameMat = new THREE.MeshStandardMaterial({
      color: 0xd4ad63,
      roughness: 0.28,
      metalness: 0.88,
    });
    this.roseFilletMat = new THREE.MeshStandardMaterial({
      color: 0xc98a96,
      roughness: 0.35,
      metalness: 0.78,
    });
    this.matBoardMat = new THREE.MeshStandardMaterial({
      color: 0xf4eee6,
      roughness: 0.88,
      metalness: 0.04,
    });
    this.plaqueMat = new THREE.MeshStandardMaterial({
      color: 0x262033,
      roughness: 0.4,
      metalness: 0.7,
    });
    this.lampShadeMat = new THREE.MeshStandardMaterial({
      color: 0xc8a258,
      roughness: 0.3,
      metalness: 0.85,
    });
    this.disposableMaterials.push(
      this.goldFrameMat,
      this.roseFilletMat,
      this.matBoardMat,
      this.plaqueMat,
      this.lampShadeMat
    );

    this.scene.add(this.environmentGroup);
    this.scene.add(this.framesGroup);
    this.scene.add(this.sculptureGroup);

    // Floating stardust particles
    this.particleSystem = this.createParticles();
    this.scene.add(this.particleSystem);

    // Build corridor + sculpture + frames
    this.buildCorridorArchitecture();
    this.buildEndAlcoveSculpture();
    this.buildFrames(initialMemories);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Bind events
    this.handleResizeBound = this.onResize.bind(this);
    this.handlePointerMoveBound = this.onPointerMove.bind(this);
    this.handlePointerDownBound = this.onPointerDown.bind(this);
    this.handlePointerUpBound = this.onPointerUp.bind(this);
    this.handlePointerCancelBound = this.onPointerCancel.bind(this);
    this.handleDoubleClickBound = () => {
      this.requestPointerLock().catch(() => {});
    };
    this.handlePointerLockChangeBound = this.onPointerLockChange.bind(this);
    this.handleKeyDownBound = this.onKeyDown.bind(this);
    this.handleKeyUpBound = this.onKeyUp.bind(this);
    this.handleWindowBlurBound = () => {
      this.lookPointerId = null;
      this.keysPressed.clear();
      this.virtualWalk.forward = 0;
      this.virtualWalk.strafe = 0;
    };
    this.handleContextLostBound = (e: Event) => {
      e.preventDefault();
      this.callbacks.onWebGLError();
    };

    window.addEventListener('resize', this.handleResizeBound);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMoveBound);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDownBound);
    window.addEventListener('pointerup', this.handlePointerUpBound);
    window.addEventListener('pointercancel', this.handlePointerCancelBound);
    this.renderer.domElement.addEventListener('dblclick', this.handleDoubleClickBound);
    document.addEventListener('pointerlockchange', this.handlePointerLockChangeBound);
    window.addEventListener('keydown', this.handleKeyDownBound);
    window.addEventListener('keyup', this.handleKeyUpBound);
    window.addEventListener('blur', this.handleWindowBlurBound);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLostBound);

    this.startLoop();
  }

  private createParticles(): THREE.Points {
    const count = 240;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 6.2;
      positions[i * 3 + 1] = 0.4 + Math.random() * 3.8;
      positions[i * 3 + 2] = this.layout.minZ + Math.random() * this.layout.corridorLength;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleTex = createSoftParticleTexture();
    this.disposableTextures.push(particleTex);
    const mat = new THREE.PointsMaterial({
      color: 0xffd7e2,
      map: particleTex,
      size: 0.12,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.disposableGeometries.push(geo);
    this.disposableMaterials.push(mat);
    return new THREE.Points(geo, mat);
  }

  private clearGroup(group: THREE.Group) {
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
    }
  }

  private buildCorridorArchitecture() {
    this.clearGroup(this.environmentGroup);

    const { corridorWidth, corridorHeight, corridorLength, centerZ, minZ, maxZ } = this.layout;
    const halfW = corridorWidth / 2;

    // 1. Marble Floor
    const floorTextures = createMarbleFloorTextures(this.maxAnisotropy);
    this.disposableTextures.push(floorTextures.map, floorTextures.roughnessMap);

    const floorGeo = new THREE.PlaneGeometry(corridorWidth, corridorLength);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: floorTextures.map,
      roughnessMap: floorTextures.roughnessMap,
      roughness: 0.25,
      metalness: 0.55,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(0, 0, centerZ);
    floorMesh.receiveShadow = true;
    this.environmentGroup.add(floorMesh);
    this.disposableGeometries.push(floorGeo);
    this.disposableMaterials.push(floorMat);

    // 2. Central Velvet Runner Carpet (offset +0.02m on Y so never Z-fights)
    const runnerTex = createRunnerCarpetTexture(this.maxAnisotropy);
    this.disposableTextures.push(runnerTex);
    const runnerGeo = new THREE.PlaneGeometry(2.1, corridorLength - 3.5);
    const runnerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: runnerTex,
      roughness: 0.85,
      metalness: 0.05,
    });
    const runnerMesh = new THREE.Mesh(runnerGeo, runnerMat);
    runnerMesh.rotation.x = -Math.PI / 2;
    runnerMesh.position.set(0, 0.02, centerZ);
    runnerMesh.receiveShadow = true;
    this.environmentGroup.add(runnerMesh);
    this.disposableGeometries.push(runnerGeo);
    this.disposableMaterials.push(runnerMat);

    // 3. Left & Right Walls + Back & Entrance Walls
    const wallTex = createWallPlasterTexture(this.maxAnisotropy);
    this.disposableTextures.push(wallTex);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: wallTex,
      roughness: 0.86,
      metalness: 0.08,
    });
    this.disposableMaterials.push(wallMat);

    const sideWallGeo = new THREE.PlaneGeometry(corridorLength, corridorHeight);
    this.disposableGeometries.push(sideWallGeo);

    const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-halfW, corridorHeight / 2, centerZ);
    leftWall.receiveShadow = true;
    this.environmentGroup.add(leftWall);

    const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(halfW, corridorHeight / 2, centerZ);
    rightWall.receiveShadow = true;
    this.environmentGroup.add(rightWall);

    const endWallGeo = new THREE.PlaneGeometry(corridorWidth, corridorHeight);
    this.disposableGeometries.push(endWallGeo);

    const backWall = new THREE.Mesh(endWallGeo, wallMat);
    backWall.position.set(0, corridorHeight / 2, minZ);
    backWall.receiveShadow = true;
    this.environmentGroup.add(backWall);

    const frontWall = new THREE.Mesh(endWallGeo, wallMat);
    frontWall.rotation.y = Math.PI;
    frontWall.position.set(0, corridorHeight / 2, maxZ);
    this.environmentGroup.add(frontWall);

    // 4. Wainscoting / Baseboard Trim along walls
    const trimGeo = new THREE.BoxGeometry(0.1, 0.24, corridorLength);
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x1e1936,
      roughness: 0.55,
      metalness: 0.3,
    });
    this.disposableGeometries.push(trimGeo);
    this.disposableMaterials.push(trimMat);

    const leftTrim = new THREE.Mesh(trimGeo, trimMat);
    leftTrim.position.set(-halfW + 0.05, 0.12, centerZ);
    this.environmentGroup.add(leftTrim);

    const rightTrim = new THREE.Mesh(trimGeo, trimMat);
    rightTrim.position.set(halfW - 0.05, 0.12, centerZ);
    this.environmentGroup.add(rightTrim);

    // 5. Ceiling + Coffered Architectural Ribs with subtle warm emissive strips
    const ceilingGeo = new THREE.PlaneGeometry(corridorWidth, corridorLength);
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: 0x0b0917,
      roughness: 0.92,
      metalness: 0.1,
    });
    const ceilingMesh = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceilingMesh.rotation.x = Math.PI / 2;
    ceilingMesh.position.set(0, corridorHeight, centerZ);
    this.environmentGroup.add(ceilingMesh);
    this.disposableGeometries.push(ceilingGeo);
    this.disposableMaterials.push(ceilingMat);

    // Architectural pilasters & ceiling beams via InstancedMesh
    const pillarZPositions: number[] = [];
    for (let z = 4.7; z >= minZ + 2.5; z -= 5.4) {
      pillarZPositions.push(z);
    }

    const pillarCount = pillarZPositions.length * 2;
    if (pillarCount > 0) {
      const pillarGeo = new THREE.BoxGeometry(0.32, corridorHeight, 0.36);
      const pillarMat = new THREE.MeshStandardMaterial({
        color: 0x221c3c,
        roughness: 0.65,
        metalness: 0.25,
      });
      const pillarInst = new THREE.InstancedMesh(pillarGeo, pillarMat, pillarCount);
      const dummy = new THREE.Object3D();
      let pIdx = 0;
      pillarZPositions.forEach((z) => {
        [-1, 1].forEach((side) => {
          dummy.position.set(side * (halfW - 0.14), corridorHeight / 2, z);
          dummy.updateMatrix();
          pillarInst.setMatrixAt(pIdx, dummy.matrix);
          pIdx += 1;
        });
      });
      pillarInst.computeBoundingSphere();
      this.environmentGroup.add(pillarInst);
      this.disposableGeometries.push(pillarGeo);
      this.disposableMaterials.push(pillarMat);

      // Transverse ceiling beams & warm emissive cove light bars
      const beamGeo = new THREE.BoxGeometry(corridorWidth, 0.24, 0.32);
      const coveGeo = new THREE.BoxGeometry(corridorWidth - 1.2, 0.04, 0.08);
      const coveMat = new THREE.MeshBasicMaterial({ color: 0xffd7bd });
      const beamInst = new THREE.InstancedMesh(beamGeo, pillarMat, pillarZPositions.length);
      const coveInst = new THREE.InstancedMesh(coveGeo, coveMat, pillarZPositions.length);

      pillarZPositions.forEach((z, idx) => {
        dummy.position.set(0, corridorHeight - 0.12, z);
        dummy.updateMatrix();
        beamInst.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(0, corridorHeight - 0.25, z);
        dummy.updateMatrix();
        coveInst.setMatrixAt(idx, dummy.matrix);
      });
      beamInst.computeBoundingSphere();
      coveInst.computeBoundingSphere();
      this.environmentGroup.add(beamInst, coveInst);
      this.disposableGeometries.push(beamGeo, coveGeo);
      this.disposableMaterials.push(coveMat);
    }
  }

  /**
   * Multi-part procedural centerpiece sculpture at the end of the corridor:
   * Marble stepped pedestal + brass ring + glowing faceted crystal centerpiece.
   */
  private buildEndAlcoveSculpture() {
    this.clearGroup(this.sculptureGroup);
    const z = this.layout.alcoveZ;
    this.sculptureGroup.position.set(0, 0, z);

    const marbleMat = new THREE.MeshStandardMaterial({
      color: 0x201a36,
      roughness: 0.35,
      metalness: 0.4,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd9b36c,
      roughness: 0.25,
      metalness: 0.9,
    });
    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: 0xf4a3ba,
      emissive: 0x7b2d4d,
      emissiveIntensity: 0.45,
      roughness: 0.12,
      metalness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    });

    // 1. Primary base plinth
    const baseGeo = new THREE.CylinderGeometry(1.15, 1.25, 0.22, 24);
    const base = new THREE.Mesh(baseGeo, marbleMat);
    base.position.y = 0.11;
    base.receiveShadow = true;

    // 2. Stepped column shaft
    const shaftGeo = new THREE.CylinderGeometry(0.62, 0.72, 1.05, 24);
    const shaft = new THREE.Mesh(shaftGeo, marbleMat);
    shaft.position.y = 0.74;
    shaft.castShadow = true;

    // 3. Brass collar cap
    const capGeo = new THREE.CylinderGeometry(0.76, 0.66, 0.12, 24);
    const cap = new THREE.Mesh(capGeo, brassMat);
    cap.position.y = 1.32;

    // 4. Orbital brass ring
    const ringGeo = new THREE.TorusGeometry(0.62, 0.025, 12, 36);
    const ring = new THREE.Mesh(ringGeo, brassMat);
    ring.position.y = 2.05;
    ring.rotation.x = Math.PI / 6;
    this.sculptureRing = ring;

    // 5. Faceted glowing rose-quartz crystal
    const crystalGeo = new THREE.OctahedronGeometry(0.42, 0);
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.y = 2.05;
    crystal.scale.set(0.9, 1.35, 0.9);
    this.sculptureCrystal = crystal;

    this.sculptureGroup.add(base, shaft, cap, ring, crystal);
    this.disposableGeometries.push(baseGeo, shaftGeo, capGeo, ringGeo, crystalGeo);
    this.disposableMaterials.push(marbleMat, brassMat, crystalMat);
  }

  /**
   * Builds composite 5-part museum picture frames for all memories.
   */
  public buildFrames(memories: MemoryItem[]) {
    this.clearGroup(this.framesGroup);
    this.interactableMeshes = [];
    this.frameLamps = [];

    // Dispose old artwork textures & materials from previous build
    this.frameArtworkResources.forEach(({ texture, material }) => {
      texture.dispose();
      material.dispose();
    });
    this.frameArtworkResources = [];

    const previousLength = this.layout.corridorLength;
    this.layout = computeCorridorLayout(memories.length);
    if (Math.abs(previousLength - this.layout.corridorLength) > 0.1) {
      this.buildCorridorArchitecture();
      this.buildEndAlcoveSculpture();
    }

    const frameW = 2.3;
    const frameH = 1.725; // 4:3 aspect ratio

    const outerFrameGeo = new THREE.BoxGeometry(frameW + 0.26, frameH + 0.26, 0.1);
    const filletGeo = new THREE.BoxGeometry(frameW + 0.12, frameH + 0.12, 0.11);
    const matBoardGeo = new THREE.BoxGeometry(frameW + 0.06, frameH + 0.06, 0.115);
    const artGeo = new THREE.PlaneGeometry(frameW - 0.08, frameH - 0.08);
    const plaqueGeo = new THREE.BoxGeometry(0.72, 0.16, 0.03);
    const lampArmGeo = new THREE.BoxGeometry(0.05, 0.05, 0.28);
    const lampHoodGeo = new THREE.BoxGeometry(0.96, 0.065, 0.12);
    const lampBulbGeo = new THREE.PlaneGeometry(0.88, 0.06);

    this.disposableGeometries.push(
      outerFrameGeo,
      filletGeo,
      matBoardGeo,
      artGeo,
      plaqueGeo,
      lampArmGeo,
      lampHoodGeo,
      lampBulbGeo
    );

    this.layout.frames.forEach((placement, idx) => {
      const mem = memories[idx];
      if (!mem) return;

      const frameGroup = new THREE.Group();
      frameGroup.position.set(...placement.position);
      frameGroup.rotation.y = placement.rotationY;

      // 1. Outer Gold Molding
      const outerMesh = new THREE.Mesh(outerFrameGeo, this.goldFrameMat);
      outerMesh.castShadow = !this.isSoftwareGl;
      frameGroup.add(outerMesh);

      // 2. Inner Rose-Gold Fillet
      const filletMesh = new THREE.Mesh(filletGeo, this.roseFilletMat);
      frameGroup.add(filletMesh);

      // 3. Cream Museum Mat Board
      const matMesh = new THREE.Mesh(matBoardGeo, this.matBoardMat);
      frameGroup.add(matMesh);

      // 4. Artwork Canvas with safe fallback texture + async upgrade
      const fallbackTex = createFallbackArtworkTexture(mem.title, mem.date, this.maxAnisotropy);
      const artMat = new THREE.MeshBasicMaterial({ map: fallbackTex });
      const artMesh = new THREE.Mesh(artGeo, artMat);
      artMesh.position.z = 0.064;
      artMesh.userData = { memoryIndex: idx, placement };
      frameGroup.add(artMesh);

      this.frameArtworkResources.push({ texture: fallbackTex, material: artMat });
      this.interactableMeshes.push(artMesh);

      if (mem.img) {
        this.textureLoader.load(
          mem.img,
          (loadedTex) => {
            if (this.disposed) {
              loadedTex.dispose();
              return;
            }
            loadedTex.colorSpace = THREE.SRGBColorSpace;
            loadedTex.anisotropy = this.maxAnisotropy;
            artMat.map = loadedTex;
            artMat.needsUpdate = true;
            fallbackTex.dispose();
            this.frameArtworkResources.push({ texture: loadedTex, material: artMat });
          },
          undefined,
          () => {
            // Keep procedural fallback artwork silently
          }
        );
      }

      // 5. Brass Nameplate Plaque underneath
      const plaqueMesh = new THREE.Mesh(plaqueGeo, this.plaqueMat);
      plaqueMesh.position.set(0, -frameH / 2 - 0.28, 0.02);
      frameGroup.add(plaqueMesh);

      // 6. Gallery Picture Lamp above frame (sleek brass bar + warm bulb strip)
      const lampArm = new THREE.Mesh(lampArmGeo, this.lampShadeMat);
      lampArm.position.set(0, frameH / 2 + 0.22, 0.14);
      frameGroup.add(lampArm);

      const lampHood = new THREE.Mesh(lampHoodGeo, this.lampShadeMat);
      lampHood.position.set(0, frameH / 2 + 0.22, 0.28);
      frameGroup.add(lampHood);

      const lampGlowMat = new THREE.MeshStandardMaterial({
        color: 0xfff0dd,
        emissive: 0xffd2a6,
        emissiveIntensity: 0.9,
        roughness: 0.2,
      });
      this.frameLamps.push(lampGlowMat);
      this.disposableMaterials.push(lampGlowMat);

      const lampBulb = new THREE.Mesh(lampBulbGeo, lampGlowMat);
      lampBulb.rotation.x = Math.PI / 2;
      lampBulb.position.set(0, frameH / 2 + 0.185, 0.28);
      frameGroup.add(lampBulb);

      this.framesGroup.add(frameGroup);
    });
  }

  public focusMemory(index: number) {
    const placement = this.layout.frames[index];
    if (!placement) return;
    this.transitionCamPos.set(...placement.viewCameraPosition);
    const angles = computeLookAngles(placement.viewCameraPosition, placement.viewTargetPosition);
    this.transitionYaw = angles.yaw;
    this.transitionPitch = angles.pitch;
    this.walkVelocity.set(0, 0, 0);
    this.cameraTransitionActive = true;
  }

  public resetCamera() {
    this.transitionCamPos.set(0, this.eyeHeight, 7.6);
    this.transitionYaw = 0;
    this.transitionPitch = 0;
    this.walkVelocity.set(0, 0, 0);
    this.cameraTransitionActive = true;
  }

  public setVirtualWalk(forward: number, strafe = 0) {
    if (forward !== 0 || strafe !== 0) {
      this.cameraTransitionActive = false;
    }
    this.virtualWalk.forward = forward;
    this.virtualWalk.strafe = strafe;
  }

  public async requestPointerLock(): Promise<boolean> {
    if (this.disposed) return false;
    const canvas = this.renderer.domElement;
    if (!canvas.requestPointerLock) return false;
    try {
      const maybePromise = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (maybePromise && typeof maybePromise.then === 'function') {
        await maybePromise;
      }
      return document.pointerLockElement === canvas;
    } catch {
      return false;
    }
  }

  public exitPointerLock(): void {
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
  }

  private onPointerLockChange() {
    const locked = document.pointerLockElement === this.renderer.domElement;
    this.isPointerLocked = locked;
    this.lookPointerId = null;
    this.renderer.domElement.style.cursor = locked ? 'none' : 'grab';
    if (locked) {
      this.cameraTransitionActive = false;
    }
    this.callbacks.onPointerLockChange?.(locked);
  }

  private onResize() {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private onKeyDown(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const key = e.key.toLowerCase();
    if (
      [
        'w',
        'a',
        's',
        'd',
        'q',
        'e',
        'shift',
        'arrowup',
        'arrowdown',
        'arrowleft',
        'arrowright',
      ].includes(key)
    ) {
      this.cameraTransitionActive = false;
      this.keysPressed.add(key);
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    this.keysPressed.delete(e.key.toLowerCase());
  }

  private updatePointerNDC(e: PointerEvent) {
    if (this.isPointerLocked) {
      this.pointerNDC.set(0, 0);
      return;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private performHoverRaycast() {
    const now = performance.now();
    if (now - this.lastRaycastTime < 50) return; // Throttled ~20Hz
    this.lastRaycastTime = now;

    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hits = this.raycaster.intersectObjects(this.interactableMeshes, false);

    const nextHover = hits.length > 0 ? (hits[0].object.userData.memoryIndex as number) : null;
    if (nextHover !== this.hoveredIndex) {
      if (this.hoveredIndex !== null && this.frameLamps[this.hoveredIndex]) {
        this.frameLamps[this.hoveredIndex].emissiveIntensity = 0.9;
      }
      this.hoveredIndex = nextHover;
      if (this.hoveredIndex !== null && this.frameLamps[this.hoveredIndex]) {
        this.frameLamps[this.hoveredIndex].emissiveIntensity = 2.0;
      }
      if (!this.isPointerLocked && this.lookPointerId === null) {
        this.renderer.domElement.style.cursor = nextHover !== null ? 'pointer' : 'grab';
      }
      this.callbacks.onHoverMemory(nextHover);
    }
  }

  private onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (this.isPointerLocked || this.lookPointerId !== null) return;

    this.pointerDownPos.x = e.clientX;
    this.pointerDownPos.y = e.clientY;
    this.lastPointerPos.x = e.clientX;
    this.lastPointerPos.y = e.clientY;
    this.lookPointerId = e.pointerId;
    this.renderer.domElement.style.cursor = 'grabbing';
  }

  private onPointerCancel(e: PointerEvent) {
    if (e.pointerId === this.lookPointerId) {
      this.lookPointerId = null;
      if (!this.isPointerLocked) {
        this.renderer.domElement.style.cursor = this.hoveredIndex !== null ? 'pointer' : 'grab';
      }
    }
  }

  private onPointerUp(e: PointerEvent) {
    if (!this.isPointerLocked && e.pointerId !== this.lookPointerId) {
      return;
    }

    const wasDragging = this.lookPointerId !== null;
    this.lookPointerId = null;
    if (!this.isPointerLocked && wasDragging) {
      this.renderer.domElement.style.cursor = this.hoveredIndex !== null ? 'pointer' : 'grab';
    }

    // Only treat click on canvas (or while pointer-locked) as frame selection
    if (!this.isPointerLocked && e.target !== this.renderer.domElement) return;

    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    if (!this.isPointerLocked && dx * dx + dy * dy > 36) return;

    this.updatePointerNDC(e);
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hits = this.raycaster.intersectObjects(this.interactableMeshes, false);
    if (hits.length > 0) {
      const memIndex = hits[0].object.userData.memoryIndex as number;
      if (this.isPointerLocked) {
        this.exitPointerLock();
      }
      this.focusMemory(memIndex);
      this.callbacks.onSelectMemory(memIndex);
    }
  }

  private onPointerMove(e: PointerEvent) {
    if (this.isPointerLocked) {
      this.cameraTransitionActive = false;
      const sensitivity = 0.0022;
      this.yaw -= e.movementX * sensitivity;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch - e.movementY * sensitivity,
        -this.maxPitch,
        this.maxPitch
      );
      this.pointerNDC.set(0, 0);
      this.performHoverRaycast();
      return;
    }

    if (this.lookPointerId !== null) {
      if (e.pointerId !== this.lookPointerId) return;
      const dx = e.clientX - this.lastPointerPos.x;
      const dy = e.clientY - this.lastPointerPos.y;
      this.lastPointerPos.x = e.clientX;
      this.lastPointerPos.y = e.clientY;

      if (dx !== 0 || dy !== 0) {
        this.cameraTransitionActive = false;
        const sensitivity = 0.0034;
        this.yaw += dx * sensitivity;
        this.pitch = THREE.MathUtils.clamp(
          this.pitch + dy * sensitivity,
          -this.maxPitch,
          this.maxPitch
        );
      }
      return;
    }

    if (e.pointerType === 'mouse') {
      this.updatePointerNDC(e);
      this.performHoverRaycast();
    }
  }

  private updateMovement(delta: number) {
    // Optional Q/E keyboard yaw turning
    const turnInput =
      (this.keysPressed.has('q') ? 1 : 0) - (this.keysPressed.has('e') ? 1 : 0);
    if (turnInput !== 0) {
      this.yaw += turnInput * 1.85 * delta;
    }

    const forwardInput =
      (this.keysPressed.has('w') || this.keysPressed.has('arrowup') ? 1 : 0) -
      (this.keysPressed.has('s') || this.keysPressed.has('arrowdown') ? 1 : 0) +
      this.virtualWalk.forward;

    const strafeInput =
      (this.keysPressed.has('d') || this.keysPressed.has('arrowright') ? 1 : 0) -
      (this.keysPressed.has('a') || this.keysPressed.has('arrowleft') ? 1 : 0) +
      this.virtualWalk.strafe;

    const isSprinting = this.keysPressed.has('shift');
    const maxSpeed = isSprinting ? 6.8 : 4.4;

    // Horizontal forward and right basis from current FPS yaw
    _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    _desiredVel.set(0, 0, 0);
    if (forwardInput !== 0 || strafeInput !== 0) {
      _desiredVel.addScaledVector(_forward, forwardInput);
      _desiredVel.addScaledVector(_right, strafeInput);
      if (_desiredVel.lengthSq() > 1) {
        _desiredVel.normalize();
      }
      _desiredVel.multiplyScalar(maxSpeed);
    }

    // Smooth FPS inertia / deceleration
    const accelLambda = forwardInput !== 0 || strafeInput !== 0 ? 11 : 14;
    this.walkVelocity.x = THREE.MathUtils.damp(this.walkVelocity.x, _desiredVel.x, accelLambda, delta);
    this.walkVelocity.z = THREE.MathUtils.damp(this.walkVelocity.z, _desiredVel.z, accelLambda, delta);

    const speedMag = Math.hypot(this.walkVelocity.x, this.walkVelocity.z);
    if (speedMag > 0.01) {
      this.camera.position.x += this.walkVelocity.x * delta;
      this.camera.position.z += this.walkVelocity.z * delta;

      const maxHalfX = this.layout.corridorWidth / 2 - 0.9;
      const minWalkZ = this.layout.alcoveZ + 2.1;
      const maxWalkZ = this.layout.maxZ - 1.1;

      this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x, -maxHalfX, maxHalfX);
      this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z, minWalkZ, maxWalkZ);

      if (!this.prefersReducedMotion && !this.cameraTransitionActive) {
        this.walkBobPhase += delta * (isSprinting ? 11 : 8);
        const bobAmp = Math.min(1, speedMag / 4.4) * 0.024;
        this.camera.position.y = this.eyeHeight + Math.sin(this.walkBobPhase) * bobAmp;
      } else {
        this.camera.position.y = this.eyeHeight;
      }
    } else if (!this.cameraTransitionActive) {
      this.camera.position.y = THREE.MathUtils.damp(
        this.camera.position.y,
        this.eyeHeight,
        10,
        delta
      );
    }

    if (this.cameraTransitionActive) {
      const lambda = 5.8;
      this.camera.position.x = THREE.MathUtils.damp(
        this.camera.position.x,
        this.transitionCamPos.x,
        lambda,
        delta
      );
      this.camera.position.y = THREE.MathUtils.damp(
        this.camera.position.y,
        this.transitionCamPos.y,
        lambda,
        delta
      );
      this.camera.position.z = THREE.MathUtils.damp(
        this.camera.position.z,
        this.transitionCamPos.z,
        lambda,
        delta
      );

      const yawStep = shortestAngleDelta(this.yaw, this.transitionYaw);
      this.yaw += yawStep * (1 - Math.exp(-lambda * delta));
      this.pitch = THREE.MathUtils.damp(this.pitch, this.transitionPitch, lambda, delta);

      _desiredCamPos.copy(this.camera.position).sub(this.transitionCamPos);
      if (
        _desiredCamPos.lengthSq() < 0.0004 &&
        Math.abs(shortestAngleDelta(this.yaw, this.transitionYaw)) < 0.003 &&
        Math.abs(this.pitch - this.transitionPitch) < 0.003
      ) {
        this.camera.position.copy(this.transitionCamPos);
        this.yaw = this.transitionYaw;
        this.pitch = this.transitionPitch;
        this.cameraTransitionActive = false;
      }
    }

    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private startLoop() {
    this.lastFrameTimeMs = performance.now();
    const tick = () => {
      if (this.disposed) return;

      const now = performance.now();
      const delta = Math.min((now - this.lastFrameTimeMs) / 1000, 0.1);
      this.lastFrameTimeMs = now;
      this.elapsedSeconds += delta;

      this.updateMovement(delta);

      // Gentle ambient animation for particles and alcove crystal
      this.particleSystem.rotation.y += delta * 0.015;
      if (this.sculptureCrystal) {
        this.sculptureCrystal.rotation.y += delta * 0.45;
        this.sculptureCrystal.position.y = 2.05 + Math.sin(this.elapsedSeconds * 1.4) * 0.06;
      }
      if (this.sculptureRing) {
        this.sculptureRing.rotation.z += delta * 0.28;
      }

      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  public dispose() {
    this.disposed = true;
    this.exitPointerLock();
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResizeBound);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMoveBound);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDownBound);
    window.removeEventListener('pointerup', this.handlePointerUpBound);
    window.removeEventListener('pointercancel', this.handlePointerCancelBound);
    this.renderer.domElement.removeEventListener('dblclick', this.handleDoubleClickBound);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChangeBound);
    window.removeEventListener('keydown', this.handleKeyDownBound);
    window.removeEventListener('keyup', this.handleKeyUpBound);
    window.removeEventListener('blur', this.handleWindowBlurBound);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLostBound);

    this.frameArtworkResources.forEach(({ texture, material }) => {
      texture.dispose();
      material.dispose();
    });
    this.disposableTextures.forEach((t) => t.dispose());
    this.disposableGeometries.forEach((g) => g.dispose());
    this.disposableMaterials.forEach((m) => m.dispose());

    if (this.envRenderTarget) {
      this.envRenderTarget.dispose();
    }
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
