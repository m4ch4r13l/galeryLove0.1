import { useEffect, useState, type ChangeEvent } from 'react';
import { ImagePlus, Plus, Share2, Trash2, X } from 'lucide-react';
import type { GalleryData, MemoryItem } from '../types/gallery';
import { createMemoryId, encodeShareData, validateGalleryData } from '../utils/galleryLogic';

interface ConfigDrawerProps {
  isOpen: boolean;
  data: GalleryData;
  onClose: () => void;
  onSave: (updated: GalleryData) => void;
  onNotify: (msg: string) => void;
}

function resizeImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 960;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas no disponible'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => reject(new Error('Imagen inválida'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Error leyendo archivo'));
    reader.readAsDataURL(file);
  });
}

export function ConfigDrawer({
  isOpen,
  data,
  onClose,
  onSave,
  onNotify,
}: ConfigDrawerProps) {
  const [draft, setDraft] = useState<GalleryData>(data);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shareUrlPreview, setShareUrlPreview] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraft({
        ...data,
        memories: data.memories.map((m) => ({ ...m })),
      });
      setErrors({});
      setShareUrlPreview(null);
    }
  }, [isOpen, data]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const updateMemory = (idx: number, field: keyof MemoryItem, value: string) => {
    setDraft((prev) => ({
      ...prev,
      memories: prev.memories.map((m, i) => (i === idx ? { ...m, [field]: value } : m)),
    }));
  };

  const handleAddMemory = () => {
    setDraft((prev) => ({
      ...prev,
      memories: [
        ...prev.memories,
        {
          id: createMemoryId(prev.memories.length),
          title: 'Nuevo recuerdo',
          date: 'Fecha especial',
          img: './src/assets/images/memory_anniversary_1795027782628.jpg',
          desc: 'Escribe aquí un momento inolvidable compartido juntos.',
        },
      ],
    }));
  };

  const handleRemoveMemory = (idx: number) => {
    if (draft.memories.length <= 1) {
      onNotify('Debes mantener al menos un recuerdo en la galería.');
      return;
    }
    setDraft((prev) => ({
      ...prev,
      memories: prev.memories.filter((_, i) => i !== idx),
    }));
  };

  const handleFileUpload = async (idx: number, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file);
      updateMemory(idx, 'img', dataUrl);
      onNotify('Fotografía cargada en el cuadro');
    } catch {
      onNotify('No se pudo procesar la imagen seleccionada.');
    }
  };

  const handleSaveSubmit = () => {
    const result = validateGalleryData(draft);
    if (!result.valid) {
      setErrors(result.errors);
      onNotify('Revisa los campos marcados antes de guardar.');
      return;
    }
    setErrors({});
    onSave({
      names: draft.names.trim(),
      startDate: draft.startDate,
      memories: draft.memories.map((m) => ({
        ...m,
        title: m.title.trim(),
        date: m.date.trim(),
        img: m.img.trim(),
        desc: m.desc.trim(),
      })),
    });
  };

  const handleShareLink = async () => {
    const result = validateGalleryData(draft);
    if (!result.valid) {
      setErrors(result.errors);
      onNotify('Corrige los errores antes de generar el enlace.');
      return;
    }
    const encoded = encodeShareData(draft);
    const shareUrl = `${window.location.origin}${window.location.pathname}?data=${encoded}`;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        onNotify('Enlace copiado al portapapeles.');
        return;
      } catch {
        // Fallback to inline share box below
      }
    }
    setShareUrlPreview(shareUrl);
    onNotify('Enlace generado abajo para copiar.');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="config-drawer-title"
      className="fixed inset-0 z-50 flex justify-end bg-black/65"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="flex h-full w-full max-w-md flex-col border-l border-white/12 bg-[#120e22] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 id="config-drawer-title" className="font-display text-xl font-semibold text-white">
            Personalizar galería
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel de personalización"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-stone-200 hover:bg-rose-500/20 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Couple Details */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wide text-rose-300">
              Detalles de la pareja
            </h3>

            <div>
              <label
                htmlFor="input-couple-names"
                className="mb-1.5 block text-xs font-medium text-stone-200"
              >
                Nombres de la pareja
              </label>
              <input
                id="input-couple-names"
                type="text"
                value={draft.names}
                onChange={(e) => setDraft((prev) => ({ ...prev, names: e.target.value }))}
                className="w-full rounded-xl border border-white/15 bg-black/35 px-3.5 py-2.5 text-sm text-white focus:border-rose-400 focus:outline-none"
              />
              {errors.names && <p className="mt-1 text-xs text-rose-400">{errors.names}</p>}
            </div>

            <div>
              <label
                htmlFor="input-start-date"
                className="mb-1.5 block text-xs font-medium text-stone-200"
              >
                Fecha de inicio de relación
              </label>
              <input
                id="input-start-date"
                type="date"
                value={draft.startDate}
                onChange={(e) => setDraft((prev) => ({ ...prev, startDate: e.target.value }))}
                className="w-full rounded-xl border border-white/15 bg-black/35 px-3.5 py-2.5 text-sm text-white [color-scheme:dark] focus:border-rose-400 focus:outline-none"
              />
              {errors.startDate && (
                <p className="mt-1 text-xs text-rose-400">{errors.startDate}</p>
              )}
            </div>
          </section>

          <hr className="border-white/10" />

          {/* Memories List */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-rose-300 tabular-nums">
                Cuadros y recuerdos ({draft.memories.length})
              </h3>
              <button
                type="button"
                onClick={handleAddMemory}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/35 bg-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-100 hover:bg-rose-500/35 transition-colors whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Añadir recuerdo</span>
              </button>
            </div>

            <div className="divide-y divide-white/10">
              {draft.memories.map((mem, idx) => (
                <div
                  key={mem.id}
                  className="space-y-3 py-5 first:pt-2 last:pb-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-rose-200 tabular-nums">
                      Cuadro #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMemory(idx)}
                      aria-label={`Eliminar recuerdo ${mem.title || idx + 1}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-red-500/15 hover:text-red-300 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div>
                    <label
                      htmlFor={`mem-title-${idx}`}
                      className="mb-1 block text-[11px] font-medium text-stone-300"
                    >
                      Título
                    </label>
                    <input
                      id={`mem-title-${idx}`}
                      type="text"
                      value={mem.title}
                      onChange={(e) => updateMemory(idx, 'title', e.target.value)}
                      className="w-full rounded-lg border border-white/12 bg-black/35 px-3 py-2 text-xs text-white focus:border-rose-400 focus:outline-none"
                    />
                    {errors[`mem-${idx}-title`] && (
                      <p className="mt-1 text-[11px] text-rose-400">{errors[`mem-${idx}-title`]}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor={`mem-date-${idx}`}
                      className="mb-1 block text-[11px] font-medium text-stone-300"
                    >
                      Fecha
                    </label>
                    <input
                      id={`mem-date-${idx}`}
                      type="text"
                      value={mem.date}
                      onChange={(e) => updateMemory(idx, 'date', e.target.value)}
                      className="w-full rounded-lg border border-white/12 bg-black/35 px-3 py-2 text-xs text-white focus:border-rose-400 focus:outline-none"
                    />
                    {errors[`mem-${idx}-date`] && (
                      <p className="mt-1 text-[11px] text-rose-400">{errors[`mem-${idx}-date`]}</p>
                    )}
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label
                        htmlFor={`mem-img-${idx}`}
                        className="text-[11px] font-medium text-stone-300"
                      >
                        Imagen (URL o archivo)
                      </label>
                      <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-rose-300 hover:text-rose-200">
                        <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Subir foto</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(idx, e)}
                          className="sr-only"
                        />
                      </label>
                    </div>
                    <input
                      id={`mem-img-${idx}`}
                      type="text"
                      value={mem.img}
                      onChange={(e) => updateMemory(idx, 'img', e.target.value)}
                      className="w-full rounded-lg border border-white/12 bg-black/35 px-3 py-2 text-xs text-white focus:border-rose-400 focus:outline-none"
                    />
                    {errors[`mem-${idx}-img`] && (
                      <p className="mt-1 text-[11px] text-rose-400">{errors[`mem-${idx}-img`]}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor={`mem-desc-${idx}`}
                      className="mb-1 block text-[11px] font-medium text-stone-300"
                    >
                      Nota romántica (reverso)
                    </label>
                    <textarea
                      id={`mem-desc-${idx}`}
                      rows={2}
                      value={mem.desc}
                      onChange={(e) => updateMemory(idx, 'desc', e.target.value)}
                      className="w-full resize-none rounded-lg border border-white/12 bg-black/35 px-3 py-2 text-xs text-white focus:border-rose-400 focus:outline-none"
                    />
                    {errors[`mem-${idx}-desc`] && (
                      <p className="mt-1 text-[11px] text-rose-400">{errors[`mem-${idx}-desc`]}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {shareUrlPreview && (
          <div className="border-t border-white/10 bg-black/40 px-6 py-3">
            <label
              htmlFor="share-url-output"
              className="mb-1 block text-[11px] font-medium text-rose-200"
            >
              Copia este enlace para compartir tu galería:
            </label>
            <input
              id="share-url-output"
              type="text"
              readOnly
              value={shareUrlPreview}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 text-xs text-stone-200"
            />
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-white/10 bg-black/30 px-6 py-4">
          <button
            type="button"
            onClick={handleSaveSubmit}
            className="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white shadow-lg hover:bg-rose-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
          >
            Guardar y aplicar
          </button>
          <button
            type="button"
            onClick={handleShareLink}
            aria-label="Copiar enlace para compartir"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/12 bg-white/8 text-stone-100 hover:bg-white/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </aside>
    </div>
  );
}
