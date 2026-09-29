import { useEffect, useRef } from "react";

/* DrawOn — SVG schematic that sketches itself. Children must be SVG
   path/circle/line shapes; each is measured and staggered on reveal.
   played: controlled mode (default: plays on scroll into view). */
export default function DrawOn({ children, played, width = "100%", height = 72, label }) {
  const ref = useRef(null);

  useEffect(() => {
    const scope = ref.current;
    if (!scope) return;
    const shapes = scope.querySelectorAll("path, circle, line");
    shapes.forEach((s, i) => {
      try {
        const len = s.getTotalLength();
        s.style.strokeDasharray = String(len);
        s.style.strokeDashoffset = String(len);
        s.style.setProperty("--draw-delay", `${i * 120}ms`);
      } catch (e) { /* non-geometry shape — leave static */ }
    });
    if (played === undefined && !("IntersectionObserver" in window)) {
      scope.classList.add("drawn");
      return;
    }
    if (played !== undefined) {
      if (played) scope.classList.add("drawn");
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          requestAnimationFrame(() => scope.classList.add("drawn"));
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(scope);
    return () => io.disconnect();
  }, [played]);

  return (
    <svg
      ref={ref}
      data-draw
      width={width}
      height={height}
      viewBox="0 0 220 72"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {children}
    </svg>
  );
}
