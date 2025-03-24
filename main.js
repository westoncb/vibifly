// main.js - Entry point for Vite

// Import necessary files
import "./style.css";
import Game from "./js/Game.js";

// Wait for DOM to load
document.addEventListener("DOMContentLoaded", () => {
  const startButton = document.getElementById("startButton");
  let game;

  // Start button click handler
  startButton.addEventListener("click", () => {
    // Hide the button
    startButton.style.display = "none";

    // Initialize the game
    game = new Game("gameCanvas");

    // Start the game
    game.start();

    // Ensure audio context is started (needs user interaction)
    if (game.audioRenderer.audioContext.state === "suspended") {
      game.audioRenderer.audioContext.resume();
    }
  });
});
