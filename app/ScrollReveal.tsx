"use client";

import { useEffect } from "react";

export default function ScrollReveal() {
  useEffect(() => {
    const selectors = [
      ".nxHeroCopy",
      ".nxHeroArt",
      ".nxCat",
      ".nxSectionTitle",
      ".nxProduct",
      ".nxBenefits > div",
      ".nxDiscordCopy",
      ".nxDiscordVisual",
      ".nxFooter > div",
      ".categoryMarketHero",
      ".categoryProductCard",
      ".marketSectionHead"
    ];

    const nodes = Array.from(document.querySelectorAll<HTMLElement>(selectors.join(",")));

    nodes.forEach((el, index) => {
      el.classList.add("nxReveal");
      const parent = el.parentElement;
      if (parent && Array.from(parent.children).filter(c => c.classList.contains(el.classList[0])).length > 1) {
        const siblingIndex = Array.from(parent.children).indexOf(el);
        el.style.setProperty("--reveal-delay", `${Math.min(siblingIndex * 70, 420)}ms`);
      } else {
        el.style.setProperty("--reveal-delay", `${Math.min(index * 20, 160)}ms`);
      }
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("nxRevealVisible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -7% 0px" }
    );

    nodes.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return null;
}
