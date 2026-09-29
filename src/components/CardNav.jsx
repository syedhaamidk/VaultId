import { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ArrowUpRight } from 'lucide-react'; // replaces react-icons GoArrowUpRight
import './CardNav.css';

const CardNav = ({
  /** Pass a string URL for an <img> logo, or a React element to render directly. */
  logo,
  logoAlt       = 'Logo',
  items         = [],
  className     = '',
  ease          = 'power3.out',
  baseColor,          // unused in dark theme (bg set via CSS)
  menuColor,
  buttonBgColor,
  buttonTextColor,
  /** Called when the CTA button is clicked. */
  onCTA,
}) => {
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isExpanded,      setIsExpanded]      = useState(false);
  const navRef   = useRef(null);
  const cardsRef = useRef([]);
  const tlRef    = useRef(null);

  const calculateHeight = () => {
    const navEl = navRef.current;
    if (!navEl) return 260;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
      const contentEl = navEl.querySelector('.card-nav-content');
      if (contentEl) {
        const prev = {
          visibility:    contentEl.style.visibility,
          pointerEvents: contentEl.style.pointerEvents,
          position:      contentEl.style.position,
          height:        contentEl.style.height,
        };
        contentEl.style.visibility    = 'visible';
        contentEl.style.pointerEvents = 'auto';
        contentEl.style.position      = 'static';
        contentEl.style.height        = 'auto';
        contentEl.offsetHeight; // force reflow
        const contentHeight = contentEl.scrollHeight;
        Object.assign(contentEl.style, prev);
        return 60 + contentHeight + 16;
      }
    }
    return 260;
  };

  const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const createTimeline = () => {
    const navEl = navRef.current;
    if (!navEl) return null;
    if (reduceMotion) {
      // Skip animation — just show the content.
      navEl.style.height = 'auto';
      navEl.style.overflow = 'visible';
      cardsRef.current.forEach((card) => { if (card) { card.style.transform = 'none'; card.style.opacity = '1'; } });
      return null;
    }
    gsap.set(navEl,            { height: 60, overflow: 'hidden' });
    gsap.set(cardsRef.current, { y: 50, opacity: 0 });
    const tl = gsap.timeline({ paused: true });
    tl.to(navEl, { height: calculateHeight, duration: 0.4, ease });
    tl.to(cardsRef.current, { y: 0, opacity: 1, duration: 0.4, ease, stagger: 0.08 }, '-=0.1');
    return tl;
  };

  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;
    return () => { tl?.kill(); tlRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ease, items]);

  useLayoutEffect(() => {
    const handleResize = () => {
      if (!tlRef.current) return;
      if (isExpanded) {
        const newHeight = calculateHeight();
        gsap.set(navRef.current, { height: newHeight });
        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) { newTl.progress(1); tlRef.current = newTl; }
      } else {
        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) tlRef.current = newTl;
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  const toggleMenu = () => {
    const tl = tlRef.current;
    if (!tl) return;
    if (!isExpanded) {
      setIsHamburgerOpen(true);
      setIsExpanded(true);
      tl.play(0);
    } else {
      setIsHamburgerOpen(false);
      tl.eventCallback('onReverseComplete', () => setIsExpanded(false));
      tl.reverse();
    }
  };

  const closeMenu = () => {
    if (!isExpanded) return;
    setIsHamburgerOpen(false);
    setIsExpanded(false);
    tlRef.current?.reverse();
  };

  const setCardRef = (i) => (el) => { if (el) cardsRef.current[i] = el; };

  return (
    <div className={`card-nav-container ${className}`}>
      <nav
        ref={navRef}
        className={`card-nav ${isExpanded ? 'open' : ''}`}
      >
        {/* ── Top bar ── */}
        <div className="card-nav-top">
          <div
            className={`hamburger-menu ${isHamburgerOpen ? 'open' : ''}`}
            onClick={toggleMenu}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMenu(); } }}
            role="button"
            aria-label={isExpanded ? 'Close menu' : 'Open menu'}
            aria-expanded={isExpanded}
            tabIndex={0}
            style={{ color: menuColor }}
          >
            <div className="hamburger-line" />
            <div className="hamburger-line" />
          </div>

          <div className="logo-container">
            {typeof logo === 'string'
              ? <img src={logo} alt={logoAlt} className="logo" />
              : logo /* allow passing a React element as logo */
            }
          </div>

          <button
            type="button"
            className="card-nav-cta-button"
            style={{
              backgroundColor: buttonBgColor  || undefined,
              color:           buttonTextColor || undefined,
            }}
            onClick={onCTA}
          >
            Open Vault
          </button>
        </div>

        {/* ── Expanded cards ── */}
        <div className="card-nav-content" aria-hidden={!isExpanded}>
          {(items || []).slice(0, 3).map((item, idx) => (
            <div
              key={`${item.label}-${idx}`}
              className="nav-card"
              ref={setCardRef(idx)}
              style={{ backgroundColor: item.bgColor, color: item.textColor }}
            >
              <div className="nav-card-label">{item.label}</div>
              <div className="nav-card-links">
                {(item.links || []).map((lnk, i) => (
                  <a
                    key={`${lnk.label}-${i}`}
                    className="nav-card-link"
                    href={lnk.href || '#features'}
                    tabIndex={isExpanded ? 0 : -1}
                    onClick={closeMenu}
                    aria-label={lnk.ariaLabel}
                    style={{ color: item.textColor }}
                  >
                    <ArrowUpRight className="nav-card-link-icon" aria-hidden="true" size={13} />
                    {lnk.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default CardNav;
