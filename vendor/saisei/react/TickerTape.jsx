/* TickerTape — infinite scrolling quote strip. Duplicates the list so the
   -50% CSS loop in .ticker-tape-track is seamless. Pauses on hover/focus. */
export default function TickerTape({ items, label = "Market ticker" }) {
  const half = items.map((q, i) => (
    <span className="ticker-tape-item" key={`${q.symbol}-${i}`}>
      <strong>{q.symbol}</strong> {q.price}{" "}
      <span className={q.up ? "up" : "down"}>{q.change}</span>
    </span>
  ));
  return (
    <div className="ticker-tape" role="marquee" aria-label={label}>
      <div className="ticker-tape-track">
        {half}
        {half.map((el, i) =>
          // clone with fresh keys for the second loop half
          ({ ...el, key: `dup-${i}` })
        )}
      </div>
    </div>
  );
}
