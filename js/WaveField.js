// WaveField.js - Handles the wave field data and its evolution

class WaveField {
  constructor(width, height, resolution = 64) {
    this.width = width;
    this.height = height;
    this.resolution = resolution;

    // Calculate cell dimensions
    this.cellWidth = width / resolution;
    this.cellHeight = height / resolution;

    // Initialize the grid
    this.grid = new Array(resolution * resolution).fill().map(() => ({
      energy: 0, // Current energy level (0-1)
      frequency: 440, // Base frequency in Hz
      color: [0, 0, 0], // RGB color values
      lastActive: 0, // Timestamp of last activity
      phase: 0, // Current phase (0-2π)
      velocity: { x: 0, y: 0 }, // Initialize velocity for all cells
    }));
    // Field properties
    this.decayRate = 0.98; // Energy decay per frame
    this.propagationSpeed = 0.3; // How quickly energy propagates to neighbors
    this.timeStep = 0; // Current time step
    this.maxVelocity = 5.0;
  }

  // Get cell at specific grid coordinates
  getCell(x, y) {
    if (x < 0 || x >= this.resolution || y < 0 || y >= this.resolution) {
      return null;
    }
    return this.grid[y * this.resolution + x];
  }

  // Get cell at world coordinates
  getCellAtPosition(worldX, worldY) {
    const gridX = Math.floor(worldX / this.cellWidth);
    const gridY = Math.floor(worldY / this.cellHeight);
    return this.getCell(gridX, gridY);
  }

  // Convert grid coordinates to world position
  gridToWorld(gridX, gridY) {
    return {
      x: gridX * this.cellWidth + this.cellWidth / 2,
      y: gridY * this.cellHeight + this.cellHeight / 2,
    };
  }

  // Convert world coordinates to grid position
  worldToGrid(worldX, worldY) {
    return {
      x: Math.floor(worldX / this.cellWidth),
      y: Math.floor(worldY / this.cellHeight),
    };
  }

  // Add energy to a specific cell in the grid
  addEnergy(gridX, gridY, amount, frequency, color) {
    const cell = this.getCell(gridX, gridY);
    if (!cell) return;

    // Blend the new energy with existing energy
    const currentEnergy = cell.energy;
    const newEnergy = Math.min(1.0, currentEnergy + amount);

    // If we're adding significant energy, blend the frequency and color
    if (amount > 0.05) {
      const blendFactor = amount / (currentEnergy + amount);

      // Blend frequency (weighted by energy)
      cell.frequency =
        cell.frequency * (1 - blendFactor) + frequency * blendFactor;

      // Blend color
      for (let i = 0; i < 3; i++) {
        cell.color[i] = Math.round(
          cell.color[i] * (1 - blendFactor) + color[i] * blendFactor,
        );
      }
    }

    cell.energy = newEnergy;
    cell.lastActive = this.timeStep;
  }

  // Add a wave pulse to the field
  addWavePulse(
    worldX,
    worldY,
    radius,
    intensity,
    frequency,
    color,
    angle = 0,
    spreadAngle = 360,
  ) {
    angle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

    // Convert to grid coordinates for center
    const centerGridPos = this.worldToGrid(worldX, worldY);

    // Calculate the radius in grid cells
    const gridRadius = Math.ceil(radius / this.cellWidth);

    // Calculate directional velocity components based on angle
    const velocityFactor = 2.0; // How strongly the direction affects cell velocity
    const velocityX = Math.cos(angle) * velocityFactor;
    const velocityY = Math.sin(angle) * velocityFactor;

    // Scan grid cells that might be affected
    for (
      let y = centerGridPos.y - gridRadius;
      y <= centerGridPos.y + gridRadius;
      y++
    ) {
      for (
        let x = centerGridPos.x - gridRadius;
        x <= centerGridPos.x + gridRadius;
        x++
      ) {
        if (x < 0 || x >= this.resolution || y < 0 || y >= this.resolution)
          continue;

        // Get world position of this cell center
        const cellWorld = this.gridToWorld(x, y);

        // Calculate distance from wave origin to cell center
        const dx = cellWorld.x - worldX;
        const dy = cellWorld.y - worldY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check if within radius
        if (distance <= radius) {
          // For directional waves, check if the cell is within the cone
          let isInDirection = true;
          let directionFactor = 1.0;

          if (spreadAngle < 360) {
            // Calculate angle to this cell
            const cellAngle = Math.atan2(dy, dx);

            // Calculate angle difference
            let angleDiff = Math.abs(cellAngle - angle);
            // Normalize angle difference
            if (angleDiff > Math.PI) {
              angleDiff = 2 * Math.PI - angleDiff;
            }

            // Check if within spread angle
            const halfSpread = (spreadAngle * Math.PI) / 360;
            isInDirection = angleDiff <= halfSpread;

            // Direction factor - strongest at center of beam
            directionFactor = isInDirection ? 1 - angleDiff / halfSpread : 0;
          }

          if (isInDirection) {
            // Calculate intensity based on distance (stronger at wave front)
            const waveThickness = radius * 0.2;
            const distFromWaveFront = Math.abs(distance - radius);

            if (distFromWaveFront < waveThickness) {
              const intensityFactor = 1 - distFromWaveFront / waveThickness;
              const cellIntensity = intensity * intensityFactor;

              // Get the cell directly
              const cell = this.grid[y * this.resolution + x];

              // Update cell energy directly
              const currentEnergy = cell.energy;
              const newEnergy = Math.min(1.0, currentEnergy + cellIntensity);

              // Calculate directional velocity
              const vx = velocityX * cellIntensity * directionFactor;
              const vy = velocityY * cellIntensity * directionFactor;

              // Blend with existing velocity (weighted by energy)
              if (!cell.velocity) cell.velocity = { x: 0, y: 0 };

              // Only update velocity if this is a significant energy contribution
              if (cellIntensity > 0.1) {
                const blendFactor = cellIntensity / (newEnergy || 1);
                cell.velocity.x =
                  cell.velocity.x * (1 - blendFactor) + vx * blendFactor;
                cell.velocity.y =
                  cell.velocity.y * (1 - blendFactor) + vy * blendFactor;
              }

              // Set the other properties
              if (cellIntensity > 0.05) {
                const blendFactor = cellIntensity / newEnergy;

                // Blend frequency (weighted by energy)
                cell.frequency =
                  cell.frequency * (1 - blendFactor) + frequency * blendFactor;

                // Blend color
                for (let i = 0; i < 3; i++) {
                  cell.color[i] = Math.round(
                    cell.color[i] * (1 - blendFactor) + color[i] * blendFactor,
                  );
                }
              }

              cell.energy = newEnergy;
              cell.lastActive = this.timeStep;
            }
          }
        }
      }
    }
  }

