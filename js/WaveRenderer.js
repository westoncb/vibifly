// WaveRenderer.js - Visual rendering for the wave field and emitters

class WaveRenderer {
  constructor(canvas, waveField) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.waveField = waveField;

    // Enhanced visual settings
    this.showGrid = false; // Set to true for debugging
    this.waveLineWidth = 8; // Increased from your 14 setting
    this.waveOpacityFactor = 0.8; // Maximum opacity

    // Collection of active traveling waves
    this.travelingWaves = [];
    this.debugMode = true;
  }

  // Add a traveling wave to be rendered
  addTravelingWave(wave) {
    this.travelingWaves.push(wave);
  }

  // Update traveling waves
  updateTravelingWaves(deltaTime) {
    this.travelingWaves = this.travelingWaves.filter((wave) => {
      // Expand the wave
      wave.radius += wave.speed * deltaTime;

      // Reduce intensity with distance
      const distanceFactor = 1 - wave.radius / wave.maxRadius / 2;
      wave.intensity = Math.max(0, wave.intensity * distanceFactor);

      // Keep the wave if it hasn't reached max radius and still has intensity
      return wave.radius < wave.maxRadius && wave.intensity > 0.01;
    });
  }

  // Render the entire scene
  render() {
    const { width, height } = this.canvas;

    // Clear canvas
    this.ctx.clearRect(0, 0, width, height);

    // Render grid if enabled
    if (this.showGrid) {
      this.renderGrid();
    }

    // Render the wave field
    this.renderWaveField();

    // Render traveling waves
    this.renderTravelingWaves();

    this.renderVelocityField();
  }

  // Render the wave field grid (energy levels) - mostly for debugging
  renderGrid() {
    const { resolution, cellWidth, cellHeight } = this.waveField;

    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        const cellX = x * cellWidth;
        const cellY = y * cellHeight;

        const cell = this.waveField.getCell(x, y);
        if (cell.energy > 0.01) {
          // Draw cell background with color and opacity based on energy
          this.ctx.fillStyle = `rgba(${cell.color[0]}, ${cell.color[1]}, ${cell.color[2]}, ${cell.energy * 0.3})`;
          this.ctx.fillRect(cellX, cellY, cellWidth, cellHeight);

          // Draw cell border
          this.ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
          this.ctx.strokeRect(cellX, cellY, cellWidth, cellHeight);
        }
      }
    }
  }

  // Render the wave field as a visualization of energy
  // In WaveRenderer.js - completely revised renderWaveField method
  renderWaveField() {
    // Get all active cells
    const activeCells = this.waveField.getActiveCells(0.015);

    // Skip if no active cells
    if (activeCells.length === 0) return;

    // Create a cell size buffer to ensure we're filling space
    const cellWidth = this.waveField.cellWidth;
    const cellHeight = this.waveField.cellHeight;

    // Render active cells as glowing circles/squares
    activeCells.forEach((item) => {
      const { cell, worldX, worldY } = item;
      const energy = cell.energy;

      if (energy <= 0.05) return;

      // Draw a glow/plasma effect
      const glowRadius =
        Math.max(cellWidth, cellHeight) * (0.5 + energy * 0.25);
      const gradient = this.ctx.createRadialGradient(
        worldX,
        worldY,
        0,
        worldX,
        worldY,
        glowRadius,
      );

      // Determine color brightness based on energy
      const brightness = energy * 255;
      const r = Math.min(255, cell.color[0] + brightness * 0.5);
      const g = Math.min(255, cell.color[1] + brightness * 0.5);
      const b = Math.min(255, cell.color[2] + brightness * 0.5);

      // Create gradient for a plasma-like effect
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${energy ** 2 * 0.25})`);
      gradient.addColorStop(
        0.7,
        `rgba(${cell.color[0]}, ${cell.color[1]}, ${cell.color[2]}, ${energy ** 2 * 0.5})`,
      );
      gradient.addColorStop(
        1,
        `rgba(${cell.color[0]}, ${cell.color[1]}, ${cell.color[2]}, 0)`,
      );

      // Draw circular glow
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(worldX, worldY, glowRadius, 0, Math.PI * 2);
      this.ctx.fill();

      // Add a subtle phase-based pulse
      const pulseSize = 2 + Math.sin(cell.phase) * 2;
      this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${energy * 0.3})`;
      this.ctx.beginPath();
      this.ctx.arc(worldX, worldY, pulseSize, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // Optional: Render energy field connections for high-energy cells
    const highEnergyCells = activeCells.filter(
      (item) => item.cell.energy >= 0.5,
    );

    if (highEnergyCells.length >= 2) {
      // Connect nearby high-energy cells with subtle energy tendrils
      for (let i = 0; i < highEnergyCells.length; i++) {
        const cell1 = highEnergyCells[i];

        for (let j = i + 1; j < highEnergyCells.length; j++) {
          const cell2 = highEnergyCells[j];

          // Calculate distance
          const dx = cell1.worldX - cell2.worldX;
          const dy = cell1.worldY - cell2.worldY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Only connect reasonably close cells
          if (distance < cellWidth * 5) {
            const energy = Math.min(cell1.cell.energy, cell2.cell.energy);
            const connectionStrength =
              Math.max(0, 1 - distance / (cellWidth * 5)) * energy;

            if (connectionStrength > 0.1) {
              // Blend the colors
              const r = Math.floor(
                (cell1.cell.color[0] + cell2.cell.color[0]) / 2,
              );
              const g = Math.floor(
                (cell1.cell.color[1] + cell2.cell.color[1]) / 2,
              );
              const b = Math.floor(
                (cell1.cell.color[2] + cell2.cell.color[2]) / 2,
              );

              // Draw energy connection
              this.ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${connectionStrength * 0.9})`;
              this.ctx.lineWidth = connectionStrength * 2;

              // Create a slightly wavy line
              this.ctx.beginPath();
              const midX = (cell1.worldX + cell2.worldX) / 2;
              const midY = (cell1.worldY + cell2.worldY) / 2;

              // Add some phase-based movement
              const offsetX =
                Math.sin(cell1.cell.phase + cell2.cell.phase) * 15;
              const offsetY =
                Math.cos(cell1.cell.phase - cell2.cell.phase) * 15;

              this.ctx.moveTo(cell1.worldX, cell1.worldY);
              this.ctx.quadraticCurveTo(
                midX + offsetX,
                midY + offsetY,
                cell2.worldX,
                cell2.worldY,
              );
              this.ctx.stroke();
            }
          }
        }
      }
    }
  }

  renderVelocityField() {
    this.ctx.lineWidth = 1;

    for (let y = 0; y < this.waveField.resolution; y++) {
      for (let x = 0; x < this.waveField.resolution; x++) {
        const cell = this.waveField.getCell(x, y);

        if (cell.energy > 0.05 && cell.velocity) {
          const { x: worldX, y: worldY } = this.waveField.gridToWorld(x, y);

          // Use a fixed scale that shows the actual vector length
          const velocityScale = 40;
          const dx = cell.velocity.x * velocityScale;
          const dy = cell.velocity.y * velocityScale;

          const velocityMagnitude = Math.sqrt(
            cell.velocity.x * cell.velocity.x +
              cell.velocity.y * cell.velocity.y,
          );

          // Only render if there's enough velocity
          if (velocityMagnitude > 0.01) {
            // Color based on magnitude - redder = stronger velocity
            const normalizedMag = Math.min(1.0, velocityMagnitude / 3.0); // 3.0 is a reasonable max
            const r = Math.floor(100 + 155 * normalizedMag);
            const g = Math.floor(255 * (1 - normalizedMag));
            const b = Math.floor(150 * (1 - normalizedMag / 2));

            // Draw velocity vector
            this.ctx.beginPath();
            this.ctx.moveTo(worldX, worldY);
            this.ctx.lineTo(worldX + dx, worldY + dy);
            this.ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${cell.energy * 0.8 + 0.2})`;
            this.ctx.stroke();

            // Draw larger arrow head
            this.ctx.beginPath();
            this.ctx.arc(worldX + dx, worldY + dy, 3, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${cell.energy * 0.8 + 0.2})`;
            this.ctx.fill();
          }
        }
      }
    }
  }

  // Get average color from a set of color arrays
  getAverageColor(colors) {
    if (colors.length === 0) return [255, 255, 255];

    const sum = [0, 0, 0];
    colors.forEach((color) => {
      sum[0] += color[0];
      sum[1] += color[1];
      sum[2] += color[2];
    });

    return [
      Math.round(sum[0] / colors.length),
      Math.round(sum[1] / colors.length),
      Math.round(sum[2] / colors.length),
    ];
  }

  renderTravelingWaves() {
    this.travelingWaves.forEach((wave) => {
      // Only render if still visible
      if (wave.intensity <= 0.01) return;

      const { position, radius, angle, spreadAngle, color, intensity } = wave;

      // For omnidirectional waves (360 degrees)
      if (spreadAngle >= 360) {
        // Draw a circle with glow effect

        // Create gradient for glow
        const gradient = this.ctx.createRadialGradient(
          position.x,
          position.y,
          radius - this.waveLineWidth,
          position.x,
          position.y,
          radius + this.waveLineWidth,
        );

        gradient.addColorStop(
          0,
          `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`,
        );
        gradient.addColorStop(
          0.5,
          `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${intensity * this.waveOpacityFactor})`,
        );
        gradient.addColorStop(
          1,
          `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`,
        );

        // Draw circle with gradient
        this.ctx.beginPath();
        this.ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
        this.ctx.lineWidth = this.waveLineWidth;
        this.ctx.strokeStyle = gradient;
        this.ctx.stroke();
      } else {
        // Draw a directional arc with glow
        const startAngle = angle - (spreadAngle * Math.PI) / 360;
        const endAngle = angle + (spreadAngle * Math.PI) / 360;

        // Draw arc
        this.ctx.beginPath();
        this.ctx.arc(position.x, position.y, radius, startAngle, endAngle);
        this.ctx.lineWidth = this.waveLineWidth;
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${intensity * this.waveOpacityFactor})`;
        this.ctx.stroke();

        // Add a small additional glow
        this.ctx.beginPath();
        this.ctx.arc(position.x, position.y, radius, startAngle, endAngle);
        this.ctx.lineWidth = this.waveLineWidth / 2;
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${intensity * this.waveOpacityFactor})`;
        this.ctx.stroke();
      }
    });
  }
}

export default WaveRenderer;
