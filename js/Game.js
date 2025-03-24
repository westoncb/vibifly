import WaveField from "./WaveField.js";
import Emitter from "./Emitter.js";
import WaveRenderer from "./WaveRenderer.js";
import AudioRenderer from "./AudioRenderer.js";

class Game {
  constructor(canvasId) {
    // Set up canvas
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");
    this.setupCanvas();

    // Game state
    this.isRunning = false;
    this.lastTimestamp = 0;
    this.paused = false;

    // Wave system
    this.waveField = new WaveField(this.canvas.width, this.canvas.height, 32);
    this.waveRenderer = new WaveRenderer(this.canvas, this.waveField);
    this.audioRenderer = new AudioRenderer(this.waveField);

    // Player ship
    this.ship = {
      position: {
        x: this.canvas.width / 2,
        y: this.canvas.height / 2,
      },
      velocity: { x: 0, y: 0 },
      rotation: 0, // In radians
      radius: 15,
      thrust: 0,
      rotationSpeed: 0.1,
      acceleration: 600, // Pixels per second squared
      friction: 0.98,
      maxSpeed: 600,
      isThrusterActive: false,
      isWeaponCharging: false,
      weaponCharge: 0,
      weaponChargeRate: 4, // Charge per second
      chargeSound: null,
      chargeSoundActive: false,
      maxWeaponCharge: 3.0,
      thrusterEmitter: null,
      weaponEmitter: null,
      playerId: 0, // Player ID for emitters
    };

    // Create ship emitters
    this.createShipEmitters();

    // Active waves
    this.travelingWaves = [];

    // Input state
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
      space: false,
    };

