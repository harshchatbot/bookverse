import confetti from "canvas-confetti";

// BookVerse Nature palette — sage, sand, primary glow, success green, cream
const PALETTE = ["#7C9A6D", "#D6B37F", "#A8C29A", "#4F8A5B", "#F3F0E8"];

export function celebrate() {
  const defaults = {
    colors: PALETTE,
    scalar: 0.9,
    ticks: 200,
    disableForReducedMotion: true,
  };

  confetti({
    ...defaults,
    particleCount: 80,
    spread: 70,
    startVelocity: 45,
    origin: { x: 0.5, y: 0.6 },
  });

  setTimeout(() => {
    confetti({
      ...defaults,
      particleCount: 40,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
    });
    confetti({
      ...defaults,
      particleCount: 40,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
    });
  }, 180);
}