  update(deltaTime) {
    this.timeStep++;

    // Create a new grid with deep-copied properties
    const newGrid = this.grid.map((cell) => ({
      ...cell,
      velocity: cell.velocity ? { ...cell.velocity } : { x: 0, y: 0 },
    }));

    for (let y = 0; y < this.resolution; y++) {
      for (let x = 0; x < this.resolution; x++) {
        const cellIndex = y * this.resolution + x;
        const cell = this.grid[cellIndex];

        // IMPORTANT CHANGE: Process ALL cells with velocity, not just those with energy
        // This ensures we decay velocity even for cells that have lost their energy

        // Update phase if there's energy
        if (cell.energy > 0.01) {
          cell.phase =
            (cell.phase + (deltaTime * cell.frequency) / 20) % (Math.PI * 2);
        }

        // Calculate the new energy after decay
        const newEnergy =
          cell.energy * Math.pow(this.decayRate, deltaTime * 60);
        newGrid[cellIndex].energy = newEnergy;

        // Always process velocity, even for cells with no energy
        if (cell.velocity && (cell.velocity.x !== 0 || cell.velocity.y !== 0)) {
          // For cells with energy, link velocity decay to energy
          if (cell.energy > 0.01) {
            const energyRatio = newEnergy / cell.energy;
            newGrid[cellIndex].velocity.x = cell.velocity.x * energyRatio;
            newGrid[cellIndex].velocity.y = cell.velocity.y * energyRatio;
          } else {
            // For cells with no energy but still having velocity,
            // apply a MUCH stronger decay
            newGrid[cellIndex].velocity.x = cell.velocity.x * 0.8;
            newGrid[cellIndex].velocity.y = cell.velocity.y * 0.8;
          }

          // If velocity becomes very small, zero it out
          const velMagnitude = Math.sqrt(
            newGrid[cellIndex].velocity.x * newGrid[cellIndex].velocity.x +
              newGrid[cellIndex].velocity.y * newGrid[cellIndex].velocity.y,
          );

          if (velMagnitude < 0.01) {
            newGrid[cellIndex].velocity.x = 0;
            newGrid[cellIndex].velocity.y = 0;
          }
        }

        // If energy is practically zero, reset it completely
        if (newGrid[cellIndex].energy < 0.01) {
          newGrid[cellIndex].energy = 0;
        }
      }
    }

    // Update grid with new values
    this.grid = newGrid;
  }

  // Get all active cells (for rendering or audio)
  getActiveCells(threshold = 0.05) {
    return this.grid
      .map((cell, index) => ({
        cell,
        index,
        x: index % this.resolution,
        y: Math.floor(index / this.resolution),
        worldX: (index % this.resolution) * this.cellWidth + this.cellWidth / 2,
        worldY:
          Math.floor(index / this.resolution) * this.cellHeight +
          this.cellHeight / 2,
      }))
      .filter((item) => item.cell.energy > threshold);
  }

  // Clear the wave field
  clear() {
    this.grid.forEach((cell) => {
      cell.energy = 0;
      cell.frequency = 440;
      cell.color = [0, 0, 0];
      cell.phase = 0;
    });
  }
}

export default WaveField;
