import { ELEMENTS } from './data.js';
import { clamp } from './core.js';

export const TAU = Math.PI * 2;

export function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function ellipseShadow(ctx, x, y, rx, ry, alpha = 0.25) {
  ctx.save();
  ctx.fillStyle = `rgba(4, 10, 14, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function gradient(ctx, x1, y1, x2, y2, a, b) {
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
}

function radial(ctx, x, y, r, a, b) {
  const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.05, x, y, r);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
}

export function drawHero(ctx, x, y, scale = 1, facing = 1, t = 0, options = {}) {
  const bob = Math.sin(t * 4.2) * 1.5 * scale;
  const moving = options.moving ? Math.sin(t * 11) * 2.4 : 0;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(scale * facing, scale);
  ellipseShadow(ctx, 0, 25, 21, 7, 0.32);

  // Cape
  ctx.fillStyle = gradient(ctx, -13, -8, -2, 26, '#28526a', '#152d43');
  ctx.beginPath();
  ctx.moveTo(-11, -9);
  ctx.quadraticCurveTo(-22, 8, -15, 28);
  ctx.quadraticCurveTo(-2, 25, 2, 8);
  ctx.closePath();
  ctx.fill();

  // Legs
  ctx.strokeStyle = '#17243b';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-5, 17);
  ctx.lineTo(-7 + moving, 28);
  ctx.moveTo(5, 17);
  ctx.lineTo(7 - moving, 28);
  ctx.stroke();

  // Body
  ctx.fillStyle = gradient(ctx, 0, -11, 0, 20, '#4389da', '#2254a6');
  roundedRect(ctx, -13, -12, 26, 34, 8);
  ctx.fill();
  ctx.fillStyle = '#d6af52';
  ctx.fillRect(-13, 7, 26, 4);
  ctx.fillStyle = '#f4d56c';
  ctx.fillRect(-2, 6, 4, 7);

  // Arm and weapon
  ctx.strokeStyle = '#e8ba91';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(10, -4);
  ctx.lineTo(18, 7);
  ctx.stroke();
  ctx.strokeStyle = '#d6a84f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(17, 8);
  ctx.lineTo(31, -8);
  ctx.stroke();
  ctx.strokeStyle = '#eef4f4';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(29, -7);
  ctx.lineTo(38, -18);
  ctx.stroke();

  // Head
  ctx.fillStyle = radial(ctx, 0, -25, 14, '#ffd7af', '#d99367');
  ctx.beginPath();
  ctx.arc(0, -23, 13, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#6a3e2b';
  ctx.beginPath();
  ctx.arc(0, -29, 13, Math.PI, TAU);
  ctx.quadraticCurveTo(7, -25, 13, -21);
  ctx.lineTo(12, -30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1c2434';
  ctx.beginPath();
  ctx.arc(5, -22, 1.5, 0, TAU);
  ctx.fill();

  ctx.restore();
}

export function drawCompanion(ctx, id, x, y, scale = 1, t = 0, options = {}) {
  const bob = Math.sin(t * 4.8 + id.length) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(scale, scale);
  ellipseShadow(ctx, 0, 19, 20, 6, 0.3);
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
  const colors = {
    pyron: ['rgba(255,140,68,.42)', 'rgba(255,90,35,0)'],
    neria: ['rgba(72,179,255,.42)', 'rgba(35,130,255,0)'],
    sylph: ['rgba(134,239,217,.42)', 'rgba(80,190,175,0)'],
    grom: ['rgba(213,169,89,.38)', 'rgba(150,105,52,0)']
  };
  glow.addColorStop(0, colors[id]?.[0] || 'rgba(255,255,255,.3)');
  glow.addColorStop(1, colors[id]?.[1] || 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, -2, 34, 0, TAU);
  ctx.fill();

  if (id === 'pyron') drawPyron(ctx, t);
  else if (id === 'neria') drawNeria(ctx, t);
  else if (id === 'sylph') drawSylph(ctx, t);
  else drawGrom(ctx, t);
  ctx.restore();
}

function drawPyron(ctx, t) {
  ctx.fillStyle = '#ffbc4f';
  ctx.beginPath();
  ctx.moveTo(-13, -8); ctx.lineTo(-24, -17); ctx.lineTo(-19, -1); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(13, -8); ctx.lineTo(24, -17); ctx.lineTo(19, -1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = radial(ctx, 0, -2, 22, '#ffd35e', '#f05d32');
  ctx.beginPath(); ctx.ellipse(0, 0, 21, 20, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ff8e3f';
  ctx.beginPath(); ctx.moveTo(-8, 16); ctx.lineTo(-2, 25); ctx.lineTo(4, 16); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff4cf';
  ctx.beginPath(); ctx.arc(-7, -5, 4.6, 0, TAU); ctx.arc(7, -5, 4.6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#242238';
  ctx.beginPath(); ctx.arc(-6, -4, 2, 0, TAU); ctx.arc(6, -4, 2, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#843927'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 4, 7, 0.15, Math.PI - 0.15); ctx.stroke();
  const flame = 3 + Math.sin(t * 8) * 2;
  ctx.fillStyle = '#ffe66a'; ctx.beginPath(); ctx.moveTo(0, -20); ctx.quadraticCurveTo(-6, -28 - flame, 0, -35); ctx.quadraticCurveTo(8, -27, 0, -20); ctx.fill();
}

function drawNeria(ctx, t) {
  ctx.fillStyle = 'rgba(92,198,255,.36)';
  ctx.beginPath(); ctx.arc(0, 0, 27, 0, TAU); ctx.fill();
  ctx.fillStyle = radial(ctx, 0, -2, 21, '#9de4ff', '#368ad8');
  ctx.beginPath(); ctx.moveTo(0, -24); ctx.bezierCurveTo(22, -8, 20, 12, 0, 20); ctx.bezierCurveTo(-20, 12, -22, -8, 0, -24); ctx.fill();
  ctx.fillStyle = '#eafaff';
  ctx.beginPath(); ctx.arc(-7, -4, 4.6, 0, TAU); ctx.arc(7, -4, 4.6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#163556';
  ctx.beginPath(); ctx.arc(-6, -3, 2, 0, TAU); ctx.arc(6, -3, 2, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#1f5a8c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 5, 7, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.fillStyle = 'rgba(160,232,255,.8)';
  const wave = Math.sin(t * 6) * 2;
  ctx.beginPath(); ctx.ellipse(-14, 16 + wave, 5, 9, -0.4, 0, TAU); ctx.ellipse(14, 16 - wave, 5, 9, 0.4, 0, TAU); ctx.fill();
}

function drawSylph(ctx, t) {
  ctx.strokeStyle = 'rgba(185,255,237,.68)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  const flap = Math.sin(t * 9) * 5;
  ctx.beginPath(); ctx.moveTo(-10, -2); ctx.quadraticCurveTo(-28, -20 - flap, -31, 4); ctx.moveTo(10, -2); ctx.quadraticCurveTo(28, -20 + flap, 31, 4); ctx.stroke();
  ctx.fillStyle = radial(ctx, 0, -2, 20, '#d8fff1', '#54c4ad');
  ctx.beginPath(); ctx.ellipse(0, 0, 18, 20, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3ba98f';
  ctx.beginPath(); ctx.moveTo(-11, -13); ctx.lineTo(-16, -27); ctx.lineTo(-3, -18); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(11, -13); ctx.lineTo(16, -27); ctx.lineTo(3, -18); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-6, -4, 4, 0, TAU); ctx.arc(6, -4, 4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#163c3a'; ctx.beginPath(); ctx.arc(-5, -3, 1.8, 0, TAU); ctx.arc(5, -3, 1.8, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#26715f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 5, 6, 0.2, Math.PI - 0.2); ctx.stroke();
}

function drawGrom(ctx, t) {
  ctx.fillStyle = '#70553d';
  ctx.beginPath(); ctx.moveTo(-15, -14); ctx.lineTo(-24, -22); ctx.lineTo(-20, -7); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(15, -14); ctx.lineTo(24, -22); ctx.lineTo(20, -7); ctx.closePath(); ctx.fill();
  ctx.fillStyle = radial(ctx, 0, -2, 23, '#deb96d', '#766044');
  ctx.beginPath();
  ctx.moveTo(-16, -17); ctx.lineTo(7, -22); ctx.lineTo(20, -8); ctx.lineTo(18, 14); ctx.lineTo(4, 23); ctx.lineTo(-17, 17); ctx.lineTo(-22, -4); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#59442f'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-12, -14); ctx.lineTo(-5, -3); ctx.lineTo(-12, 8); ctx.moveTo(9, -17); ctx.lineTo(4, -5); ctx.lineTo(13, 8); ctx.stroke();
  ctx.fillStyle = '#f8efd2'; ctx.beginPath(); ctx.arc(-7, -5, 4.5, 0, TAU); ctx.arc(7, -5, 4.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#27251f'; ctx.beginPath(); ctx.arc(-6, -4, 2, 0, TAU); ctx.arc(6, -4, 2, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#4c3928'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-5, 8); ctx.quadraticCurveTo(0, 11, 6, 7); ctx.stroke();
}

export function drawEnemy(ctx, id, x, y, scale = 1, t = 0, options = {}) {
  const bob = Math.sin(t * 3.8 + id.length * 0.7) * 2.2;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(scale, scale);
  ellipseShadow(ctx, 0, 23, options.boss ? 32 : 23, options.boss ? 9 : 7, 0.32);

  if (id.includes('slime')) drawSlime(ctx, '#63d780', '#d7ff9c');
  else if (id === 'moss_boar') drawBoar(ctx);
  else if (id === 'ember_imp') drawImp(ctx);
  else if (id === 'cinder_golem') drawGolem(ctx, '#8d5142', '#ff8c45');
  else if (id === 'tide_wisp') drawWisp(ctx, '#4eb5f0');
  else if (id === 'reef_guardian') drawCrab(ctx);
  else if (id === 'wind_raptor') drawBird(ctx, '#8ad7c3');
  else if (id === 'storm_harpy') drawHarpy(ctx);
  else if (id === 'stonebeast') drawStoneBeast(ctx);
  else if (id === 'crystal_turtle') drawTurtle(ctx);
  else if (id === 'neutral_sentinel') drawSentinel(ctx, false, t);
  else if (id === 'ruin_keeper') drawSentinel(ctx, true, t);
  else drawSlime(ctx, '#b9b9c8', '#fff');
  ctx.restore();
}

function drawSlime(ctx, base, shine) {
  ctx.fillStyle = radial(ctx, -2, -5, 27, shine, base);
  ctx.beginPath();
  ctx.moveTo(-23, 16); ctx.quadraticCurveTo(-26, -11, -10, -22); ctx.quadraticCurveTo(0, -31, 13, -20); ctx.quadraticCurveTo(27, -7, 22, 17); ctx.quadraticCurveTo(0, 25, -23, 16); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(-9, -13, 5, 8, -0.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#17251d'; ctx.beginPath(); ctx.arc(-7, -2, 3, 0, TAU); ctx.arc(8, -2, 3, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#28563a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(1, 7, 7, 0.2, Math.PI - 0.2); ctx.stroke();
}

function drawBoar(ctx) {
  ctx.fillStyle = radial(ctx, 0, 0, 27, '#9b7a54', '#4f3c2b');
  ctx.beginPath(); ctx.ellipse(0, 1, 27, 20, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3e5f38'; ctx.beginPath(); ctx.arc(-8, -17, 10, 0, TAU); ctx.arc(9, -18, 12, 0, TAU); ctx.fill();
  ctx.fillStyle = '#b48a61'; ctx.beginPath(); ctx.ellipse(17, 4, 14, 12, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#1b211b'; ctx.beginPath(); ctx.arc(19, 1, 2.4, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#f4e5bd'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(20, 8); ctx.lineTo(29, 14); ctx.moveTo(14, 9); ctx.lineTo(19, 17); ctx.stroke();
}

function drawImp(ctx) {
  ctx.fillStyle = '#7c272b'; ctx.beginPath(); ctx.moveTo(-14, -13); ctx.lineTo(-24, -31); ctx.lineTo(-5, -20); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(14, -13); ctx.lineTo(24, -31); ctx.lineTo(5, -20); ctx.closePath(); ctx.fill();
  ctx.fillStyle = radial(ctx, 0, -1, 23, '#ef704d', '#8d2a30'); ctx.beginPath(); ctx.ellipse(0, 0, 21, 22, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffe46d'; ctx.beginPath(); ctx.arc(-7, -5, 4, 0, TAU); ctx.arc(7, -5, 4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#402023'; ctx.beginPath(); ctx.arc(-6, -4, 1.8, 0, TAU); ctx.arc(6, -4, 1.8, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#562026'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-7, 8); ctx.quadraticCurveTo(0, 13, 8, 7); ctx.stroke();
}

function drawGolem(ctx, base, glowColor) {
  ctx.fillStyle = base;
  roundedRect(ctx, -22, -25, 44, 47, 10); ctx.fill();
  ctx.fillStyle = '#5f3d34'; ctx.beginPath(); ctx.arc(-20, -6, 10, 0, TAU); ctx.arc(20, -6, 10, 0, TAU); ctx.fill();
  ctx.strokeStyle = glowColor; ctx.lineWidth = 3; ctx.shadowColor = glowColor; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.moveTo(-13, -18); ctx.lineTo(-5, -5); ctx.lineTo(-12, 9); ctx.moveTo(12, -19); ctx.lineTo(5, -6); ctx.lineTo(13, 11); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = glowColor; ctx.beginPath(); ctx.arc(-7, -7, 3, 0, TAU); ctx.arc(7, -7, 3, 0, TAU); ctx.fill();
}

function drawWisp(ctx, color) {
  ctx.fillStyle = radial(ctx, 0, -3, 23, '#e6fbff', color); ctx.beginPath(); ctx.arc(0, -3, 19, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(170,233,255,.65)'; ctx.beginPath(); ctx.moveTo(-15, 11); ctx.quadraticCurveTo(-9, 29, -2, 15); ctx.quadraticCurveTo(4, 32, 8, 13); ctx.quadraticCurveTo(15, 26, 17, 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#174b70'; ctx.beginPath(); ctx.arc(-6, -5, 2.5, 0, TAU); ctx.arc(6, -5, 2.5, 0, TAU); ctx.fill();
}

function drawCrab(ctx) {
  ctx.strokeStyle = '#d96d58'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-17, 2); ctx.lineTo(-31, -8); ctx.lineTo(-36, -20); ctx.moveTo(17, 2); ctx.lineTo(31, -8); ctx.lineTo(36, -20); ctx.stroke();
  ctx.fillStyle = radial(ctx, 0, 0, 27, '#ffab78', '#a94849'); ctx.beginPath(); ctx.ellipse(0, 2, 25, 18, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-8, -8, 5, 0, TAU); ctx.arc(8, -8, 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#252334'; ctx.beginPath(); ctx.arc(-7, -7, 2, 0, TAU); ctx.arc(7, -7, 2, 0, TAU); ctx.fill();
}

function drawBird(ctx, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, -5); ctx.quadraticCurveTo(-22, -28, -35, -6); ctx.quadraticCurveTo(-18, -10, -7, 8); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, -5); ctx.quadraticCurveTo(22, -28, 35, -6); ctx.quadraticCurveTo(18, -10, 7, 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = radial(ctx, 0, 1, 19, '#e0fff7', '#4d988c'); ctx.beginPath(); ctx.ellipse(0, 2, 16, 21, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f1ca55'; ctx.beginPath(); ctx.moveTo(-4, -8); ctx.lineTo(0, -17); ctx.lineTo(5, -8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1c3435'; ctx.beginPath(); ctx.arc(-5, -3, 2, 0, TAU); ctx.arc(5, -3, 2, 0, TAU); ctx.fill();
}

function drawHarpy(ctx) { drawBird(ctx, '#6fb4a9'); ctx.fillStyle = '#59628d'; ctx.beginPath(); ctx.arc(0, -10, 12, Math.PI, TAU); ctx.fill(); }
function drawStoneBeast(ctx) { drawBoar(ctx); ctx.strokeStyle = '#b9a477'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-14, -12); ctx.lineTo(-20, -30); ctx.moveTo(9, -14); ctx.lineTo(17, -32); ctx.stroke(); }
function drawTurtle(ctx) { ctx.fillStyle = radial(ctx, 0, -2, 28, '#b5ecbd', '#4f7a66'); ctx.beginPath(); ctx.ellipse(0, -1, 28, 22, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#d5fff1'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-17, -14); ctx.lineTo(0, 12); ctx.lineTo(17, -14); ctx.moveTo(-26, 0); ctx.lineTo(26, 0); ctx.stroke(); ctx.fillStyle = '#6f9876'; ctx.beginPath(); ctx.arc(27, -1, 10, 0, TAU); ctx.fill(); ctx.fillStyle = '#1e3528'; ctx.beginPath(); ctx.arc(30, -4, 2, 0, TAU); ctx.fill(); }

function drawSentinel(ctx, boss, t) {
  const size = boss ? 1.35 : 1;
  ctx.scale(size, size);
  ctx.fillStyle = gradient(ctx, 0, -28, 0, 25, '#85879d', '#3b3c50');
  roundedRect(ctx, -20, -26, 40, 50, 9); ctx.fill();
  ctx.strokeStyle = '#b6a7ff'; ctx.lineWidth = 2.5; ctx.shadowColor = '#ab93ff'; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.moveTo(-14, -15); ctx.lineTo(0, -2); ctx.lineTo(14, -15); ctx.moveTo(0, -2); ctx.lineTo(0, 17); ctx.stroke();
  ctx.fillStyle = '#e8e0ff'; ctx.beginPath(); ctx.ellipse(0, -8, 10, 6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#7c55ff'; ctx.beginPath(); ctx.arc(Math.sin(t * 2) * 4, -8, 3.5, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;
  if (boss) {
    ctx.strokeStyle = 'rgba(197,173,255,.55)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 30 + Math.sin(t * 3) * 2, 0, TAU); ctx.stroke();
  }
}

export function drawTree(ctx, x, y, scale = 1, variant = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ellipseShadow(ctx, 0, 18, 22, 7, 0.22);
  ctx.fillStyle = '#6e4931'; roundedRect(ctx, -5, -5, 10, 28, 3); ctx.fill();
  const palettes = [['#4f9b54', '#85c766'], ['#3f8651', '#73b867'], ['#7c8c50', '#b1b765']];
  const p = palettes[variant % palettes.length];
  ctx.fillStyle = radial(ctx, -5, -25, 24, p[1], p[0]);
  ctx.beginPath(); ctx.arc(-10, -22, 18, 0, TAU); ctx.arc(10, -24, 20, 0, TAU); ctx.arc(0, -40, 19, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawRock(ctx, x, y, scale = 1, color = '#8a877a') {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ellipseShadow(ctx, 0, 10, 15, 5, 0.2);
  ctx.fillStyle = gradient(ctx, -10, -15, 10, 15, '#b9b4a2', color); ctx.beginPath(); ctx.moveTo(-16, 7); ctx.lineTo(-11, -10); ctx.lineTo(2, -17); ctx.lineTo(16, -6); ctx.lineTo(13, 10); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-9, -7); ctx.lineTo(1, -12); ctx.stroke(); ctx.restore();
}

export function drawFlower(ctx, x, y, color = '#fff2a0', scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.strokeStyle = '#3d7c45'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -2); ctx.stroke(); ctx.fillStyle = color; for (let i = 0; i < 5; i++) { const a = i * TAU / 5; ctx.beginPath(); ctx.arc(Math.cos(a) * 4, Math.sin(a) * 4 - 3, 3, 0, TAU); ctx.fill(); } ctx.fillStyle = '#e0a843'; ctx.beginPath(); ctx.arc(0, -3, 2.5, 0, TAU); ctx.fill(); ctx.restore();
}

export function drawBuilding(ctx, x, y, w, h, kind = 'house') {
  ctx.save(); ctx.translate(x, y); ellipseShadow(ctx, 0, h * 0.48, w * 0.46, 10, 0.25);
  ctx.fillStyle = kind === 'shop' ? '#e0c486' : kind === 'class' ? '#b9b0ca' : '#d8c6a0'; roundedRect(ctx, -w / 2, -h / 2, w, h, 12); ctx.fill();
  ctx.fillStyle = kind === 'heal' ? '#65a899' : kind === 'forge' ? '#7d4c43' : '#6f4c43';
  ctx.beginPath(); ctx.moveTo(-w * 0.58, -h / 2 + 5); ctx.lineTo(0, -h * 0.92); ctx.lineTo(w * 0.58, -h / 2 + 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#594332'; roundedRect(ctx, -13, h * 0.08, 26, h * 0.42, 5); ctx.fill();
  ctx.fillStyle = '#8bd3e0'; roundedRect(ctx, -w * 0.35, -h * 0.25, 20, 18, 3); ctx.fill(); roundedRect(ctx, w * 0.35 - 20, -h * 0.25, 20, 18, 3); ctx.fill();
  ctx.fillStyle = '#f5d67a'; ctx.beginPath(); ctx.arc(7, h * 0.28, 2.5, 0, TAU); ctx.fill(); ctx.restore();
}

export function drawNpc(ctx, npc, x, y, scale = 1, t = 0) {
  const colors = { guide: '#dfb34d', shop: '#b66f4e', class: '#8171b9', summon: '#5a9fae', forge: '#8d5145', heal: '#69ad8f' };
  ctx.save(); ctx.translate(x, y + Math.sin(t * 3 + npc.id.length) * 1.2); ctx.scale(scale, scale); ellipseShadow(ctx, 0, 24, 18, 6, 0.25);
  ctx.fillStyle = colors[npc.kind] || '#7290a8'; roundedRect(ctx, -13, -8, 26, 33, 7); ctx.fill();
  ctx.fillStyle = radial(ctx, 0, -21, 13, '#ffd7b0', '#d99870'); ctx.beginPath(); ctx.arc(0, -20, 12, 0, TAU); ctx.fill();
  ctx.fillStyle = '#4d3b34'; ctx.beginPath(); ctx.arc(0, -25, 12, Math.PI, TAU); ctx.fill();
  ctx.fillStyle = '#202537'; ctx.beginPath(); ctx.arc(-4, -19, 1.5, 0, TAU); ctx.arc(4, -19, 1.5, 0, TAU); ctx.fill();
  ctx.font = '18px system-ui'; ctx.textAlign = 'center'; ctx.fillText(npc.icon, 0, 10); ctx.restore();
}

export function drawElementAura(ctx, x, y, element, radius, t = 0) {
  const color = ELEMENTS[element]?.color || '#ddd';
  ctx.save(); ctx.globalAlpha = 0.24 + Math.sin(t * 4) * 0.05; ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.beginPath(); ctx.ellipse(x, y, radius + Math.sin(t * 3) * 2, radius * 0.32, 0, 0, TAU); ctx.stroke(); ctx.restore();
}

export function drawWorldLabel(ctx, text, x, y, options = {}) {
  const size = options.size || 20;
  ctx.save(); ctx.font = `800 ${size}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(6,13,18,.72)'; ctx.strokeText(text, x, y); ctx.fillStyle = options.color || '#f8f4e8'; ctx.fillText(text, x, y); ctx.restore();
}

export function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width; canvas.height = height;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  return { ctx, width: rect.width, height: rect.height, dpr };
}
