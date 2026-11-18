import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_GALLERY_DATA,
  STORAGE_KEY,
  calculateRelationshipDuration,
  computeCorridorLayout,
  computeDragLookDelta,
  computeLookAngles,
  decodeShareData,
  detectMobileTouchDevice,
  encodeShareData,
  getDragLookSensitivity,
  isValidImageSource,
  loadGalleryData,
  parseLocalDate,
  requestImmersiveMode,
  resolveGalleryImageUrl,
  saveGalleryData,
  shortestAngleDelta,
  shouldSkipWelcomeScreen,
  validateGalleryData,
  type StorageLike,
} from './galleryLogic';

test('parseLocalDate parses YYYY-MM-DD without timezone drift', () => {
  const date = parseLocalDate('2022-10-14');
  assert.ok(date);
  assert.equal(date.getFullYear(), 2022);
  assert.equal(date.getMonth(), 9);
  assert.equal(date.getDate(), 14);
  assert.equal(parseLocalDate('2022-02-30'), null);
  assert.equal(parseLocalDate('not-a-date'), null);
});

test('calculateRelationshipDuration computes days, hours, minutes accurately', () => {
  const now = new Date(2025, 9, 14, 5, 30, 0, 0); // Oct 14, 2025 05:30
  const result = calculateRelationshipDuration('2025-10-12', now);
  assert.equal(result.isValid, true);
  assert.equal(result.isFuture, false);
  assert.equal(result.days, 2);
  assert.equal(result.hours, 5);
  assert.equal(result.minutes, 30);

  const future = calculateRelationshipDuration('2030-01-01', now);
  assert.equal(future.isFuture, true);
  assert.equal(future.formatted, 'Pronto comenzará');
});

test('encodeShareData and decodeShareData preserve UTF-8 Spanish accents', () => {
  const sample = {
    ...DEFAULT_GALLERY_DATA,
    names: 'Mateo & Lucía 💖',
  };
  const encoded = encodeShareData(sample);
  const decoded = decodeShareData(encoded);
  assert.ok(decoded);
  assert.equal(decoded.names, 'Mateo & Lucía 💖');
  assert.equal(decoded.memories.length, DEFAULT_GALLERY_DATA.memories.length);
  assert.equal(decodeShareData('!!!invalid-base64!!!'), null);
});

test('loadGalleryData prioritizes URL ?data=, then storage, then defaults', () => {
  const store = new Map<string, string>();
  const mockStorage: StorageLike = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, v);
    },
  };

  // Default fallback
  const fallback = loadGalleryData('', mockStorage);
  assert.equal(fallback.names, DEFAULT_GALLERY_DATA.names);

  // Storage persistence
  const custom = { ...DEFAULT_GALLERY_DATA, names: 'Elena & Marco' };
  saveGalleryData(custom, mockStorage);
  assert.ok(store.has(STORAGE_KEY));
  const fromStorage = loadGalleryData('', mockStorage);
  assert.equal(fromStorage.names, 'Elena & Marco');

  // URL share param overrides storage
  const shared = { ...DEFAULT_GALLERY_DATA, names: 'Camila & Leo' };
  const fromUrl = loadGalleryData(`?data=${encodeShareData(shared)}`, mockStorage);
  assert.equal(fromUrl.names, 'Camila & Leo');
});

test('validateGalleryData catches empty fields and invalid image URLs', () => {
  const valid = validateGalleryData(DEFAULT_GALLERY_DATA);
  assert.equal(valid.valid, true);

  const broken = {
    names: '   ',
    startDate: 'invalid',
    memories: [
      {
        id: '1',
        title: '',
        date: '',
        img: 'ftp://bad-host/img.jpg',
        desc: '',
      },
    ],
  };
  const res = validateGalleryData(broken);
  assert.equal(res.valid, false);
  assert.ok(res.errors.names);
  assert.ok(res.errors.startDate);
  assert.ok(res.errors['mem-0-title']);
  assert.ok(res.errors['mem-0-img']);
});

