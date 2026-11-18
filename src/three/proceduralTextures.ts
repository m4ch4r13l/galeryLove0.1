import * as THREE from 'three';

export interface FloorTextureSet {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

export function createMarbleFloorTextures(maxAnisotropy: number): FloorTextureSet {
  const size = 512;

  // Color / Albedo canvas
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d');

  // Roughness canvas (linear data)
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d');

  if (ctx && rCtx) {
    // Deep nocturnal indigo-slate marble base
    ctx.fillStyle = '#121022';
    ctx.fillRect(0, 0, size, size);

    rCtx.fillStyle = 'rgb(42, 42, 42)';
    rCtx.fillRect(0, 0, size, size);

    // Subtle tile grid (2x2 slabs per repeat)
    const step = size / 2;
    ctx.strokeStyle = 'rgba(212, 175, 110, 0.14)';
    ctx.lineWidth = 2;
    rCtx.strokeStyle = 'rgb(160, 160, 160)';
    rCtx.lineWidth = 3;

    for (let i = 0; i <= 2; i += 1) {
      const pos = i * step;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
      ctx.stroke();

      rCtx.beginPath();
      rCtx.moveTo(pos, 0);
      rCtx.lineTo(pos, size);
      rCtx.stroke();

      rCtx.beginPath();
      rCtx.moveTo(0, pos);
      rCtx.lineTo(size, pos);
      rCtx.stroke();
    }

    // Organic marble veining
    for (let v = 0; v < 18; v += 1) {
      const startX = ((v * 97) % size);
      const startY = ((v * 53) % size);
      ctx.strokeStyle =
        v % 3 === 0 ? 'rgba(218, 180, 145, 0.08)' : 'rgba(130, 120, 175, 0.07)';
      ctx.lineWidth = 1 + (v % 2);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(
        (startX + 120) % size,
        (startY + 45) % size,
        (startX + 210) % size,
        (startY + 180) % size,
        (startX + 320) % size,
        (startY + 110) % size
      );
      ctx.stroke();

      rCtx.strokeStyle = 'rgb(75, 75, 75)';
      rCtx.lineWidth = 1.5;
      rCtx.beginPath();
      rCtx.moveTo(startX, startY);
      rCtx.lineTo((startX + 260) % size, (startY + 95) % size);
      rCtx.stroke();
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 14);
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(3, 14);
  roughnessMap.anisotropy = maxAnisotropy;

  return { map, roughnessMap };
}

export function createWallPlasterTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, '#16132b');
    grad.addColorStop(0.68, '#1b1633');
    grad.addColorStop(1, '#0f0d1e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Fine plaster stipple
    for (let i = 0; i < 650; i += 1) {
      const x = (i * 73) % size;
      const y = (i * 139) % size;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.03)';
      ctx.fillRect(x, y, 2, 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 1);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createRunnerCarpetTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Deep plum-velvet runner
    ctx.fillStyle = '#251433';
    ctx.fillRect(0, 0, w, h);

    // Gold woven border trim
    ctx.fillStyle = '#b99352';
    ctx.fillRect(10, 0, 5, h);
    ctx.fillRect(w - 15, 0, 5, h);

    // Subtle herringbone weave
    ctx.strokeStyle = 'rgba(255, 225, 235, 0.035)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 16) {
      ctx.beginPath();
      ctx.moveTo(22, y);
      ctx.lineTo(w / 2, y + 10);
      ctx.lineTo(w - 22, y);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 10);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createFallbackArtworkTexture(
  title: string,
  date: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const w = 512;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#2a163d');
    grad.addColorStop(0.55, '#19132e');
    grad.addColorStop(1, '#3b1d36');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Soft warm glow orb
    const rad = ctx.createRadialGradient(w * 0.5, h * 0.42, 10, w * 0.5, h * 0.42, 180);
    rad.addColorStop(0, 'rgba(244, 162, 184, 0.25)');
    rad.addColorStop(1, 'rgba(244, 162, 184, 0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, w, h);

    // Inner hairline border
    ctx.strokeStyle = 'rgba(222, 184, 135, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, w - 48, h - 48);

    // Title & date
    ctx.fillStyle = '#f8eae2';
    ctx.font = '600 26px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(title.slice(0, 32), w / 2, h / 2 - 4);

    ctx.fillStyle = '#e5a4ba';
    ctx.font = '400 16px sans-serif';
    ctx.fillText(date.slice(0, 32), w / 2, h / 2 + 30);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createSoftParticleTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, 'rgba(255, 240, 245, 1)');
    grad.addColorStop(0.35, 'rgba(255, 210, 225, 0.75)');
    grad.addColorStop(1, 'rgba(255, 210, 225, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

