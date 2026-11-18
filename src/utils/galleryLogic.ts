import type {
  CorridorLayout,
  FramePlacement,
  GalleryData,
  MemoryItem,
  RelationshipDuration,
  ValidationResult,
} from '../types/gallery';

export const STORAGE_KEY = 'art_gallery_couple_data_v2';
export const LEGACY_STORAGE_KEY = 'art_gallery_couple_data';

export const DEFAULT_GALLERY_DATA: GalleryData = {
  names: 'Alex & Sofía',
  startDate: '2022-10-14',
  memories: [
    {
      id: 'mem-1',
      title: 'Nuestra primera cita',
      date: '14 Octubre, 2022',
      img: './src/assets/images/memory_first_date_1795027781706.jpg',
      desc: 'Esa tarde en el café del centro parecía que el tiempo se había detenido. Recuerdo que estabas nerviosa y pediste un té de manzanilla, y al sonreír supe que mi vida entera cambiaría desde ese preciso instante.',
    },
    {
      id: 'mem-2',
      title: 'Bajo las estrellas',
      date: '10 Enero, 2023',
      img: './src/assets/images/memory_starry_beach_1795027781376.jpg',
      desc: 'Pasamos toda la noche en la playa viendo la lluvia de estrellas. Ninguno tenía frío porque nos cubría la misma manta y las risas no paraban. Pedí un deseo: estar siempre a tu lado.',
    },
    {
      id: 'mem-3',
      title: 'Nuestro primer viaje juntos',
      date: '15 Julio, 2023',
      img: './src/assets/images/memory_europe_trip_1795027780809.jpg',
      desc: 'Perdidos en las calles empedradas de esa hermosa ciudad europea. Caminamos sin rumbo fijo durante horas, comiendo helado derretido y tomando fotos a cada rincón que nos robaba el aliento.',
    },
    {
      id: 'mem-4',
      title: 'Un café y una tarde de lluvia',
      date: '22 Noviembre, 2023',
      img: './src/assets/images/memory_rainy_coffee_1795027782964.jpg',
      desc: 'La tormenta afuera rugía con fuerza, pero adentro, junto a la ventana y con olor a café recién hecho y libros viejos, sentí la paz más absoluta que jamás había conocido entre tus brazos.',
    },
    {
      id: 'mem-5',
      title: 'Celebrando nuestro aniversario',
      date: '14 Octubre, 2024',
      img: './src/assets/images/memory_anniversary_1795027782628.jpg',
      desc: 'Una cena hermosa a la luz de las velas. Brindamos por nosotros, por todo lo superado y por los sueños que aún nos faltan por cumplir juntos. Te amo hoy más que ayer.',
    },
    {
      id: 'mem-6',
      title: 'Atardecer inolvidable',
      date: '5 Mayo, 2025',
      img: './src/assets/images/memory_sunset_horizon_1795027782769.jpg',
      desc: 'El cielo se tiñó de tonos dorados y violetas mientras el sol se ocultaba en el horizonte. Tomé tu mano con fuerza, sabiendo que no hay lugar en el mundo donde prefiera estar sino contigo.',
    },
  ],
};

