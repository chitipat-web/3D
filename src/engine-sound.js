// Synthesised inline-four engine sound (Web Audio, no samples).
// A four-stroke inline-four fires twice per crank revolution, so the base
// pitch is rpm / 60 * 2 Hz: ~43 Hz at a 1,300 rpm idle, ~530 Hz at 16,000.
export const IDLE_RPM = 1300;
export const REDLINE_RPM = 16000;

function distortionCurve(k) {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

export class EngineSound {
  constructor() {
    this.ctx = null;
    this.running = false;
    this.rpm = 0;
    this.throttle = 0; // 0..1
    this.cranking = 0; // seconds of starter left
  }

  // Must be called from a user gesture (browsers block audio otherwise).
  async start() {
    if (this.running) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('no-audio');
    if (!this.ctx) this.build(new AC());
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.running = true;
    this.cranking = 0.75;
    this.rpm = 250;
  }

  stop() {
    this.running = false;
    this.throttle = 0;
  }

  build(ctx) {
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    master.connect(comp).connect(ctx.destination);

    // firing pulses: sawtooth at the firing frequency + a sub-harmonic square
    // (uneven pulses give the "growl"), shaped and low-passed
    const fire = ctx.createOscillator();
    fire.type = 'sawtooth';
    const sub = ctx.createOscillator();
    sub.type = 'square';
    const subGain = ctx.createGain();
    subGain.gain.value = 0.35;
    const shaper = ctx.createWaveShaper();
    shaper.curve = distortionCurve(14);
    shaper.oversample = '2x';
    const body = ctx.createBiquadFilter();
    body.type = 'lowpass';
    body.Q.value = 4;
    const bodyGain = ctx.createGain();
    bodyGain.gain.value = 0.55;
    fire.connect(shaper);
    sub.connect(subGain).connect(shaper);
    shaper.connect(body).connect(bodyGain).connect(master);

    // induction/exhaust roar: band-passed noise that opens with throttle
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const roar = ctx.createBiquadFilter();
    roar.type = 'bandpass';
    roar.Q.value = 1.4;
    const roarGain = ctx.createGain();
    roarGain.gain.value = 0;
    noise.connect(roar).connect(roarGain).connect(master);

    // starter motor whine
    const starter = ctx.createOscillator();
    starter.type = 'square';
    starter.frequency.value = 180;
    const starterGain = ctx.createGain();
    starterGain.gain.value = 0;
    const starterLP = ctx.createBiquadFilter();
    starterLP.type = 'lowpass';
    starterLP.frequency.value = 900;
    starter.connect(starterLP).connect(starterGain).connect(master);

    fire.start();
    sub.start();
    noise.start();
    starter.start();
    Object.assign(this, { master, fire, sub, body, roar, roarGain, starterGain, starter });
  }

  // Advance the simulation; returns the current rpm.
  update(dt) {
    if (!this.ctx) return 0;
    const t = this.ctx.currentTime;
    if (this.running) {
      if (this.cranking > 0) {
        this.cranking -= dt;
        this.rpm = 250 + 120 * Math.sin(t * 40);
        if (this.cranking <= 0) this.rpm = IDLE_RPM + 900; // catch and flare
      } else {
        const target = IDLE_RPM + this.throttle * (REDLINE_RPM - 600 - IDLE_RPM);
        const rate = target > this.rpm ? 9.5 : 3.2; // revs rise faster than they fall
        this.rpm += (target - this.rpm) * Math.min(1, rate * dt);
        // limiter bounce at the redline
        if (this.rpm > REDLINE_RPM - 700) this.rpm -= Math.random() * 900;
      }
    } else {
      this.rpm += (0 - this.rpm) * Math.min(1, 2.2 * dt);
      if (this.rpm < 60) this.rpm = 0;
    }
    const rpm = Math.max(0, this.rpm);
    const firing = (rpm / 60) * 2;
    const k = rpm / REDLINE_RPM;
    const crank = this.running && this.cranking > 0;
    const audible = this.running || rpm > 100;
    const vol = !audible ? 0 : crank ? 0.25 : 0.32 + 0.4 * k + 0.25 * this.throttle;
    this.fire.frequency.setTargetAtTime(Math.max(20, firing), t, 0.015);
    this.sub.frequency.setTargetAtTime(Math.max(10, firing / 2), t, 0.015);
    this.body.frequency.setTargetAtTime(220 + rpm * 0.22 + this.throttle * 900, t, 0.03);
    this.roar.frequency.setTargetAtTime(400 + rpm * 0.35, t, 0.05);
    this.roarGain.gain.setTargetAtTime(audible ? 0.04 + 0.22 * this.throttle * (0.3 + k) : 0, t, 0.05);
    this.starterGain.gain.setTargetAtTime(crank ? 0.18 : 0, t, 0.02);
    this.starter.frequency.setTargetAtTime(crank ? 160 + 40 * Math.sin(t * 30) : 120, t, 0.02);
    this.master.gain.setTargetAtTime(vol * 0.5, t, 0.04);
    return rpm;
  }
}
