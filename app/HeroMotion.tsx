"use client";

import { useEffect } from "react";

export default function HeroMotion() {
  useEffect(() => {
    const hero = document.querySelector<HTMLElement>(".nxHeroV5");
    if (!hero || window.matchMedia("(pointer: coarse)").matches) return;

    const move = (event: PointerEvent) => {
      const bounds = hero.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
      hero.style.setProperty("--nx-mouse-x", x.toFixed(3));
      hero.style.setProperty("--nx-mouse-y", y.toFixed(3));
    };
    const reset = () => {
      hero.style.setProperty("--nx-mouse-x", "0");
      hero.style.setProperty("--nx-mouse-y", "0");
    };

    hero.addEventListener("pointermove", move, { passive: true });
    hero.addEventListener("pointerleave", reset);
    return () => {
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerleave", reset);
    };
  }, []);

  return null;
}
