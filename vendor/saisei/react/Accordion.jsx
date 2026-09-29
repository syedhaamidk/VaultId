import { useRef, useState } from "react";

/* Accordion — items: [{ id, title, content }]. Panel height is measured
   per item so the open animation always fits the content exactly. */
export default function Accordion({ items, allowMultiple = false, defaultOpen = [] }) {
  const [open, setOpen] = useState(defaultOpen);
  const bodies = useRef({});
  const toggle = (id) => {
    setOpen((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : allowMultiple
          ? [...prev, id]
          : [id]
    );
  };
  return (
    <div>
      {items.map((item) => {
        const expanded = open.includes(item.id);
        const h = bodies.current[item.id]?.scrollHeight;
        return (
          <div className="accordion-item" key={item.id}>
            <button
              className="accordion-trigger"
              aria-expanded={expanded}
              aria-controls={`acc-${item.id}`}
              id={`acc-btn-${item.id}`}
              onClick={() => toggle(item.id)}
            >
              {item.title}
              <span className="chev">+</span>
            </button>
            <div
              className="accordion-panel"
              id={`acc-${item.id}`}
              role="region"
              aria-labelledby={`acc-btn-${item.id}`}
              style={{ maxHeight: expanded && h ? `${h}px` : "0px" }}
            >
              <div
                className="accordion-panel-inner"
                ref={(el) => { bodies.current[item.id] = el; }}
              >
                {item.content}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
