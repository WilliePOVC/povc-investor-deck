/* ═══════════════════════════════════════════════════════════════
   PRESS ON VENTURES — Interactive Deck · main.js
   Handles: scroll animations, count-up, donut charts, nav
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── UTILS ─────────────────────────────────────────────────── */
const qs  = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeOutExpo  = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

/* ── SMOOTH SCROLL ─────────────────────────────────────────── */
function initSmoothScroll() {
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const target = document.getElementById(link.getAttribute('href').slice(1));
    if (!target) return;
    e.preventDefault();
    const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'), 10) || 64;
    const top  = target.getBoundingClientRect().top + window.scrollY - navH;
    window.scrollTo({ top, behavior: 'smooth' });

    // Close mobile nav if open
    const navLinks = qs('#nav-links');
    if (navLinks) navLinks.classList.remove('open');
  });
}

/* ── MOBILE NAV TOGGLE ─────────────────────────────────────── */
function initMobileNav() {
  const toggle = qs('#nav-toggle');
  const links  = qs('#nav-links');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => links.classList.toggle('open'));
}

/* ── TOP NAV SCROLL STYLE ──────────────────────────────────── */
function initNavScroll() {
  const nav = qs('#top-nav');
  if (!nav) return;
  const update = () => nav.classList.toggle('nav-scrolled', window.scrollY > 40);
  window.addEventListener('scroll', update, { passive: true });
  update();
}

/* ── ACTIVE NAV LINK ───────────────────────────────────────── */
function initActiveNav() {
  const sections = qsa('section[id]');
  const navLinks  = qsa('#nav-links a');

  const update = () => {
    const navH  = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'), 10) || 64;
    const mid   = navH + window.innerHeight * 0.35;
    let active  = sections[0];

    sections.forEach(sec => {
      const rect = sec.getBoundingClientRect();
      if (rect.top <= mid) active = sec;
    });

    navLinks.forEach(a => {
      const href = a.getAttribute('href').slice(1);
      a.classList.toggle('active', active && active.id === href);
    });
  };

  window.addEventListener('scroll', update, { passive: true });
  update();
}

/* ── FLOATING NAV DOTS ─────────────────────────────────────── */
function initNavDots() {
  const dots    = qsa('#nav-dots .dot');
  const sections = qsa('section[id]');

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      const id     = dot.dataset.target;
      const target = document.getElementById(id);
      if (!target) return;
      const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'), 10) || 64;
      const top  = target.getBoundingClientRect().top + window.scrollY - navH;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  const updateDots = () => {
    const navH  = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'), 10) || 64;
    const mid   = navH + window.innerHeight * 0.4;
    let activeId = sections[0] ? sections[0].id : '';

    sections.forEach(sec => {
      if (sec.getBoundingClientRect().top <= mid) activeId = sec.id;
    });

    dots.forEach(dot => dot.classList.toggle('active', dot.dataset.target === activeId));
  };

  window.addEventListener('scroll', updateDots, { passive: true });
  updateDots();
}

