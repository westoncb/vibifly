// AudioRenderer.js - Audio generation from wave field data

import { createReverbImpulse } from "./Utils.js";

class AudioRenderer {
  constructor(waveField, options = {}) {
    this.waveField = waveField;

    // Audio context and master nodes
    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = options.masterVolume || 0.3;

    // Effects chain
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.reverb = this.audioContext.createConvolver();
    this.createReverbImpulse();

    // Connect the effects chain
    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.audioContext.destination);

    // Create a send to the reverb
    this.reverbSend = this.audioContext.createGain();
    this.reverbSend.gain.value = 0.3;
    this.masterGain.connect(this.reverbSend);
    this.reverbSend.connect(this.reverb);
    this.reverb.connect(this.compressor);

    // Voice settings
    this.maxVoices = options.maxVoices || 16; // Maximum simultaneous voices to avoid overloading
    this.voices = [];

    // Initialize voices
    this.initializeVoices();

    // Listener position (usually the player's position)
    this.listenerPosition = { x: 0, y: 0 };
  }

  // Create reverb impulse response
  createReverbImpulse() {
    const impulse = createReverbImpulse(this.audioContext, 2.0, 3.0);
    this.reverb.buffer = impulse;
  }

  // Initialize audio voices
  initializeVoices() {
    for (let i = 0; i < this.maxVoices; i++) {
      const oscillator = this.audioContext.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = 440;

      const filter = this.audioContext.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1000;
      filter.Q.value = 1;

      const gain = this.audioContext.createGain();
      gain.gain.value = 0; // Start silent

      // Connect the chain
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      // Start the oscillator
      oscillator.start();

      // Create the voice object
      this.voices.push({
        oscillator,
        filter,
        gain,
        reverbSend: null, // Will create on demand
        active: false,
        assignedCell: null,
        lastUpdate: 0,
      });
    }
  }

  // Create a reverb send for a voice if needed
  getReverbSend(voiceIndex) {
    const voice = this.voices[voiceIndex];

    if (!voice.reverbSend) {
      voice.reverbSend = this.audioContext.createGain();
      voice.reverbSend.gain.value = 0;
      voice.filter.connect(voice.reverbSend);
      voice.reverbSend.connect(this.reverb);
    }

    return voice.reverbSend;
  }

  // Set the listener position (typically player position)
  setListenerPosition(x, y) {
    this.listenerPosition = { x, y };
  }

  // Update audio based on wave field state
  update() {
    const currentTime = this.audioContext.currentTime;

    // Get active cells from wave field
    const activeCells = this.waveField
      .getActiveCells(0.05)
      .sort((a, b) => b.cell.energy - a.cell.energy) // Sort by energy (highest first)
      .slice(0, this.maxVoices); // Limit to max voices

    // First, silence all inactive voices
    for (let i = 0; i < this.voices.length; i++) {
      if (i >= activeCells.length) {
        const voice = this.voices[i];

        if (voice.active) {
          // Fade out to avoid clicks
          voice.gain.gain.exponentialRampToValueAtTime(
            0.001,
            currentTime + 0.1,
          );
          voice.active = false;
          voice.assignedCell = null;
        }
      }
    }

    // Then, assign voices to active cells
    activeCells.forEach((cellData, index) => {
      if (index < this.voices.length) {
        const voice = this.voices[index];
        const { cell, worldX, worldY } = cellData;

        // Calculate distance from listener for spatial audio
        const dx = worldX - this.listenerPosition.x;
        const dy = worldY - this.listenerPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Max audible distance
        const maxDistance =
          Math.max(this.waveField.width, this.waveField.height) * 0.5;

        // Calculate attenuation based on distance
        const attenuation = Math.max(0, 1 - distance / maxDistance);

        // Calculate pan position (-1 to 1)
        const pan = Math.max(-1, Math.min(1, dx / (maxDistance * 0.5)));

        // Set oscillator properties
        voice.oscillator.type = this.getOscillatorTypeForCell(cell);
        voice.oscillator.frequency.exponentialRampToValueAtTime(
          cell.frequency,
          currentTime + 0.05,
        );

        // Set filter properties
        voice.filter.type = this.getFilterTypeForCell(cell);
        voice.filter.frequency.exponentialRampToValueAtTime(
          this.getFilterFrequencyForCell(cell),
          currentTime + 0.05,
        );
        voice.filter.Q.value = 2 + cell.energy * 8; // Higher energy = more resonance

        // Set gain based on energy and distance
        const targetGain = cell.energy * attenuation * 0.2;
        voice.gain.gain.exponentialRampToValueAtTime(
          Math.max(0.001, targetGain),
          currentTime + 0.05,
        );

        // Set reverb send level
        const reverbSend = this.getReverbSend(index);
        reverbSend.gain.exponentialRampToValueAtTime(
          cell.energy * 0.3,
          currentTime + 0.1,
        );

        voice.active = true;
        voice.assignedCell = cellData.index;
        voice.lastUpdate = currentTime;
      }
    });
  }

  // Get oscillator type based on cell properties
  getOscillatorTypeForCell(cell) {
    // Color determines oscillator type
    const brightness = (cell.color[0] + cell.color[1] + cell.color[2]) / 765; // 0-1 range

    if (brightness < 0.3) return "sine";
    if (brightness < 0.6) return "triangle";
    if (brightness < 0.8) return "sawtooth";
    return "square";
  }

  // Get filter type based on cell properties
  getFilterTypeForCell(cell) {
    // Simple mapping
    const r = cell.color[0];
    const g = cell.color[1];
    const b = cell.color[2];

    if (r > g && r > b) return "lowpass";
    if (g > r && g > b) return "bandpass";
    return "highpass";
  }

  // Get filter frequency based on cell properties
  getFilterFrequencyForCell(cell) {
    // Map to a reasonable frequency range
    return 200 + cell.energy * 5000;
  }

  // Process a traveling wave for audio
  processTravelingWave(wave) {
    // One-shot sound for a wave
    const oscillator = this.audioContext.createOscillator();
    const filter = this.audioContext.createBiquadFilter();
    const gain = this.audioContext.createGain();
    const panner = this.audioContext.createStereoPanner();

    // Calculate distance from listener
    const dx = wave.position.x - this.listenerPosition.x;
    const dy = wave.position.y - this.listenerPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Max audible distance
    const maxDistance =
      Math.max(this.waveField.width, this.waveField.height) * 0.7;

    // Skip if too far away
    if (distance > maxDistance) return;

    // Calculate attenuation and pan
    const attenuation = Math.max(0, 1 - distance / maxDistance);
    const pan = Math.max(-1, Math.min(1, dx / (maxDistance * 0.5)));

    // Set properties
    oscillator.type = wave.oscillatorType || "sine";
    oscillator.frequency.value = wave.frequency;

    filter.type = wave.filterType || "lowpass";
    filter.frequency.value = wave.filterFrequency || 1000;
    filter.Q.value = wave.filterQ || 1;

    panner.pan.value = pan;

    // Set envelope
    const now = this.audioContext.currentTime;
    const duration = 0.1 + wave.intensity * 0.5;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(wave.gain * attenuation, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Connect chain
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.masterGain);

    // Add reverb if needed
    if (wave.reverbAmount > 0) {
      const reverbSend = this.audioContext.createGain();
      reverbSend.gain.value = wave.reverbAmount;
      filter.connect(reverbSend);
      reverbSend.connect(this.reverb);
    }

    // Start and schedule stop
    oscillator.start(now);
    oscillator.stop(now + duration + 0.1);

    if (wave.type === "weapon") {
      // Create a more complex sound with better attack
      const oscillator2 = this.audioContext.createOscillator();
      oscillator2.type = "sawtooth"; // More aggressive sound
      oscillator2.frequency.value = wave.frequency * 0.5; // Sub-oscillator

      const distortion = this.audioContext.createWaveShaper();
      function makeDistortionCurve(amount) {
        const k = typeof amount === "number" ? amount : 50;
        const samples = 44100;
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;

        for (let i = 0; i < samples; ++i) {
          const x = (i * 2) / samples - 1;
          curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
        }
        return curve;
      }
      distortion.curve = makeDistortionCurve(400);

      // Connect sub-oscillator through distortion
      oscillator2.connect(distortion);
      distortion.connect(filter);

      // Start the secondary oscillator too
      oscillator2.start(now);
      oscillator2.stop(now + duration + 0.1);

      // Improved envelope with faster attack
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(
        wave.gain * 2.0 * attenuation,
        now + 0.005,
      ); // Faster attack
      gain.gain.exponentialRampToValueAtTime(
        wave.gain * 0.6 * attenuation,
        now + 0.001,
      );
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      // Add a subtle pitch drop for the weapon
      oscillator.frequency.setValueAtTime(wave.frequency * 1.1, now); // Start slightly higher
      oscillator.frequency.exponentialRampToValueAtTime(
        wave.frequency * 0.9,
        now + duration,
      );

      setTimeout(
        () => {
          oscillator2.disconnect();
          distortion.disconnect();
        },
        (duration + 0.2) * 1000,
      );
    }

    // Clean up
    setTimeout(
      () => {
        oscillator.disconnect();
        filter.disconnect();
        gain.disconnect();
        panner.disconnect();
      },
      (duration + 0.2) * 1000,
    );
  }

  // Clean up resources
  dispose() {
    // Stop and disconnect all voices
    this.voices.forEach((voice) => {
      voice.oscillator.stop();
      voice.oscillator.disconnect();
      voice.filter.disconnect();
      voice.gain.disconnect();
      if (voice.reverbSend) {
        voice.reverbSend.disconnect();
      }
    });

    // Disconnect master nodes
    this.masterGain.disconnect();
    this.compressor.disconnect();
    this.reverb.disconnect();
    this.reverbSend.disconnect();

    // Close audio context
    if (this.audioContext.state !== "closed") {
      this.audioContext.close();
    }
  }
}

export default AudioRenderer;
