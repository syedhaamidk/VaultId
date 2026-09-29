import { useEffect, useRef, useState } from "react";

/* Card + Badge + Alert + Skeleton + Empty + Progress + Crumbs — presentational. */

export function Card({ tag, title, corners = false, enter = false, className = "", children, ...rest }) {
  const cls = ["card", corners && "reg-corners", enter && "card-enter", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} {...rest}>
      {tag && <span className="card-tag">{tag}</span>}
      {title && <h3 className="card-title">{title}</h3>}
      {children}
    </div>
  );
}

export function Badge({ tone = "", className = "", children, ...rest }) {
  const cls = ["badge", tone && `badge-${tone}`, className].filter(Boolean).join(" ");
  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}

export function Alert({ tone = "accent", tag, className = "", children, ...rest }) {
  const cls = [`alert alert-${tone}`, className].filter(Boolean).join(" ");
  return (
    <div className={cls} role="alert" {...rest}>
      {tag && <span className="alert-tag">{tag}</span>}
      <span>{children}</span>
    </div>
  );
}

export function Skeleton({ width = "100%", height = 14, style, ...rest }) {
  return (
    <div
      className="skeleton"
      aria-hidden="true"
      style={{ width, height, ...style }}
      {...rest}
    />
  );
}

export function Empty({ tag = "// EMPTY", title, children, action }) {
  return (
    <div className="empty">
      {tag && <span className="card-tag">{tag}</span>}
      {title && <h3 className="empty-title">{title}</h3>}
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Progress({ value, label, id = "progress" }) {
  const pct = Math.max(0, Math.min(100, value));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(pct)));
    return () => cancelAnimationFrame(raf);
  }, [pct]);
  return (
    <div>
      {label && <span className="label" id={`${id}-label`}>{label}</span>}
      <div
        className="progress"
        role="progressbar"
        aria-labelledby={label ? `${id}-label` : undefined}
        aria-label={!label ? id : undefined}
        aria-valuenow={Math.round(shown)}
        aria-valuemin={0}
        aria-valuemax={100}
        style={label ? { marginTop: "var(--space-2)" } : undefined}
      >
        <i style={{ "--value": `${shown}%` }} />
      </div>
    </div>
  );
}

export function Crumbs({ trail, label = "Breadcrumb" }) {
  return (
    <nav aria-label={label}>
      <ol className="crumbs">
        {trail.map((c, i) => (
          <li key={c.label}>
            {i === trail.length - 1 || !c.href ? (
              <span aria-current="page">{c.label}</span>
            ) : (
              <a href={c.href}>{c.label}</a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
