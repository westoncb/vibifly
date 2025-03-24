// Utils.js - Utility functions for audio and visual aspects

// Map a frequency to the nearest note in a scale
function snapToScale(frequency, scaleType = "major") {
  const baseFreq = 440; // A4

  // Define different scale patterns (semitones from root)
  const scales = {
    major: [0, 2, 4, 5, 7, 9, 11], // C D E F G A B
    minor: [0, 2, 3, 5, 7, 8, 10], // A B C D E F G
    pentatonic: [0, 2, 4, 7, 9], // C D E G A
    minorPentatonic: [0, 3, 5, 7, 10], // A C D E G
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11], // A B C D E F G#
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  };

  // Get the scale pattern
  const scalePattern = scales[scaleType] || scales.major;

  // Convert frequency to semitones relative to A4
  const semitones = 12 * Math.log2(frequency / baseFreq);

  // Calculate octave and semitone within octave
  const octave = Math.floor(semitones / 12);
  const semitonesInOctave = ((semitones % 12) + 12) % 12;

  // Find closest note in scale
  let minDistance = Infinity;
  let closestNote = 0;

  for (let i = 0; i < scalePattern.length; i++) {
    // Try each note in the current octave
    const distance = Math.abs(semitonesInOctave - scalePattern[i]);
    if (distance < minDistance) {
      minDistance = distance;
      closestNote = scalePattern[i];
    }

    // Also check the note an octave lower (for edge cases)
    const lowerDistance = Math.abs(semitonesInOctave - (scalePattern[i] - 12));
    if (lowerDistance < minDistance) {
      minDistance = lowerDistance;
      closestNote = scalePattern[i] - 12;
    }
  }

  // Convert back to frequency
  return baseFreq * Math.pow(2, (octave * 12 + closestNote) / 12);
}

// Create an impulse response for convolver (reverb)
function createReverbImpulse(audioContext, duration = 2.0, decay = 2.0) {
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * duration;
  const impulse = audioContext.createBuffer(2, length, sampleRate);

  const leftChannel = impulse.getChannelData(0);
  const rightChannel = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const n = i / length;
    // Decay curve
    const amplitude = Math.pow(1 - n, decay);
    // Random values for natural reverb
    leftChannel[i] = (Math.random() * 2 - 1) * amplitude;
    rightChannel[i] = (Math.random() * 2 - 1) * amplitude;
  }

  return impulse;
}

// Convert HSL to RGB (for generating colors)
function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Generate a color for a player
function getPlayerColor(playerId, variation = 0) {
  // Use golden ratio to spread hues evenly
  const goldenRatio = 0.618033988749895;
  const hue = (((playerId * goldenRatio) % 1) + variation * 0.2) % 1;

  return hslToRgb(hue, 0.85, 0.6);
}

// Calculate directional coordinates based on angle and spread
function getDirectionalCoordinates(x, y, angle, distance, spreadAngle) {
  // Full 360 degrees = 2π radians
  const halfSpread = (spreadAngle * Math.PI) / 180 / 2;

  // For a point source (omnidirectional)
  if (spreadAngle >= 360) {
    return {
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance,
      isInCone: true,
    };
  }

  // For a directional source
  const pointAngle = angle;
  const x2 = x + Math.cos(pointAngle) * distance;
  const y2 = y + Math.sin(pointAngle) * distance;

  // Check if the point is within the spread angle
  const angleToPoint = Math.atan2(y2 - y, x2 - x);
  let angleDiff = Math.abs(angleToPoint - angle);
  // Normalize angle difference
  if (angleDiff > Math.PI) {
    angleDiff = 2 * Math.PI - angleDiff;
  }

  return {
    x: x2,
    y: y2,
    isInCone: angleDiff <= halfSpread,
  };
}

export {
  snapToScale,
  createReverbImpulse,
  hslToRgb,
  getPlayerColor,
  getDirectionalCoordinates,
};