test('computeCorridorLayout alternates left/right walls and faces inward', () => {
  const layout = computeCorridorLayout(8);
  assert.equal(layout.frames.length, 8);
  assert.equal(layout.frames[0].side, -1);
  assert.equal(layout.frames[1].side, 1);
  // Left wall frames have camera positioned inside corridor (+X relative to wall)
  assert.ok(layout.frames[0].viewCameraPosition[0] > layout.frames[0].position[0]);
  // Right wall frames have camera positioned inside corridor (-X relative to wall)
  assert.ok(layout.frames[1].viewCameraPosition[0] < layout.frames[1].position[0]);
  // Alcove sits beyond the last frame
  const lastFrameZ = layout.frames[7].position[2];
  assert.ok(layout.alcoveZ < lastFrameZ);
  assert.ok(layout.minZ < layout.alcoveZ);
});

test('computeLookAngles aligns yaw toward left/right/forward targets and clamps pitch', () => {
  // Looking straight down -Z
  const forward = computeLookAngles([0, 1.75, 5], [0, 1.75, 0]);
  assert.ok(Math.abs(forward.yaw) < 1e-6);
  assert.ok(Math.abs(forward.pitch) < 1e-6);

  // Looking at left wall (-X) => yaw = +PI/2
  const left = computeLookAngles([0, 1.75, 2], [-3.5, 1.75, 2]);
  assert.ok(Math.abs(left.yaw - Math.PI / 2) < 1e-6);

  // Looking at right wall (+X) => yaw = -PI/2
  const right = computeLookAngles([0, 1.75, 2], [3.5, 1.75, 2]);
  assert.ok(Math.abs(right.yaw + Math.PI / 2) < 1e-6);

  // Pitch clamped safely
  const straightUp = computeLookAngles([0, 0, 0], [0, 100, -0.1], 1.1);
  assert.ok(straightUp.pitch <= 1.1 + 1e-6);
});

test('shortestAngleDelta wraps across -PI/PI boundary cleanly', () => {
  const delta = shortestAngleDelta(Math.PI - 0.1, -Math.PI + 0.1);
  assert.ok(Math.abs(delta - 0.2) < 1e-6);
});

test('detectMobileTouchDevice identifies phones/tablets and excludes desktop mouse', () => {
  // Desktop with mouse & large viewport
  assert.equal(
    detectMobileTouchDevice({
      maxTouchPoints: 0,
      hasOnTouchStart: false,
      coarsePointer: false,
      anyCoarsePointer: false,
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      viewportWidth: 1440,
    }),
    false
  );

  // Narrow desktop window without touch should NOT trigger mobile touch pad
  assert.equal(
    detectMobileTouchDevice({
      maxTouchPoints: 0,
      hasOnTouchStart: false,
      coarsePointer: false,
      anyCoarsePointer: false,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      viewportWidth: 390,
    }),
    false
  );

  // Mobile phone (coarse pointer + touch)
  assert.equal(
    detectMobileTouchDevice({
      maxTouchPoints: 5,
      hasOnTouchStart: true,
      coarsePointer: true,
      anyCoarsePointer: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      viewportWidth: 390,
    }),
    true
  );

  // Touch tablet in landscape (1024px wide)
  assert.equal(
    detectMobileTouchDevice({
      maxTouchPoints: 5,
      hasOnTouchStart: true,
      coarsePointer: false,
      anyCoarsePointer: true,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      viewportWidth: 1024,
    }),
    true
  );
});