    // Bind event handlers
    this.bindEvents();
  }

  // Set up canvas dimensions
  setupCanvas() {
    // Set to window dimensions or fixed size
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    // Handle resizing
    window.addEventListener("resize", () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;

      // Recreate wave field with new dimensions
      if (this.waveField) {
        const oldField = this.waveField;
        this.waveField = new WaveField(
          this.canvas.width,
          this.canvas.height,
          oldField.resolution,
        );
      }
    });
  }

  // Create ship emitters
  createShipEmitters() {
    // Thruster emitter
    this.ship.thrusterEmitter = new Emitter({
      id: "player-thruster",
      type: "thruster",
      playerId: this.ship.playerId,
      position: { ...this.ship.position },
      active: false,
      spreadAngle: 90, // Wider spread behind the ship (increased from 60)
      waveDensity: 16, // More waves per second (increased from 5)
      oscillatorType: "sawtooth",
      filterType: "lowpass",
      scaleType: "pentatonic",
      onEmitWave: (wave) => this.onWaveEmitted(wave),
    });

    // Weapon emitter
    this.ship.weaponEmitter = new Emitter({
      id: "player-weapon",
      type: "weapon",
      playerId: this.ship.playerId,
      position: { ...this.ship.position },
      active: false,
      spreadAngle: 20,
      waveDensity: 0, // Manual emission
      oscillatorType: "sawtooth",
      filterType: "lowpass",
      filterFrequency: 1200,
      gain: 0.5, // Increased gain
      scaleType: "minorPentatonic",
      maxRadius: 1600, // Larger radius for weapon effects
      pulseSize: 80, // Larger pulse
      onEmitWave: (wave) => this.onWaveEmitted(wave),
    });
  }

  // Bind keyboard and other event handlers
  bindEvents() {
    // Keyboard events
    window.addEventListener("keydown", (e) => this.handleKeyDown(e));
    window.addEventListener("keyup", (e) => this.handleKeyUp(e));

    // Initialize audio on first user interaction
    window.addEventListener("click", () => {
      if (this.audioRenderer.audioContext.state === "suspended") {
        this.audioRenderer.audioContext.resume();
      }
    });
  }

  // Handle key down events
  handleKeyDown(e) {
    switch (e.key) {
      case "ArrowUp":
      case "w":
        this.keys.up = true;
        this.ship.isThrusterActive = true;
        this.ship.thrusterEmitter.activate();
        break;
      case "ArrowDown":
      case "s":
        this.keys.down = true;
        break;
      case "ArrowLeft":
      case "a":
        this.keys.left = true;
        break;
      case "ArrowRight":
      case "d":
        this.keys.right = true;
        break;
      case " ":
        if (!this.keys.space) {
          this.keys.space = true;
          this.ship.isWeaponCharging = true;
          this.ship.weaponCharge = 0;
          this.sta;
        }
        break;
      case "p":
        this.togglePause();
        break;
    }
  }

  // Handle key up events
  handleKeyUp(e) {
    switch (e.key) {
      case "ArrowUp":
      case "w":
        this.keys.up = false;
        this.ship.isThrusterActive = false;
        this.ship.thrusterEmitter.deactivate();
        break;
      case "ArrowDown":
      case "s":
        this.keys.down = false;
        break;
      case "ArrowLeft":
      case "a":
        this.keys.left = false;
        break;
      case "ArrowRight":
      case "d":
        this.keys.right = false;
        break;
      case " ":
        this.keys.space = false;
        this.fireWeapon();
        this.ship.isWeaponCharging = false;
        break;
    }
  }

  // Handle wave emission
  onWaveEmitted(wave) {
    // Add to traveling waves collection
    this.travelingWaves.push(wave);

    // Add to renderer
    this.waveRenderer.addTravelingWave(wave);

    // Process for audio
    this.audioRenderer.processTravelingWave(wave);
  }

  fireWeapon() {
    if (this.ship.weaponCharge > 0.1) {
      this.stopChargeSound();

      // Only fire if we have some minimum charge
      // Calculate position in front of the ship
      const weaponDistance = this.ship.radius + 5;
      const weaponX =
        this.ship.position.x + Math.cos(this.ship.rotation) * weaponDistance;
      const weaponY =
        this.ship.position.y + Math.sin(this.ship.rotation) * weaponDistance;

      // Update weapon emitter position and angle
      this.ship.weaponEmitter.update(
        { x: weaponX, y: weaponY },
        this.ship.rotation,
        {
          // Scale properties based on charge
          gain: 0.5 + this.ship.weaponCharge * 0.5,
          filterFrequency: 1000 + this.ship.weaponCharge * 3000,
          spreadAngle: 30 + this.ship.weaponCharge * 20,
          reverbAmount: 0.2 + this.ship.weaponCharge * 0.4,
        },
      );

      // Activate and emit wave
      this.ship.weaponEmitter.activate();

      // Get charge intensity factor
      const chargeIntensity = Math.min(
        1.0,
        this.ship.weaponCharge / this.ship.maxWeaponCharge,
      );

      // For stronger shots, emit multiple waves!
      if (chargeIntensity > 0.8) {
        // For a fully charged shot, emit 3 waves in quick succession
        this.ship.weaponEmitter.emitWave(chargeIntensity, performance.now());

        // Small delay between waves
        setTimeout(() => {
          this.ship.weaponEmitter.emitWave(
            chargeIntensity * 0.8,
            performance.now(),
          );
        }, 50);

        setTimeout(() => {
          this.ship.weaponEmitter.emitWave(
            chargeIntensity * 0.6,
            performance.now(),
          );
        }, 100);
      } else if (chargeIntensity > 0.4) {
        // Medium charge, emit 2 waves
        this.ship.weaponEmitter.emitWave(chargeIntensity, performance.now());

        setTimeout(() => {
          this.ship.weaponEmitter.emitWave(
            chargeIntensity * 0.7,
            performance.now(),
          );
        }, 70);
      } else {
        // Single wave for small charges
        this.ship.weaponEmitter.emitWave(chargeIntensity, performance.now());
      }

      // Add a slight "recoil" effect to the ship
      const recoil = chargeIntensity * 50;
      this.ship.velocity.x -= Math.cos(this.ship.rotation) * recoil * 0.2;
      this.ship.velocity.y -= Math.sin(this.ship.rotation) * recoil * 0.2;

      // Reset charge
      this.ship.weaponCharge = 0;

      // Deactivate after firing
      setTimeout(() => {
        this.ship.weaponEmitter.deactivate();
      }, 200);
    }
  }

  // Update ship position and physics
  updateShip(deltaTime) {
    // Handle rotation
    if (this.keys.left) {
      this.ship.rotation -= this.ship.rotationSpeed;
    }
    if (this.keys.right) {
      this.ship.rotation += this.ship.rotationSpeed;
    }

    this.ship.rotation =
      ((this.ship.rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

    // Handle thrust
    if (this.keys.up) {
      // Calculate thrust vector
      const thrustX =
        Math.cos(this.ship.rotation) * this.ship.acceleration * deltaTime;
      const thrustY =
        Math.sin(this.ship.rotation) * this.ship.acceleration * deltaTime;

      // Apply to velocity
      this.ship.velocity.x += thrustX;
      this.ship.velocity.y += thrustY;

      // Update thruster emitter
      const thrusterDistance = this.ship.radius;
      const thrusterAngle = this.ship.rotation + Math.PI; // Opposite direction
      const thrusterX =
        this.ship.position.x + Math.cos(thrusterAngle) * thrusterDistance;
      const thrusterY =
        this.ship.position.y + Math.sin(thrusterAngle) * thrusterDistance;

      this.ship.thrusterEmitter.update(
        { x: thrusterX, y: thrusterY },
        thrusterAngle,
        {
          spreadAngle: 60,
          gain:
            0.3 +
            (Math.hypot(this.ship.velocity.x, this.ship.velocity.y) /
              this.ship.maxSpeed) *
              0.3,
        },
      );

      // Emit waves regularly while thrusting
      if (this.ship.thrusterEmitter.shouldEmitWave(performance.now())) {
        const intensity =
          0.3 +
          (Math.hypot(this.ship.velocity.x, this.ship.velocity.y) /
            this.ship.maxSpeed) *
            0.7;
        this.ship.thrusterEmitter.emitWave(intensity, performance.now());
      }
    }

    // Apply friction
    this.ship.velocity.x *= this.ship.friction;
    this.ship.velocity.y *= this.ship.friction;

    // Limit speed
    const speed = Math.hypot(this.ship.velocity.x, this.ship.velocity.y);
    if (speed > this.ship.maxSpeed) {
      const scale = this.ship.maxSpeed / speed;
      this.ship.velocity.x *= scale;
      this.ship.velocity.y *= scale;
    }

    // Update position
    this.ship.position.x += this.ship.velocity.x * deltaTime;
    this.ship.position.y += this.ship.velocity.y * deltaTime;

    // Wrap around screen edges
    if (this.ship.position.x < 0) this.ship.position.x = this.canvas.width;
    if (this.ship.position.x > this.canvas.width) this.ship.position.x = 0;
    if (this.ship.position.y < 0) this.ship.position.y = this.canvas.height;
    if (this.ship.position.y > this.canvas.height) this.ship.position.y = 0;

    // Update weapon charge
    if (this.ship.isWeaponCharging) {
      this.ship.weaponCharge = Math.min(
        this.ship.maxWeaponCharge,
        this.ship.weaponCharge + this.ship.weaponChargeRate * deltaTime,
      );

      this.updateChargeSound();
    } else if (this.ship.chargeSoundActive) {
      this.stopChargeSound();
    }
  }

  createChargeSound() {
    // Create audio components if not already created
    if (!this.ship.chargeSound && this.audioRenderer) {
      const ctx = this.audioRenderer.audioContext;

      // Create primary oscillator
      const oscillator = ctx.createOscillator();
      oscillator.type = "sawtooth"; // More harmonics
      oscillator.frequency.value = 200;

      // Create secondary oscillator for depth
      const oscillator2 = ctx.createOscillator();
      oscillator2.type = "square";
      oscillator2.frequency.value = 203; // Slight detuning for chorus effect

      // Create filter
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 800;
      filter.Q.value = 6; // Sharper resonance

      // Create gain
      const gain = ctx.createGain();
      gain.gain.value = 0;

      // Create distortion for more presence
      const distortion = ctx.createWaveShaper();
      function makeDistortionCurve(amount) {
        const k = amount || 50;
        const samples = 44100;
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;

        for (let i = 0; i < samples; ++i) {
          const x = (i * 2) / samples - 1;
          curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
        }
        return curve;
      }
      distortion.curve = makeDistortionCurve(30);

      // Connect
      oscillator.connect(filter);
      oscillator2.connect(filter);
      filter.connect(distortion);
      distortion.connect(gain);
      gain.connect(this.audioRenderer.masterGain);

      // Start oscillators
      oscillator.start();
      oscillator2.start();

      // Store components
      this.ship.chargeSound = {
        oscillator,
        oscillator2,
        filter,
        distortion,
        gain,
        active: true,
      };
    }
  }

  updateChargeSound() {
    // Create the charge sound if it doesn't exist
    if (!this.ship.chargeSound) {
      this.createChargeSound();
    }

    if (this.ship.chargeSound) {
      const chargeRatio = this.ship.weaponCharge / this.ship.maxWeaponCharge;
      const ctx = this.audioRenderer.audioContext;

      // Update frequency (rises with charge)
      this.ship.chargeSound.oscillator.frequency.exponentialRampToValueAtTime(
        200 + chargeRatio * 1800, // More range
        ctx.currentTime + 0.1,
      );

      // Update filter (opens up with charge)
      this.ship.chargeSound.filter.frequency.exponentialRampToValueAtTime(
        800 + chargeRatio * 4000, // More filter sweep
        ctx.currentTime + 0.1,
      );

      // Significantly increase gain
      this.ship.chargeSound.gain.gain.exponentialRampToValueAtTime(
        0.2 + chargeRatio * 0.5, // Much louder now
        ctx.currentTime + 0.1,
      );

      this.ship.chargeSoundActive = true;

      // Add some pulsing as charge increases
      if (chargeRatio > 0.5) {
        const pulseRate = 4 + chargeRatio * 8; // Pulse faster as charge increases
        const pulseAmount = 0.3 * chargeRatio;
        const pulseValue =
          0.2 +
          0.5 * chargeRatio +
          Math.sin((Date.now() / 100) * pulseRate) * pulseAmount;

        this.ship.chargeSound.gain.gain.exponentialRampToValueAtTime(
          pulseValue,
          ctx.currentTime + 0.05,
        );
      }
    }
  }

  stopChargeSound() {
    if (this.ship.chargeSound) {
      const ctx = this.audioRenderer.audioContext;

      // Fade out
      this.ship.chargeSound.gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + 0.1,
      );

      this.ship.chargeSoundActive = false;
    }
  }

  // Toggle pause state
  togglePause() {
    this.paused = !this.paused;
    if (!this.paused && !this.isRunning) {
      this.start();
    }
  }

  // Start the game loop
  start() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.lastTimestamp = performance.now();
      requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
    }
  }

  // Main game loop
  gameLoop(timestamp) {
    // Calculate delta time
    const deltaTime = (timestamp - this.lastTimestamp) / 1000; // Convert to seconds
    this.lastTimestamp = timestamp;

    // Skip update if paused, but still request next frame
    if (!this.paused) {
      this.update(deltaTime);
    }

    // Always render
    this.render();

    // Request next frame
    if (this.isRunning) {
      requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
    }
  }

  // Update game state
  update(deltaTime) {
    // Cap delta time to avoid huge jumps
    const dt = Math.min(deltaTime, 0.1);

    // Update ship
    this.updateShip(dt);

    // Update audio listener position (follows the ship)
    this.audioRenderer.setListenerPosition(
      this.ship.position.x,
      this.ship.position.y,
    );

    // Update traveling waves
    this.waveRenderer.updateTravelingWaves(dt);

    // Update wave field
    this.waveField.update(dt);

    // Process wave-field interactions
    this.travelingWaves.forEach((wave) => {
      // Apply wave effect to field
      if (wave.intensity > 0.05) {
        this.waveField.addWavePulse(
          wave.position.x,
          wave.position.y,
          wave.radius,
          wave.intensity,
          wave.frequency,
          wave.color,
          wave.angle,
          wave.spreadAngle,
        );
      }
    });

    // Clean up expired waves
    this.travelingWaves = this.travelingWaves.filter((wave) => {
      return wave.radius <= wave.maxRadius && wave.intensity > 0.01;
    });

    // Update audio
    this.audioRenderer.update();
  }

  // Render the game
  render() {
    // Clear canvas
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Render wave field
    this.waveRenderer.render();

    // Render ship
    this.renderShip();

    // Render UI
    this.renderUI();
  }

  // Render the player ship
  renderShip() {
    const { x, y } = this.ship.position;
    const { rotation, radius } = this.ship;

    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(rotation);

    // Ship body
    this.ctx.fillStyle = "white";
    this.ctx.strokeStyle = "white";
    this.ctx.lineWidth = 2;

    this.ctx.beginPath();
    this.ctx.moveTo(radius, 0);
    this.ctx.lineTo(-radius, -radius * 0.7);
    this.ctx.lineTo(-radius * 0.5, 0);
    this.ctx.lineTo(-radius, radius * 0.7);
    this.ctx.closePath();
    this.ctx.stroke();

    // Thruster flame when active
    // if (this.ship.isThrusterActive) {
    //   this.ctx.fillStyle = "rgba(255, 150, 50, 0.8)";
    //   this.ctx.beginPath();
    //   this.ctx.moveTo(-radius * 0.5, 0);
    //   this.ctx.lineTo(-radius * 2, radius * 0.5);
    //   this.ctx.lineTo(-radius * 2.5, 0);
    //   this.ctx.lineTo(-radius * 2, -radius * 0.5);
    //   this.ctx.closePath();
    //   this.ctx.fill();
    // }

    // Weapon charge indicator
    // In renderShip method, replace the existing charge indicator with this
    if (this.ship.isWeaponCharging && this.ship.weaponCharge > 0) {
      const chargeRatio = this.ship.weaponCharge / this.ship.maxWeaponCharge;
      const chargeRadius = radius * (0.5 + chargeRatio * 0.5);

      // Create a pulsing effect based on current time
      const pulseRate = 5 + chargeRatio * 10; // Pulse faster as charge increases
      const pulseFactor =
        0.15 * Math.sin((Date.now() / 100) * pulseRate) + 0.85;
      const pulsingRadius = chargeRadius * pulseFactor;

      // Create a gradient for more dynamic look
      const gradient = this.ctx.createRadialGradient(
        radius * 0.5,
        0,
        0,
        radius * 0.5,
        0,
        pulsingRadius * 1.2,
      );

      // Gradient colors change with charge level
      const r = 100 - chargeRatio * 50; // Blue to purple shift
      const g = 150 + chargeRatio * 50; // Brighter teal/cyan at full charge
      const b = 255;

      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${chargeRatio * 0.9})`);
      gradient.addColorStop(
        0.7,
        `rgba(${r}, ${g}, ${b}, ${chargeRatio * 0.7})`,
      );
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(radius * 0.5, 0, pulsingRadius, 0, Math.PI * 2);
      this.ctx.fill();

      // Add energy arcs around the charge for high charges
      if (chargeRatio > 0.5) {
        const arcCount = Math.floor(chargeRatio * 8) + 2;
        const arcLength = Math.PI * 0.5 * chargeRatio;

        this.ctx.strokeStyle = `rgba(220, 240, 255, ${chargeRatio * 0.8})`;
        this.ctx.lineWidth = 1 + chargeRatio;

        for (let i = 0; i < arcCount; i++) {
          const arcStartAngle =
            ((Math.PI * 2) / arcCount) * i +
            ((Date.now() / 500) % (Math.PI * 2));

          this.ctx.beginPath();
          this.ctx.arc(
            radius * 0.5,
            0,
            pulsingRadius * (1 + 0.2 * Math.sin(Date.now() / 200 + i)),
            arcStartAngle,
            arcStartAngle + arcLength,
          );
          this.ctx.stroke();
        }

        // Add particles at high charge levels
        if (chargeRatio > 0.7) {
          const particleCount = Math.floor(chargeRatio * 15);

          for (let i = 0; i < particleCount; i++) {
            // Random angle
            const particleAngle = Math.random() * Math.PI * 2;

            // Random distance from center (biased outward)
            const particleDistance =
              pulsingRadius * (0.5 + Math.random() * 0.8);

            // Position
            const px =
              radius * 0.5 + Math.cos(particleAngle) * particleDistance;
            const py = Math.sin(particleAngle) * particleDistance;

            // Size
            const particleSize = 1 + Math.random() * 2 * chargeRatio;

            // Draw
            this.ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * chargeRatio})`;
            this.ctx.beginPath();
            this.ctx.arc(px, py, particleSize, 0, Math.PI * 2);
            this.ctx.fill();
          }

          // Add electric arcs at very high charge
          if (chargeRatio > 0.9) {
            const arcPairs = 3;
            this.ctx.lineWidth = 0.8;

            for (let i = 0; i < arcPairs; i++) {
              const arcAngle =
                ((Math.PI * 2) / arcPairs) * i +
                ((Date.now() / 300) % (Math.PI * 2));

              const startX =
                radius * 0.5 + Math.cos(arcAngle) * pulsingRadius * 0.8;
              const startY = Math.sin(arcAngle) * pulsingRadius * 0.8;

              const endX =
                radius * 0.5 +
                Math.cos(arcAngle + Math.PI) * pulsingRadius * 0.8;
              const endY = Math.sin(arcAngle + Math.PI) * pulsingRadius * 0.8;

              // Draw jagged lightning between points
              this.ctx.beginPath();
              this.ctx.moveTo(startX, startY);

              // Number of segments
              const segments = 5 + Math.floor(Math.random() * 3);

              // Create jagged path
              let currentX = startX;
              let currentY = startY;

              for (let j = 0; j < segments; j++) {
                // Progress from start to end
                const progress = (j + 1) / (segments + 1);

                // Target is point along the line from start to end
                const targetX = startX + (endX - startX) * progress;
                const targetY = startY + (endY - startY) * progress;

                // Add random jitter
                const jitterAmount =
                  pulsingRadius * 0.3 * (1 - progress) * Math.random();
                const jitterAngle = Math.random() * Math.PI * 2;

                currentX = targetX + Math.cos(jitterAngle) * jitterAmount;
                currentY = targetY + Math.sin(jitterAngle) * jitterAmount;

                this.ctx.lineTo(currentX, currentY);
              }

              this.ctx.lineTo(endX, endY);
              this.ctx.strokeStyle = `rgba(180, 225, 255, ${chargeRatio * 0.8})`;
              this.ctx.stroke();
            }
          }
        }
      }
    }

    this.ctx.restore();
  }

  // Render UI elements
  renderUI() {
    this.ctx.fillStyle = "white";
    this.ctx.font = "16px Arial";

    // Weapon charge bar
    // if (this.ship.isWeaponCharging) {
    //   const chargeRatio = this.ship.weaponCharge / this.ship.maxWeaponCharge;

    //   // Bar background
    //   this.ctx.fillStyle = "rgba(100, 100, 100, 0.5)";
    //   this.ctx.fillRect(20, 50, 200, 15);

    //   // Charge level
    //   this.ctx.fillStyle = `rgba(100, 200, 255, ${0.7 + chargeRatio * 0.3})`;
    //   this.ctx.fillRect(20, 50, 200 * chargeRatio, 15);

    //   this.ctx.fillStyle = "white";
    //   this.ctx.fillText("Weapon Charge", 25, 62);
    // }

    // Pause indicator
    if (this.paused) {
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      this.ctx.fillStyle = "white";
      this.ctx.font = "32px Arial";
      this.ctx.textAlign = "center";
      this.ctx.fillText(
        "PAUSED",
        this.canvas.width / 2,
        this.canvas.height / 2,
      );
      this.ctx.font = "16px Arial";
      this.ctx.fillText(
        "Press P to resume",
        this.canvas.width / 2,
        this.canvas.height / 2 + 30,
      );

      this.ctx.textAlign = "left";
    }
  }

  // Clean up resources
  dispose() {
    this.isRunning = false;
    this.audioRenderer.dispose();

    // Remove event listeners
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);

    if (this.ship.chargeSound) {
      this.ship.chargeSound.oscillator.stop();
      this.ship.chargeSound.oscillator2.stop();
      this.ship.chargeSound.oscillator.disconnect();
      this.ship.chargeSound.oscillator2.disconnect();
      this.ship.chargeSound.filter.disconnect();
      this.ship.chargeSound.distortion.disconnect();
      this.ship.chargeSound.gain.disconnect();
      this.ship.chargeSound = null;
    }
  }
}

export default Game;
