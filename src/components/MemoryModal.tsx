import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Heart, ImageOff, RotateCw, X } from 'lucide-react';
import type { MemoryItem } from '../types/gallery';
import { resolveGalleryImageUrl } from '../utils/galleryLogic';

interface MemoryModalProps {
  memories: MemoryItem[];
  activeIndex: number | null;
  onClose: () => void;
  onSelectIndex: (index: number) => void;
}

export function MemoryModal({
  memories,
  activeIndex,
  onClose,
  onSelectIndex,
}: MemoryModalProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const memory = activeIndex !== null ? memories[activeIndex] ?? null : null;

  useEffect(() => {
    setIsFlipped(false);
    setImageFailed(false);
  }, [activeIndex, memory?.img]);

  useEffect(() => {
    if (activeIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        onSelectIndex((activeIndex - 1 + memories.length) % memories.length);
      } else if (e.key === 'ArrowRight') {
        onSelectIndex((activeIndex + 1) % memories.length);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeIndex, memories.length, onClose, onSelectIndex]);

  if (activeIndex === null || !memory) return null;

  const handlePrev = () => {
    onSelectIndex((activeIndex - 1 + memories.length) % memories.length);
  };

  const handleNext = () => {
    onSelectIndex((activeIndex + 1) % memories.length);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="memory-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-xl rounded-3xl border border-white/15 bg-[#141026] p-5 md:p-7 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <span
            data-testid="memory-modal-counter"
            className="text-xs font-medium text-rose-200/90 tabular-nums"
          >
            Recuerdo {activeIndex + 1} de {memories.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar recuerdo"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/8 text-stone-200 hover:bg-rose-500/25 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Flip Card Button */}
        <button
          type="button"
          data-testid="memory-flip-button"
          onClick={() => setIsFlipped((prev) => !prev)}
          aria-pressed={isFlipped}
          aria-label={isFlipped ? 'Mostrar fotografía' : 'Voltear tarjeta para leer la nota'}
          className="card-flip block w-full h-[380px] md:h-[420px] text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 rounded-2xl"
        >
          <div className={`card-inner relative h-full w-full rounded-2xl ${isFlipped ? 'flipped' : ''}`}>
            {/* Front Side: Photo & Title */}
            <div className="card-front absolute inset-0 flex h-full w-full flex-col overflow-hidden rounded-2xl bg-[#1b1533] p-4">
              <div className="relative mb-4 h-64 md:h-72 w-full overflow-hidden rounded-xl bg-[#0e0b1b]">
                {!imageFailed && memory.img ? (
                  <img
                    src={resolveGalleryImageUrl(memory.img, import.meta.env.BASE_URL)}
                    alt={memory.title}
                    referrerPolicy="no-referrer"
                    onError={() => setImageFailed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#2b173c] via-[#18122b] to-[#341a2f] p-6 text-center">
                    <ImageOff className="h-8 w-8 text-rose-200/70" aria-hidden="true" />
                    <p className="font-display text-lg text-stone-200">{memory.title}</p>
                    <p className="text-xs text-stone-400">No se pudo cargar la fotografía externa</p>
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              </div>

              <div className="flex flex-1 flex-col justify-center text-center px-2">
                <p className="text-xs font-medium text-rose-200/90 mb-1">{memory.date}</p>
                <h2
                  id="memory-modal-title"
                  className="font-display text-xl md:text-2xl font-semibold text-white mb-1.5"
                >
                  {memory.title}
                </h2>
                <p className="inline-flex items-center justify-center gap-1.5 text-xs text-stone-300">
                  <RotateCw className="h-3.5 w-3.5 text-rose-300" aria-hidden="true" />
                  <span>Haz clic en la tarjeta para leer la nota</span>
                </p>
              </div>
            </div>

            {/* Back Side: Romantic Note */}
            <div className="card-back absolute inset-0 flex h-full w-full flex-col justify-between overflow-y-auto rounded-2xl bg-[#19132e] p-6 md:p-8">
              <div>
                <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="font-display text-sm italic text-rose-200">
                    Nota del recuerdo · {memory.date}
                  </span>
                  <Heart className="h-4 w-4 text-rose-400" aria-hidden="true" />
                </div>
                <h3 className="font-display text-xl font-medium text-white mb-3">
                  {memory.title}
                </h3>
                <p className="whitespace-pre-line text-sm md:text-base font-normal leading-relaxed text-stone-200">
                  {memory.desc}
                </p>
              </div>
              <div className="border-t border-white/10 pt-4 text-center">
                <span className="text-xs font-medium text-rose-300">
                  Haz clic de nuevo para ver la fotografía
                </span>
              </div>
            </div>
          </div>
        </button>

        {/* Modal Navigation Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={handlePrev}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-stone-100 hover:bg-white/12 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Anterior</span>
          </button>

          <span className="text-xs text-stone-400">Esc para cerrar</span>

          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-stone-100 hover:bg-white/12 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
          >
            <span>Siguiente</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