export function createMemoryId(index = 0): string {
  return `mem-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Parses a YYYY-MM-DD string in local time so timezone offsets never shift the day.
 */
export function parseLocalDate(dateStr: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day, 0, 0, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

export function calculateRelationshipDuration(
  startDateStr: string,
  now: Date = new Date()
): RelationshipDuration {
  const start = parseLocalDate(startDateStr);
  if (!start) {
    return {
      isFuture: false,
      isValid: false,
      days: 0,
      hours: 0,
      minutes: 0,
      formatted: 'Fecha por definir',
    };
  }

  const diff = now.getTime() - start.getTime();
  if (diff < 0) {
    return {
      isFuture: true,
      isValid: true,
      days: 0,
      hours: 0,
      minutes: 0,
      formatted: 'Pronto comenzará',
    };
  }

  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return {
    isFuture: false,
    isValid: true,
    days,
    hours,
    minutes,
    formatted: `${days.toLocaleString('es-ES')} días · ${hours} h · ${minutes} min`,
  };
}

/**
 * UTF-8 safe Base64 encoding for shareable URLs.
 */
export function encodeShareData(data: GalleryData): string {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodes either URL-safe UTF-8 Base64 or legacy encodeURIComponent Base64.
 */
export function decodeShareData(encoded: string): GalleryData | null {
  try {
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const utf8 = new TextDecoder().decode(bytes);
    let parsed: unknown;
    try {
      parsed = JSON.parse(utf8);
    } catch {
      parsed = JSON.parse(decodeURIComponent(utf8));
    }
    return sanitizeGalleryData(parsed);
  } catch {
    return null;
  }
}

export function sanitizeGalleryData(raw: unknown): GalleryData | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.names !== 'string' || !Array.isArray(candidate.memories)) {
    return null;
  }

  const cleanMemories: MemoryItem[] = candidate.memories
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item, index) => ({
      id: typeof item.id === 'string' && item.id.trim() ? item.id : `mem-loaded-${index}`,
      title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : `Recuerdo #${index + 1}`,
      date: typeof item.date === 'string' && item.date.trim() ? item.date.trim() : 'Fecha especial',
      img: typeof item.img === 'string' ? item.img.trim() : '',
      desc: typeof item.desc === 'string' ? item.desc.trim() : '',
    }));

  if (cleanMemories.length === 0) return null;

  return {
    names: candidate.names.trim() || DEFAULT_GALLERY_DATA.names,
    startDate:
      typeof candidate.startDate === 'string' && parseLocalDate(candidate.startDate)
        ? candidate.startDate
        : DEFAULT_GALLERY_DATA.startDate,
    memories: cleanMemories,
  };
}

export function isValidImageSource(src: string): boolean {
  const trimmed = src.trim();
  if (!trimmed) return false;
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/src/') ||
    trimmed.startsWith('./src/') ||
    trimmed.startsWith('src/') ||
    trimmed.startsWith('/assets/') ||
    trimmed.startsWith('./assets/') ||
    trimmed.startsWith('data:image/')
  );
}

/**
 * Resolves memory image URLs safely across root domains and GitHub Pages subpaths
 * (e.g. https://user.github.io/repo-name/), preserving external URLs and data URIs.
 */