test('resolveGalleryImageUrl normalizes local asset paths for GitHub Pages subpaths', () => {
  assert.equal(
    resolveGalleryImageUrl('./src/assets/images/photo.jpg', './'),
    './src/assets/images/photo.jpg'
  );
  // Legacy saved paths with leading slash normalize to relative under './'
  assert.equal(
    resolveGalleryImageUrl('/src/assets/images/photo.jpg', './'),
    './src/assets/images/photo.jpg'
  );
  // Explicit repository subpath base
  assert.equal(
    resolveGalleryImageUrl('/src/assets/images/photo.jpg', '/mi-galeria/'),
    '/mi-galeria/src/assets/images/photo.jpg'
  );
  // External and data URLs pass through unchanged
  assert.equal(
    resolveGalleryImageUrl('https://example.com/pic.jpg', '/mi-galeria/'),
    'https://example.com/pic.jpg'
  );
  assert.equal(
    resolveGalleryImageUrl('data:image/jpeg;base64,ABC', './'),
    'data:image/jpeg;base64,ABC'
  );
  assert.equal(isValidImageSource('./src/assets/images/photo.jpg'), true);
});

test('getDragLookSensitivity boosts sensitivity on touch/pen compared to mouse', () => {
  const touchSens = getDragLookSensitivity('touch');
  const penSens = getDragLookSensitivity('pen');
  const mouseSens = getDragLookSensitivity('mouse');
  assert.ok(touchSens > mouseSens * 2);
  assert.equal(touchSens, penSens);
});

test('computeDragLookDelta inverts horizontal camera yaw on mobile touch/pen', () => {
  // Swiping right (dx > 0) on touch produces negative yaw (camera turns right in Three.js)
  const touchRight = computeDragLookDelta(20, 0, 'touch');
  assert.ok(touchRight.yawDelta < 0);

  const penLeft = computeDragLookDelta(-20, 0, 'pen');
  assert.ok(penLeft.yawDelta > 0);

  // Desktop mouse keeps positive yaw on rightward drag
  const mouseRight = computeDragLookDelta(20, 0, 'mouse');
  assert.ok(mouseRight.yawDelta > 0);
});

test('shouldSkipWelcomeScreen checks autostart=1 query param', () => {
  assert.equal(shouldSkipWelcomeScreen('?autostart=1'), true);
  assert.equal(shouldSkipWelcomeScreen('?data=abc&autostart=1'), true);
  assert.equal(shouldSkipWelcomeScreen('?autostart=0'), false);
  assert.equal(shouldSkipWelcomeScreen(''), false);
});

test('requestImmersiveMode enters fullscreen before locking mobile orientation to landscape', async () => {
  const calls: string[] = [];
  const res = await requestImmersiveMode({
    isMobileTouch: true,
    element: {
      requestFullscreen: async () => {
        calls.push('fullscreen');
      },
    },
    screenOrientation: {
      lock: async (mode) => {
        calls.push(`orientation:${mode}`);
      },
    },
  });
  assert.deepEqual(calls, ['fullscreen', 'orientation:landscape']);
  assert.equal(res.fullscreenEntered, true);
  assert.equal(res.orientationLocked, true);

  // Desktop must NOT trigger fullscreen or orientation lock
  const desktopCalls: string[] = [];
  const desktopRes = await requestImmersiveMode({
    isMobileTouch: false,
    element: {
      requestFullscreen: async () => {
        desktopCalls.push('fullscreen');
      },
    },
    screenOrientation: {
      lock: async (mode) => {
        desktopCalls.push(`orientation:${mode}`);
      },
    },
  });
  assert.deepEqual(desktopCalls, []);
  assert.equal(desktopRes.fullscreenEntered, false);
  assert.equal(desktopRes.orientationLocked, false);

  // Handles browser rejection gracefully without throwing
  const fallbackRes = await requestImmersiveMode({
    isMobileTouch: true,
    element: {
      requestFullscreen: async () => {
        throw new Error('NotAllowedError');
      },
    },
    screenOrientation: {
      lock: async () => {
        throw new Error('NotSupportedError');
      },
    },
  });
  assert.equal(fallbackRes.fullscreenEntered, false);
  assert.equal(fallbackRes.orientationLocked, false);
});




