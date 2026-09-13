"use client";

import { useEffect } from "react";

export default function ScrollReveal() {
  useEffect(() => {
    const selectors = [
      ".nxHeroCopy",
      ".nxTrustCard",
      ".marketSectionHead",
      ".marketCategoryTile",
      ".marketProductCard",
      ".nxHowCard",
      ".nxSecurityCopy",
      ".nxSecurityVisual",
      ".nxDiscordCopy",
      ".nxDiscordBackdrop",
      ".nxFooter > div",
      ".categoryMarketHero",
      ".categoryProductCard",
      ".categoryAssuranceV5 > div",
      ".checkoutSideV5",
      ".checkoutCard"
    ];

    const nodes = Array.from(document.querySelectorAll<HTMLElement>(selectors.join(",")));

    nodes.forEach((element, index) => {
      element.classList.add("nxReveal");
      const parent = element.parentElement;
      if (parent && parent.children.length > 1) {
        const siblingIndex = Array.from(parent.children).indexOf(element);
        element.style.setProperty("--reveal-delay", `${Math.min(siblingIndex * 65, 360)}ms`);
      } else {
        element.style.setProperty("--reveal-delay", `${Math.min(index * 18, 140)}ms`);
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
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" }
    );

    nodes.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return null;
}