export function resolveGalleryImageUrl(src: string, baseUrl = './'): string {
  const trimmed = src.trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  const normalizedBase = !baseUrl ? './' : baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const relativePath = trimmed.replace(/^\.\//, '').replace(/^\/+/, '');
  return `${normalizedBase}${relativePath}`;
}

export function validateGalleryData(data: GalleryData): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.names.trim()) {
    errors.names = 'Ingresa los nombres de la pareja.';
  }

  if (!parseLocalDate(data.startDate)) {
    errors.startDate = 'Selecciona una fecha válida.';
  }

  if (data.memories.length === 0) {
    errors.memories = 'Debe existir al menos un recuerdo en la galería.';
  }

  data.memories.forEach((mem, idx) => {
    if (!mem.title.trim()) {
      errors[`mem-${idx}-title`] = 'El título es obligatorio.';
    }
    if (!mem.date.trim()) {
      errors[`mem-${idx}-date`] = 'La fecha es obligatoria.';
    }
    if (!isValidImageSource(mem.img)) {
      errors[`mem-${idx}-img`] = 'Usa una URL válida (https://...) o sube una foto.';
    }
    if (!mem.desc.trim()) {
      errors[`mem-${idx}-desc`] = 'Escribe una breve nota romántica.';
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadGalleryData(search: string, storage?: StorageLike | null): GalleryData {
  try {
    const params = new URLSearchParams(search);
    const encoded = params.get('data');
    if (encoded) {
      const decoded = decodeShareData(encoded);
      if (decoded) return decoded;
    }
    if (storage) {
      const saved = storage.getItem(STORAGE_KEY) || storage.getItem(LEGACY_STORAGE_KEY);
      if (saved) {
        const parsed = sanitizeGalleryData(JSON.parse(saved));
        if (parsed) return parsed;
      }
    }
  } catch {
    // Fallback cleanly to default seed data
  }
  return {
    ...DEFAULT_GALLERY_DATA,
    memories: DEFAULT_GALLERY_DATA.memories.map((m) => ({ ...m })),
  };
}

export function saveGalleryData(data: GalleryData, storage?: StorageLike | null): void {
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Pure 3D spatial layout calculator for the museum corridor.
 * Dynamically scales corridor depth to accommodate any number of memories.
 */
export function computeCorridorLayout(memoryCount: number): CorridorLayout {
  const count = Math.max(1, memoryCount);
  const corridorWidth = 7.2;
  const corridorHeight = 4.8;
  const spacing = 5.4;
  const startZ = 2.0;
  const pairRows = Math.ceil(count / 2);
  const lastFrameZ = startZ - (pairRows - 1) * spacing;
  const alcoveZ = lastFrameZ - 6.5;
  const maxZ = 9.5;
  const minZ = alcoveZ - 3.5;
  const corridorLength = maxZ - minZ;
  const centerZ = (maxZ + minZ) / 2;

  const wallInset = 0.08;
  const viewDistance = 2.65;

  const frames: FramePlacement[] = [];
  for (let i = 0; i < count; i += 1) {
    const side: -1 | 1 = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    const zPos = startZ - row * spacing;
    const xPos = side * (corridorWidth / 2 - wallInset);
    const rotationY = side === -1 ? Math.PI / 2 : -Math.PI / 2;
    const inwardNormalX = side === -1 ? 1 : -1;

    frames.push({
      index: i,
      side,
      position: [xPos, 2.05, zPos],
      rotationY,
      viewCameraPosition: [xPos + inwardNormalX * viewDistance, 1.85, zPos],
      viewTargetPosition: [xPos, 2.0, zPos],
    });
  }

  return {
    corridorWidth,
    corridorHeight,
    corridorLength,
    minZ,
    maxZ,
    centerZ,
    alcoveZ,
    frames,
  };
}

export function shortestAngleDelta(current: number, target: number): number {
  let diff = (target - current + Math.PI) % (Math.PI * 2);
  if (diff < 0) diff += Math.PI * 2;
  return diff - Math.PI;
}

/**
 * Computes Three.js YXZ Euler yaw (rotation.y) and clamped pitch (rotation.x)
 * so a first-person camera at `from` looks directly at `target`.
 */
export function computeLookAngles(
  from: [number, number, number],
  target: [number, number, number],
  maxPitch = Math.PI * 0.36
): { yaw: number; pitch: number } {
  const dx = target[0] - from[0];
  const dy = target[1] - from[1];
  const dz = target[2] - from[2];
  const horizDist = Math.hypot(dx, dz);

  // In Three.js camera looks down -Z when yaw = 0
  const yaw = Math.atan2(-dx, -dz);
  const rawPitch = horizDist > 1e-5 ? Math.atan2(dy, horizDist) : 0;
  const pitch = Math.max(-maxPitch, Math.min(maxPitch, rawPitch));

  return { yaw, pitch };
}

export interface TouchEnvironmentSignals {
  maxTouchPoints: number;
  hasOnTouchStart: boolean;
  coarsePointer: boolean;
  anyCoarsePointer: boolean;
  userAgent: string;
  viewportWidth: number;
}

const MOBILE_UA_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

/**
 * Determines whether the current environment is a mobile/tablet touch device
 * that should display on-screen FPS touch controls.
 */
export function detectMobileTouchDevice(signals: TouchEnvironmentSignals): boolean {
  if (MOBILE_UA_REGEX.test(signals.userAgent)) {
    return true;
  }
  if (signals.coarsePointer) {
    return true;
  }
  const hasTouch = signals.maxTouchPoints > 0 || signals.hasOnTouchStart;
  if (hasTouch && (signals.anyCoarsePointer || signals.viewportWidth <= 1024)) {
    return true;
  }
  return false;
}


