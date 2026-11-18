import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { ConfigDrawer } from './components/ConfigDrawer';
import { GalleryHUD } from './components/GalleryHUD';
import { MemoryModal } from './components/MemoryModal';
import { useMobileTouch } from './hooks/useMobileTouch';
import { GallerySceneController } from './three/GalleryScene';
import type { GalleryData } from './types/gallery';
import {
  calculateRelationshipDuration,
  loadGalleryData,
  saveGalleryData,
} from './utils/galleryLogic';
import { AmbientMusicEngine } from './utils/proceduralAudio';

export default function App() {
  const [galleryData, setGalleryData] = useState<GalleryData>(() =>
    loadGalleryData(
      typeof window !== 'undefined' ? window.location.search : '',
      typeof window !== 'undefined' ? window.localStorage : null
    )
  );
  const [activeMemoryIndex, setActiveMemoryIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => new Date());
  const isMobileTouch = useMobileTouch();

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<GallerySceneController | null>(null);
  const audioRef = useRef<AmbientMusicEngine | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const initialMemoriesRef = useRef(galleryData.memories);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  }, []);

  // Update relationship timer every 30s
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const duration = useMemo(
    () => calculateRelationshipDuration(galleryData.startDate, nowTick),
    [galleryData.startDate, nowTick]
  );

  // Mount Three.js scene once
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    try {
      const controller = new GallerySceneController(mountEl, initialMemoriesRef.current, {
        onSelectMemory: (idx) => {
          setFocusedIndex(idx);
          setActiveMemoryIndex(idx);
        },
        onHoverMemory: (idx) => {
          setHoveredIndex(idx);
        },
        onPointerLockChange: (locked) => {
          setIsPointerLocked(locked);
        },
        onWebGLError: () => {
          setWebglUnavailable(true);
        },
      });
      sceneRef.current = controller;
    } catch {
      setWebglUnavailable(true);
    }

    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
      audioRef.current?.stop();
      audioRef.current = null;
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleSaveConfig = useCallback(
    (updated: GalleryData) => {
      setGalleryData(updated);
      saveGalleryData(updated, window.localStorage);
      setFocusedIndex((prev) => Math.min(prev, updated.memories.length - 1));
      sceneRef.current?.buildFrames(updated.memories);
      setIsConfigOpen(false);
      showToast('Galería actualizada con éxito');
    },
    [showToast]
  );

  const handleToggleAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new AmbientMusicEngine();
    }
    if (audioRef.current.isPlaying()) {
      audioRef.current.stop();
      setIsAudioPlaying(false);
      showToast('Música ambiental pausada');
    } else {
      const ok = audioRef.current.start();
      setIsAudioPlaying(ok);
      showToast(ok ? 'Música ambiental activada' : 'El navegador bloqueó el audio');
    }
  }, [showToast]);

  const handleSelectFrameIndex = useCallback((idx: number) => {
    setFocusedIndex(idx);
    sceneRef.current?.focusMemory(idx);
    setActiveMemoryIndex(idx);
  }, []);

  const handleStepFrame = useCallback(
    (delta: number) => {
      const count = galleryData.memories.length;
      if (count === 0) return;
      const next = (focusedIndex + delta + count) % count;
      setFocusedIndex(next);
      sceneRef.current?.focusMemory(next);
    },
    [focusedIndex, galleryData.memories.length]
  );

  const handleResetCamera = useCallback(() => {
    sceneRef.current?.resetCamera();
  }, []);

  const handleWalkChange = useCallback((forward: number, strafe = 0) => {
    sceneRef.current?.setVirtualWalk(forward, strafe);
  }, []);

  const handleTogglePointerLock = useCallback(async () => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (isPointerLocked) {
      scene.exitPointerLock();
      return;
    }
    const ok = await scene.requestPointerLock();
    if (ok) {
      showToast('Modo FPS activo · Esc para liberar cursor');
    } else {
      showToast('Arrastra sobre la galería para mirar en 1.ª persona');
    }
  }, [isPointerLocked, showToast]);

  useEffect(() => {
    if (isConfigOpen || activeMemoryIndex !== null || isDockCollapsed) {
      sceneRef.current?.setVirtualWalk(0, 0);
    }
    if (isConfigOpen || activeMemoryIndex !== null) {
      sceneRef.current?.exitPointerLock();
    }
  }, [isConfigOpen, activeMemoryIndex, isDockCollapsed]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || isConfigOpen || activeMemoryIndex !== null) {
        return;
      }
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        void handleTogglePointerLock();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isConfigOpen, activeMemoryIndex, handleTogglePointerLock]);

  return (
    <main className="relative h-full w-full overflow-hidden bg-[#0b0917] select-none">
      {/* Isolated WebGL mount container */}
      <div
        ref={canvasMountRef}
        data-testid="gallery-canvas-mount"
        className="absolute inset-0 z-0 h-full w-full touch-none"
      />

      {/* Graceful fallback if WebGL context cannot initialize */}
      {webglUnavailable && (
        <div className="relative z-10 flex h-full w-full items-center justify-center p-6">
          <div className="max-w-lg rounded-3xl border border-white/12 bg-[#141026] p-8 text-center shadow-2xl">
            <h2 className="font-display text-2xl font-semibold text-white mb-2">
              {galleryData.names}
            </h2>
            <p className="text-sm text-stone-300 mb-6">
              Tu navegador no pudo iniciar el entorno 3D, pero puedes explorar todos los recuerdos
              desde aquí.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {galleryData.memories.map((mem, idx) => (
                <button
                  key={mem.id}
                  type="button"
                  onClick={() => setActiveMemoryIndex(idx)}
                  className="rounded-xl border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10 transition-colors"
                >
                  <p className="text-xs font-medium text-white truncate">{mem.title}</p>
                  <p className="text-[11px] text-rose-200/80 truncate">{mem.date}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!webglUnavailable && (
        <GalleryHUD
          coupleNames={galleryData.names}
          duration={duration}
          memories={galleryData.memories}
          focusedIndex={focusedIndex}
          hoveredIndex={hoveredIndex}
          isAudioPlaying={isAudioPlaying}
          isPointerLocked={isPointerLocked}
          isDockCollapsed={isDockCollapsed}
          isMobileTouch={isMobileTouch}
          onToggleAudio={handleToggleAudio}
          onTogglePointerLock={handleTogglePointerLock}
          onOpenConfig={() => setIsConfigOpen(true)}
          onToggleDock={() => setIsDockCollapsed((prev) => !prev)}
          onPrevFrame={() => handleStepFrame(-1)}
          onNextFrame={() => handleStepFrame(1)}
          onOpenFocusedMemory={() => setActiveMemoryIndex(focusedIndex)}
          onResetCamera={handleResetCamera}
          onWalkChange={handleWalkChange}
        />
      )}

      <MemoryModal
        memories={galleryData.memories}
        activeIndex={activeMemoryIndex}
        onClose={() => setActiveMemoryIndex(null)}
        onSelectIndex={handleSelectFrameIndex}
      />

      <ConfigDrawer
        isOpen={isConfigOpen}
        data={galleryData}
        onClose={() => setIsConfigOpen(false)}
        onSave={handleSaveConfig}
        onNotify={showToast}
      />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-rose-300/30 bg-[#141026] px-5 py-2.5 text-xs font-medium text-white shadow-2xl"
        >
          <CheckCircle2 className="h-4 w-4 text-rose-300" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}
    </main>
  );
}
