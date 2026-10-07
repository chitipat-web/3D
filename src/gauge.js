// Instrument cluster of the 2019 ZX-6R: analogue tachometer (white face,
// 0–16 x1000 rpm, red zone from 15,000) on the left, LCD on the right.
// The texture can be redrawn live with the current rpm and gear.
import * as THREE from 'three';

export function createGauge() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 300;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const state = { rpm: 0, gear: 'N', on: false, speed: 0 };
  const A0 = Math.PI * 0.72;
  const A1 = Math.PI * 2.08;
  const ang = (rpm) => A0 + (Math.min(rpm, 16000) / 16000) * (A1 - A0);

  function draw() {
    const W = c.width;
    const H = c.height;
    g.fillStyle = '#0b0c0e';
    g.fillRect(0, 0, W, H);
    // tachometer
    const cx = 168;
    const cy = 160;
    const R = 128;
    const face = g.createRadialGradient(cx - 30, cy - 40, 10, cx, cy, R);
    face.addColorStop(0, state.on ? '#ffffff' : '#c9ccd0');
    face.addColorStop(1, state.on ? '#dfe3e7' : '#a8acb1');
    g.fillStyle = face;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = '#2a2d31';
    g.stroke();
    // red zone
    g.strokeStyle = '#d7262b';
    g.lineWidth = 12;
    g.beginPath();
    g.arc(cx, cy, R - 14, ang(15000), ang(16000));
    g.stroke();
    for (let i = 0; i <= 32; i++) {
      const rpm = i * 500;
      const a = ang(rpm);
      const major = i % 2 === 0;
      g.strokeStyle = rpm >= 15000 ? '#b3161b' : '#16181b';
      g.lineWidth = major ? 4 : 2;
      const r0 = major ? R - 30 : R - 22;
      g.beginPath();
      g.moveTo(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a));
      g.lineTo(cx + (R - 8) * Math.cos(a), cy + (R - 8) * Math.sin(a));
      g.stroke();
      if (major) {
        g.fillStyle = rpm >= 15000 ? '#b3161b' : '#16181b';
        g.font = 'italic 700 22px Arial, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(String(i / 2), cx + (R - 48) * Math.cos(a), cy + (R - 48) * Math.sin(a));
      }
    }
    g.fillStyle = '#4b5057';
    g.font = '700 13px Arial, sans-serif';
    g.textAlign = 'center';
    g.fillText('x1000 r/min', cx, cy + 46);
    // needle
    const na = ang(state.rpm);
    g.strokeStyle = '#ff4d12';
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx - 18 * Math.cos(na), cy - 18 * Math.sin(na));
    g.lineTo(cx + (R - 20) * Math.cos(na), cy + (R - 20) * Math.sin(na));
    g.stroke();
    g.fillStyle = '#1b1d20';
    g.beginPath();
    g.arc(cx, cy, 14, 0, Math.PI * 2);
    g.fill();
    // warning lamps column
    const lamps = ['#2ecc71', '#f1c40f', '#3498db', '#e74c3c'];
    lamps.forEach((col, i) => {
      g.fillStyle = state.on ? col : '#2a2d31';
      g.beginPath();
      g.arc(330, 60 + i * 36, 8, 0, Math.PI * 2);
      g.fill();
    });
    // LCD
    const lx = 360;
    const ly = 40;
    const lw = 250;
    const lh = 220;
    g.fillStyle = state.on ? '#cfd8d3' : '#3a4140';
    g.fillRect(lx, ly, lw, lh);
    if (state.on) {
      g.fillStyle = '#121414';
      g.textAlign = 'left';
      g.font = '700 16px Arial, sans-serif';
      g.fillText('GEAR', lx + 14, ly + 26);
      g.font = '900 64px Arial, sans-serif';
      g.fillText(state.gear, lx + 18, ly + 92);
      g.textAlign = 'right';
      g.font = '900 78px Arial, sans-serif';
      g.fillText(String(Math.round(state.speed)), lx + lw - 16, ly + 100);
      g.font = '700 18px Arial, sans-serif';
      g.fillText('km/h', lx + lw - 16, ly + 128);
      // bar-graph strip of the current rpm
      const bars = 20;
      for (let i = 0; i < bars; i++) {
        const lit = state.rpm / 16000 > i / bars;
        g.fillStyle = lit ? (i >= 18 ? '#c0392b' : '#121414') : '#b7c0bb';
        g.fillRect(lx + 14 + i * 11.2, ly + 150, 8, 18 + i * 0.8);
      }
      g.textAlign = 'left';
      g.font = '700 15px Arial, sans-serif';
      g.fillText('ODO 000636 km', lx + 14, ly + 205);
      g.textAlign = 'right';
      g.fillText('KTRC 1', lx + lw - 14, ly + 205);
    }
    tex.needsUpdate = true;
  }
  draw();
  return {
    texture: tex,
    set(next) {
      let changed = false;
      for (const k of Object.keys(next)) {
        const v = next[k];
        if (k === 'rpm' ? Math.abs(state.rpm - v) > 25 : state[k] !== v) {
          state[k] = v;
          changed = true;
        }
      }
      if (changed) draw();
    },
    state,
  };
}
