import { DoorOpen, Maximize2, Sparkles } from 'lucide-react';
import type { RelationshipDuration } from '../types/gallery';

interface WelcomeModalProps {
  coupleNames: string;
  duration: RelationshipDuration;
  memoryCount: number;
  isMobileTouch: boolean;
  onEnter: () => void;
}

export function WelcomeModal({
  coupleNames,
  duration,
  memoryCount,
  isMobileTouch,
  onEnter,
}: WelcomeModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-gallery-title"
      data-testid="welcome-modal"
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#0b0917]/82 p-4"
    >
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-white/15 bg-[#141026] p-6 sm:p-8 text-center shadow-2xl">
        <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-300/25 bg-rose-500/15 text-rose-200">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-200/80 mb-1.5">
          El Pasillo de los Recuerdos
        </p>

        <h1
          id="welcome-gallery-title"
          className="font-display text-2xl sm:text-3xl font-semibold tracking-wide text-white mb-2"
        >
          {coupleNames}
        </h1>

        <p className="text-xs sm:text-sm text-rose-200/90 tabular-nums mb-4">
          Juntos: {duration.formatted} · {memoryCount} recuerdos
        </p>

        <p className="text-xs sm:text-sm leading-relaxed text-stone-300 mb-6">
          {isMobileTouch
            ? 'Explora nuestra galería 3D en pantalla completa horizontal. Usa la cruceta izquierda para caminar y desliza la pantalla para mirar.'
            : 'Recorre el pasillo en primera persona, acércate a cada cuadro iluminado y descubre las notas guardadas en su interior.'}
        </p>

        <button
          type="button"
          data-testid="enter-gallery-button"
          onClick={onEnter}
          className="inline-flex w-full items-center justify-center gap-2.5 rounded-2xl bg-rose-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg hover:bg-rose-500 active:scale-[0.99] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
        >
          {isMobileTouch ? (
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <DoorOpen className="h-4 w-4" aria-hidden="true" />
          )}
          <span>Entrar a la galería</span>
        </button>
      </div>
    </div>
  );
}
