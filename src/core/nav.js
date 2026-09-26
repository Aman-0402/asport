export function initNav({ lockScroll, unlockScroll } = {}) {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return { onScroll() {} };

  const page = document.body.dataset.page;
  nav.querySelectorAll('.site-nav__links a').forEach((link) => {
    if (link.dataset.page === page) link.setAttribute('aria-current', 'page');
  });

  const toggle = nav.querySelector('[data-menu-toggle]');
  const menu = nav.querySelector('#site-menu');

  const setOpen = (open) => {
    nav.classList.toggle('menu-open', open);
    toggle?.setAttribute('aria-expanded', String(open));
    toggle?.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (open) lockScroll?.();
    else unlockScroll?.();
  };

  toggle?.addEventListener('click', () => setOpen(!nav.classList.contains('menu-open')));
  menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('menu-open')) {
      setOpen(false);
      toggle?.focus();
    }
  });
  window.matchMedia('(min-width: 900px)').addEventListener('change', (e) => {
    if (e.matches) setOpen(false);
  });

  let lastY = window.scrollY;

  /** Called on every scroll frame with the current scroll position. */
  const onScroll = (y) => {
    nav.classList.toggle('is-scrolled', y > 24);
    const goingDown = y > lastY + 4;
    const goingUp = y < lastY - 4;
    if (!nav.classList.contains('menu-open') && !nav.contains(document.activeElement)) {
      if (goingDown && y > 320) nav.classList.add('is-hidden');
      else if (goingUp) nav.classList.remove('is-hidden');
    }
    if (goingDown || goingUp) lastY = y;
  };

  nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));
  onScroll(window.scrollY);
  return { onScroll };
}
