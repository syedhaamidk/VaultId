import { useEffect, useRef, useState } from "react";

function reducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* AnimatedNumber — eased count between values (ease-out cubic).
   Jumps straight to the value under prefers-reduced-motion. */
export default function AnimatedNumber({
  value,
  decimals = 0,
  duration = 1200,
  prefix = "",
  suffix = "",
  className = "",
}) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (reducedMotion() || duration <= 0) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    let raf = 0;
    const t0 = performance.now();
    const frame = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(frame);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      fromRef.current = value;
    };
  }, [value, duration]);

  const text = display.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <span className={`mono ${className}`.trim()}>
      {prefix}
      {text}
      {suffix}
    </span>
  );
}
