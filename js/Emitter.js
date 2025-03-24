// Emitter.js - Creates and manages wave emitters with audio and visual properties

import { getPlayerColor, snapToScale } from "./Utils.js";

class Emitter {
  constructor(options = {}) {
    // Basic properties
    this.id = options.id || Math.random().toString(36).substring(7);
    this.type = options.type || "default"; // thruster, weapon, explosion, etc.
    this.playerId = options.playerId || 0;
    this.position = options.position || { x: 0, y: 0 };
    this.active = options.active !== undefined ? options.active : true;
    this.angle = options.angle || 0; // Direction in radians

    // Wave properties
    this.spreadAngle =
      options.spreadAngle !== undefined ? options.spreadAngle : 360; // Degrees (360 = omnidirectional)
    this.waveSpeed = options.waveSpeed || 200; // Pixels per second
    this.waveDensity = options.waveDensity || 1.0; // How many waves to emit per second
    this.lastEmitTime = 0;

    // Visual properties
    this.baseColor =
      options.color ||
      getPlayerColor(this.playerId, this.type === "weapon" ? 0.9 : 0);
    this.pulseSize = options.pulseSize || (this.type === "thruster" ? 30 : 15);
    this.maxRadius = options.maxRadius || 300;

    // Audio properties
    this.baseFrequency = this.calculateBaseFrequency();
    this.scaleType = options.scaleType || "pentatonic";
    this.oscillatorType = options.oscillatorType || this.getOscillatorType();
    this.filterType = options.filterType || "lowpass";
    this.filterFrequency = options.filterFrequency || this.getFilterFrequency();
    this.filterQ = options.filterQ || 1.0;
    this.reverbAmount = options.reverbAmount || 0.3;
    this.gain = options.gain || this.getDefaultGain();

    // Optional callback when a wave is emitted
    this.onEmitWave = options.onEmitWave || null;
  }

  // Get default oscillator type based on emitter type
  getOscillatorType() {
    switch (this.type) {
      case "thruster":
        return "sawtooth";
      case "weapon":
        return "square";
      case "explosion":
        return "triangle";
      default:
        return "sine";
    }
  }

  // Calculate a base frequency based on player ID and emitter type
  calculateBaseFrequency() {
    // Map player IDs to different frequency ranges
    const baseFreq = 220 * (1 + (this.playerId % 8) / 8); // A3 to A4

    switch (this.type) {
      case "thruster":
        return baseFreq;
      case "weapon":
        return baseFreq * 1.5; // Perfect fifth
      case "explosion":
        return baseFreq * 0.5; // Octave down
      default:
        return baseFreq;
    }
  }

  // Get default filter frequency
  getFilterFrequency() {
    switch (this.type) {
      case "thruster":
        return 800;
      case "weapon":
        return 2200;
      case "explosion":
        return 400;
      default:
        return 1000;
    }
  }

  // Get default gain
  getDefaultGain() {
    switch (this.type) {
      case "thruster":
        return 0.3;
      case "weapon":
        return 0.7;
      case "explosion":
        return 0.7;
      default:
        return 0.4;
    }
  }

  // Update emitter position and properties
  update(position, angle, properties = {}) {
    if (position) {
      this.position = position;
    }

    if (angle !== undefined) {
      this.angle = angle;
    }

    // Update any other properties
    Object.keys(properties).forEach((key) => {
      if (this[key] !== undefined) {
        this[key] = properties[key];
      }
    });
  }

  // Emit a wave pulse
  emitWave(intensity = 1.0, timeStep) {
    if (!this.active) return null;

    // Calculate frequency with slight variation for interest
    let frequency = this.baseFrequency * (0.98 + Math.random() * 0.04);

    // Snap to musical scale if desired
    if (this.scaleType !== "chromatic") {
      frequency = snapToScale(frequency, this.scaleType);
    }

    // Create wave data
    const wave = {
      emitterId: this.id,
      playerId: this.playerId,
      type: this.type,
      position: { ...this.position },
      angle: this.angle,
      spreadAngle: this.spreadAngle,
      radius: 10, // Starting radius
      maxRadius: this.maxRadius,
      speed: this.waveSpeed,
      intensity: intensity,
      frequency: frequency,
      color: this.baseColor.slice(), // Copy the color array
      oscillatorType: this.oscillatorType,
      filterType: this.filterType,
      filterFrequency: this.filterFrequency,
      filterQ: this.filterQ,
      reverbAmount: this.reverbAmount,
      gain: this.gain * intensity,
      createdAt: timeStep || performance.now(),
    };

    // Call the callback if provided
    if (typeof this.onEmitWave === "function") {
      this.onEmitWave(wave);
    }

    this.lastEmitTime = wave.createdAt;

    return wave;
  }

  // Check if it's time to emit a wave based on density
  shouldEmitWave(currentTime) {
    if (!this.active || this.waveDensity <= 0) return false;

    const timeSinceLastEmit = currentTime - this.lastEmitTime;
    const emitInterval = 1000 / this.waveDensity; // ms between waves

    return timeSinceLastEmit >= emitInterval;
  }

  // Deactivate the emitter
  deactivate() {
    this.active = false;
  }

  // Activate the emitter
  activate() {
    this.active = true;
  }
}

export default Emitter;
