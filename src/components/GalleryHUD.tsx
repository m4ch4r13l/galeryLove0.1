import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Crosshair,
  Eye,
  Music,
  SlidersHorizontal,
  VolumeX,
} from 'lucide-react';
import type { MemoryItem, RelationshipDuration } from '../types/gallery';
import { TouchJoystick } from './TouchJoystick';

interface GalleryHUDProps {
  coupleNames: string;
  duration: RelationshipDuration;
  memories: MemoryItem[];
  focusedIndex: number;
  hoveredIndex: number | null;
  isAudioPlaying: boolean;
  isPointerLocked: boolean;
  isDockCollapsed: boolean;
  isMobileTouch: boolean;
  onToggleAudio: () => void;
  onTogglePointerLock: () => void;
  onOpenConfig: () => void;
  onToggleDock: () => void;
  onPrevFrame: () => void;
  onNextFrame: () => void;
  onOpenFocusedMemory: () => void;
  onResetCamera: () => void;
  onWalkChange: (forward: number, strafe?: number) => void;
}

export function GalleryHUD({
  coupleNames,
  duration,
  memories,
  focusedIndex,
  hoveredIndex,
  isAudioPlaying,
  isPointerLocked,
  isDockCollapsed,
  isMobileTouch,
  onToggleAudio,
  onTogglePointerLock,
  onOpenConfig,
  onToggleDock,
  onPrevFrame,
  onNextFrame,
  onOpenFocusedMemory,
  onResetCamera,
  onWalkChange,
}: GalleryHUDProps) {
  const hoveredMemory = hoveredIndex !== null ? memories[hoveredIndex] : null;
  const focusedMemory = memories[focusedIndex] ?? memories[0];

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-3 sm:p-4 md:p-6 [@media(max-height:460px)]:p-2.5">
      {/* Top Bar — minimal 2-edge layout keeping center 3D vista completely open */}
      <header className="pointer-events-auto flex items-center justify-between gap-2.5 sm:gap-4">
        <div className="min-w-0 flex flex-col sm:flex-row sm:items-baseline sm:gap-4 rounded-xl border border-white/12 bg-[#0f0c1c]/90 px-3.5 sm:px-4 py-2 sm:py-2.5 shadow-lg">
          <h1
            data-testid="couple-names-heading"
            className="font-display text-base sm:text-lg md:text-xl font-semibold tracking-wide text-stone-100 truncate"
          >
            {coupleNames}
          </h1>
          <p
            data-testid="relationship-timer"
            className="text-[11px] sm:text-xs text-rose-200/85 tabular-nums truncate"
          >
            Juntos: {duration.formatted}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onToggleAudio}
            aria-pressed={isAudioPlaying}
            aria-label={isAudioPlaying ? 'Pausar música ambiental' : 'Activar música ambiental'}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 sm:px-3.5 py-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 ${
              isAudioPlaying
                ? 'border-rose-300/50 bg-rose-500/25 text-white'
                : 'border-white/12 bg-[#0f0c1c]/90 text-stone-200 hover:bg-[#1b1630]'
            }`}
          >
            {isAudioPlaying ? (
              <Music className="h-4 w-4 text-rose-200" aria-hidden="true" />
            ) : (
              <VolumeX className="h-4 w-4 text-stone-300" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{isAudioPlaying ? 'Música activa' : 'Música'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenConfig}
            aria-label="Personalizar galería"
            className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-[#0f0c1c]/90 px-3 sm:px-3.5 py-2.5 text-xs font-medium text-stone-100 hover:bg-[#1b1630] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
          >
            <SlidersHorizontal className="h-4 w-4 text-rose-200" aria-hidden="true" />
            <span className="hidden sm:inline">Personalizar</span>
          </button>
        </div>
      </header>

      {/* Non-intrusive top-center hover cue (never blocks central corridor) */}
      <div className="flex justify-center">
        {hoveredMemory && (
          <div className="rounded-lg border border-rose-200/25 bg-[#0f0c1c]/92 px-4 py-1.5 text-xs text-stone-100 shadow-lg">
            <span className="text-rose-200">{hoveredMemory.title}</span>
            <span className="mx-2 text-stone-500" aria-hidden="true">
              ·
            </span>
            <span className="text-stone-300">Clic para abrir</span>
          </div>
        )}
      </div>

      {/* Minimal center FPS crosshair only when Pointer Lock is active */}
      {isPointerLocked && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <div className="h-2.5 w-2.5 rounded-full border border-rose-200/90 bg-white/40 shadow" />
        </div>
      )}

      {/* Collapsible Bottom Control Dock & Touch Joystick */}
      <div className="pointer-events-none flex flex-col items-center">
        {isMobileTouch && !isDockCollapsed && (
          <div className="pointer-events-none mb-2 sm:mb-3 [@media(max-height:460px)]:mb-1.5 flex w-full max-w-3xl justify-start">
            <div className="pointer-events-auto">
              <TouchJoystick onMove={(fwd, str) => onWalkChange(fwd, str)} />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleDock}
          aria-expanded={!isDockCollapsed}
          className="pointer-events-auto mb-2 inline-flex items-center gap-1.5 rounded-t-lg border border-b-0 border-white/12 bg-[#0f0c1c]/90 px-3.5 py-1 text-[11px] font-medium text-stone-300 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
        >
          {isDockCollapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Mostrar controles</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Ocultar controles</span>
            </>
          )}
        </button>

        {!isDockCollapsed && (
          <div
            data-testid="bottom-control-dock"
            className="pointer-events-auto w-full max-w-3xl rounded-2xl border border-white/12 bg-[#0f0c1c]/92 px-4 py-3 shadow-2xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Frame Step Controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onPrevFrame}
                  aria-label="Ir al cuadro anterior"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-stone-200 hover:bg-white/12 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>

                <div className="min-w-[130px] px-2">
                  <p className="text-[11px] text-rose-200/80 tabular-nums">
                    Cuadro {focusedIndex + 1} de {memories.length}
                  </p>
                  <p className="max-w-[170px] truncate text-xs font-medium text-stone-100">
                    {focusedMemory?.title}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onNextFrame}
                  aria-label="Ir al siguiente cuadro"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-stone-200 hover:bg-white/12 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {/* Primary Inspect + FPS Mode (desktop) + Camera Reset */}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onOpenFocusedMemory}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-500 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  <span>Abrir recuerdo</span>
                </button>

                {!isMobileTouch && (
                  <button
                    type="button"
                    onClick={onTogglePointerLock}
                    aria-pressed={isPointerLocked}
                    aria-label={isPointerLocked ? 'Salir del modo FPS' : 'Activar modo FPS libre'}
                    className={`hidden sm:inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 ${
                      isPointerLocked
                        ? 'border-rose-300/60 bg-rose-500/25 text-white'
                        : 'border-white/10 bg-white/5 text-stone-200 hover:bg-white/12'
                    }`}
                  >
                    <Crosshair className="h-4 w-4 text-rose-200" aria-hidden="true" />
                    <span>{isPointerLocked ? 'FPS activo' : 'Modo FPS'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onResetCamera}
                  aria-label="Volver a la vista inicial"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs font-medium text-stone-200 hover:bg-white/12 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                >
                  <Compass className="h-4 w-4 text-rose-200" aria-hidden="true" />
                  <span className="hidden md:inline">Vista inicial</span>
                </button>
              </div>
            </div>

            {isMobileTouch ? (
              <p className="mt-2 text-[11px] text-stone-400">
                Usa el joystick para caminar · Arrastra la pantalla para mirar · Toca un cuadro
              </p>
            ) : (
              <p className="mt-2 hidden md:block text-[11px] text-stone-400">
                <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-stone-200">WASD</kbd> o{' '}
                <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-stone-200">Flechas</kbd>{' '}
                caminar · <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-stone-200">Shift</kbd>{' '}
                correr · <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-stone-200">Q/E</kbd>{' '}
                girar · Arrastra o pulsa{' '}
                <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-stone-200">F</kbd> para modo
                FPS · Clic en cuadro
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
