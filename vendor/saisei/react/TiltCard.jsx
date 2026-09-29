import { useRef } from "react";

function reducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* TiltCard — pointer-tracked 3D tilt with glare sweep and spotlight.
   max: degrees at the edges. glare/spotlight toggles. Still life when
   the user prefers reduced motion (or on touch pointers). */
export default function TiltCard({
  children,
  max = 8,
  glare = true,
  spotlight = true,
  className = "",
  ...rest
}) {
  const ref = useRef(null);
  const innerRef = useRef(null);
  const raf = useRef(0);

  const onMove = (e) => {
    if (reducedMotion() || e.pointerType === "touch") return;
    const el = ref.current;
    const inner = innerRef.current;
    if (!el || !inner) return;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / Math.max(1, r.width);
      const py = (e.clientY - r.top) / Math.max(1, r.height);
      inner.style.setProperty("--ry", ((px - 0.5) * max * 2).toFixed(2) + "deg");
      inner.style.setProperty("--rx", ((0.5 - py) * max * 2).toFixed(2) + "deg");
      el.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
      el.style.setProperty("--my", (py * 100).toFixed(1) + "%");
    });
  };

  const onLeave = () => {
    cancelAnimationFrame(raf.current);
    const inner = innerRef.current;
    if (inner) {
      inner.style.setProperty("--rx", "0deg");
      inner.style.setProperty("--ry", "0deg");
    }
  };

  return (
    <div
      ref={ref}
      className={`tilt ${className}`.trim()}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      {...rest}
    >
      <div ref={innerRef} className={`tilt-inner${glare ? " tilt-glare" : ""}${spotlight ? " spotlight" : ""}`}>
        {children}
      </div>
    </div>
  );
}