/* ── INTERSECTION OBSERVER (AOS) ───────────────────────────── */
function initAOS() {
  const els = qsa('.aos');
  if (!els.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el    = entry.target;
      const delay = parseInt(el.dataset.delay || '0', 10);
      setTimeout(() => el.classList.add('visible'), delay);
      observer.unobserve(el);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  els.forEach(el => observer.observe(el));
}

/* ── COUNT-UP ANIMATION ────────────────────────────────────── */
const animatedCounters = new WeakSet();

function animateCounter(el) {
  if (animatedCounters.has(el)) return;
  animatedCounters.add(el);

  const target   = parseFloat(el.dataset.target);
  const prefix   = el.dataset.prefix  ?? '';
  const suffix   = el.dataset.suffix  ?? '';
  const duration = 1600;
  const start    = performance.now();
  const isFloat  = !Number.isInteger(target);

  const frame = now => {
    const elapsed  = Math.min(now - start, duration);
    const progress = easeOutExpo(elapsed / duration);
    const current  = target * progress;
    const display  = isFloat ? current.toFixed(1) : Math.round(current);
    el.textContent = `${prefix}${display}${suffix}`;
    if (elapsed < duration) requestAnimationFrame(frame);
    else el.textContent = `${prefix}${target}${suffix}`;
  };

  requestAnimationFrame(frame);
}

function initCountUps() {
  const els = qsa('.count-up');
  if (!els.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      animateCounter(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.3 });

  els.forEach(el => observer.observe(el));
}

/* ── DONUT CHART ANIMATION ─────────────────────────────────── */
// SVG circle r=48 → circumference = 2 * π * 48 ≈ 301.59
const CIRC = 2 * Math.PI * 48;

const animatedDonuts = new WeakSet();

function animateDonut(ring, targetPercent) {
  if (animatedDonuts.has(ring)) return;
  animatedDonuts.add(ring);

  const targetDash = (targetPercent / 100) * CIRC;
  const duration   = 1600;
  const start      = performance.now();

  const frame = now => {
    const elapsed  = Math.min(now - start, duration);
    const progress = easeOutExpo(elapsed / duration);
    const current  = targetDash * progress;
    ring.setAttribute('stroke-dasharray', `${current.toFixed(2)} ${CIRC}`);
    if (elapsed < duration) requestAnimationFrame(frame);
    else ring.setAttribute('stroke-dasharray', `${targetDash.toFixed(2)} ${CIRC}`);
  };

  requestAnimationFrame(frame);
}

function initDonuts() {
  const charts = qsa('.donut-chart');
  if (!charts.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const chart   = entry.target;
      const percent = parseFloat(chart.dataset.percent || '0');
      const ring    = chart.querySelector('.donut-ring');
      const valEl   = chart.querySelector('.donut-val.count-up');

      if (ring) {
        setTimeout(() => animateDonut(ring, percent), 200);
      }
      if (valEl && !animatedCounters.has(valEl)) {
        setTimeout(() => animateCounter(valEl), 200);
      }
      observer.unobserve(chart);
    });
  }, { threshold: 0.3 });

  charts.forEach(c => observer.observe(c));
}

/* ── FUND BAR CHART ANIMATION ──────────────────────────────── */
function initFundBar() {
  const segments = qsa('.fund-bar-segment');
  if (!segments.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('animated');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.4 });

  segments.forEach(s => observer.observe(s));
}

/* ── PARALLAX BACKGROUNDS ──────────────────────────────────── */
function initParallax() {
  const coverGrid = qs('.cover-bg-grid');
  const contactAcc = qs('.contact-bg-accent');
  if (!coverGrid && !contactAcc) return;

  let ticking = false;

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const sy = window.scrollY;

      if (coverGrid) {
        coverGrid.style.transform = `translateY(${sy * 0.25}px)`;
      }

      if (contactAcc) {
        const section = qs('#contact');
        if (section) {
          const rect   = section.getBoundingClientRect();
          const offset = rect.top * 0.15;
          contactAcc.style.transform = `translateY(${offset}px)`;
        }
      }

      ticking = false;
    });
  }, { passive: true });
}

/* ── PORTFOLIO CARD STAGGER ────────────────────────────────── */
// AOS handles this via data-delay per card, but we can also
// reset delays for the featured wide card sections.
function initCardStagger() {
  // Already handled by data-delay attributes on .aos elements
  // This function is a hook for future enhancements
}

/* ── COVER HERO STATS — immediate counters ─────────────────── */
// Cover stats are just static text (no count-up needed on cover
// since they load on page open — keep them clean and fast)

/* ── NAV DOT DARK/LIGHT SWITCH ─────────────────────────────── */
function initDotColors() {
  const darkSections  = ['cover', 'thesis', 'team', 'contact'];
  const lightSections = ['mission', 'opportunity', 'fund-design', 'portfolio-snapshot',
                         'portfolio-health', 'portfolio-travel', 'spv',
                         'co-investors', 'meet-team',
                         'venture-partners', 'lp-terms'];

  const dotsEl = qs('#nav-dots');
  if (!dotsEl) return;

  const allSections = qsa('section[id]');

  const update = () => {
    const navH  = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'), 10) || 64;
    const mid   = navH + window.innerHeight * 0.4;
    let activeId = allSections[0] ? allSections[0].id : '';
    allSections.forEach(sec => {
      if (sec.getBoundingClientRect().top <= mid) activeId = sec.id;
    });

    if (lightSections.includes(activeId)) {
      dotsEl.style.setProperty('--dot-color', 'rgba(41,41,41,0.3)');
      qsa('#nav-dots .dot').forEach(d => {
        d.style.background = d.classList.contains('active')
          ? 'rgba(41,41,41,0.8)'
          : 'rgba(41,41,41,0.2)';
      });
    } else {
      qsa('#nav-dots .dot').forEach(d => {
        d.style.background = '';
      });
    }
  };

  window.addEventListener('scroll', update, { passive: true });
  update();
}

