import { useEffect, useRef, useState } from "react";

/* Reveal — scroll-triggered entrance for React trees (the vanilla kit uses
   .reveal-on-scroll + .js-reveals instead). Stagger via delay (ms). */
export default function Reveal({ as: Tag = "div", delay = 0, className = "", children, ...rest }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { setInView(true); return; }
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); io.disconnect(); } },
      { rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`${inView ? "reveal" : ""} ${className}`.trim()}
      style={inView && delay ? { animationDelay: `${delay}ms` } : { opacity: inView ? undefined : 0 }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