/* ── SECTION INDICATOR TOOLTIP ─────────────────────────────── */
// Dot title attributes serve as tooltips via CSS ::before

/* ── INIT ──────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initSmoothScroll();
  initMobileNav();
  initNavScroll();
  initActiveNav();
  initNavDots();
  initAOS();
  initCountUps();
  initDonuts();
  initFundBar();
  initParallax();
  initDotColors();
});

// ── Enhanced animations: observe additional elements ──
(function() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.15 });

  // Observe new animation classes
  document.querySelectorAll('.aos-scale, .aos-left, .aos-right, .fp-donut-wrap, .title-rule').forEach(el => {
    observer.observe(el);
  });

  // Add stagger-children to grids
  document.querySelectorAll('.pco-grid-5, .coinvestors-logo-grid, .meet-team-grid, .vp-grid-6, .fp-legend').forEach(el => {
    el.classList.add('stagger-children');
  });

  // Add counted class after counter animation
  document.querySelectorAll('.count-up').forEach(el => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setTimeout(() => el.classList.add('counted'), 1500);
        }
      });
    }, { threshold: 0.5 });
    obs.observe(el);
  });
})();

// ── Capital deployment animations ──
(function() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.2 });

  // Observe fund performance elements
  document.querySelectorAll('.fp-raise-strip, .fp-legend').forEach(el => {
    observer.observe(el);
  });
})();

// ── Capital deployment breakdown stagger animations ──
(function() {
  const items = document.querySelectorAll('.cd-anim');
  if (!items.length) return;

  // Transfer inline widths to CSS custom properties (CSS handles the 0 → target transition)
  document.querySelectorAll('.cd-row-meter-fill').forEach(fill => {
    fill.style.setProperty('--meter-w', fill.style.width || '0%');
    fill.style.removeProperty('width');
  });

  // Fund raise bar: same approach
  const raiseBar = document.querySelector('.cd-raise');
  if (raiseBar) {
    const raiseFill = raiseBar.querySelector('.cd-raise-fill');
    if (raiseFill) {
      raiseFill.style.setProperty('--raise-w', raiseFill.style.width || '0%');
      raiseFill.style.removeProperty('width');
    }
    const raiseObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          raiseBar.classList.add('cd-bar-visible');
          raiseObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    raiseObs.observe(raiseBar);
  }

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = parseInt(entry.target.dataset.cdDelay || '0', 10);
        setTimeout(() => entry.target.classList.add('cd-visible'), delay);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  items.forEach(el => obs.observe(el));
})();

// ── Donut spin + segment draw-in animation ──
(function() {
  const wrap = document.querySelector('.cd-donut-wrap');
  if (!wrap) return;
  const svg = wrap.querySelector('.cd-donut');
  const segments = wrap.querySelectorAll('.cd-donut-invested, .cd-donut-reserves, .cd-donut-dry, .cd-donut-fees');

  // Store real dasharray/offset values, then zero them
  const segData = [];
  segments.forEach(seg => {
    segData.push({
      el: seg,
      da: seg.getAttribute('stroke-dasharray'),
      offset: seg.getAttribute('stroke-dashoffset')
    });
    seg.setAttribute('stroke-dasharray', '0 691.15');
    seg.setAttribute('stroke-dashoffset', '0');
  });

  // Remove per-segment rotate transforms (we'll rotate the whole SVG)
  segments.forEach(seg => seg.removeAttribute('transform'));

  // Set initial SVG rotation
  svg.style.transform = 'rotate(-450deg)';
  svg.style.transition = 'transform 1.6s cubic-bezier(0.22, 1, 0.36, 1)';

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Spin the donut
        svg.style.transform = 'rotate(-90deg)';
        // Draw each segment with stagger
        segData.forEach((s, i) => {
          setTimeout(() => {
            s.el.setAttribute('stroke-dasharray', s.da);
            s.el.setAttribute('stroke-dashoffset', s.offset);
          }, 200 + i * 150);
        });
        // Fade in center text
        wrap.classList.add('cd-spin');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.25 });
  obs.observe(wrap);
})();

// ── Fund raise bar animation fix ──
(function() {
  const strip = document.getElementById('fp-raise-strip');
  if (!strip) return;
  const fill = strip.querySelector('.fp-raise-fill');
  if (!fill) return;
  // Store target width and set to 0
  const targetWidth = fill.style.width;
  fill.style.width = '0%';
  fill.style.transition = 'width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
  
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        setTimeout(() => { fill.style.width = targetWidth; }, 400);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });
  obs.observe(strip);
})();
