/** Small page behaviors that do not depend on the animation engine. */

export function initYear() {
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
}

export function initCopyEmail() {
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    const label = btn.querySelector('[data-copy-label]');
    const status = btn.parentElement?.querySelector('[data-copy-status]');
    let timer;

    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        if (label) label.textContent = 'Copied';
        if (status) status.textContent = 'Email address copied to clipboard.';
      } catch {
        if (status) status.textContent = 'Copy failed. Select the address above instead.';
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (label) label.textContent = 'Copy email';
        if (status) status.textContent = '';
      }, 2400);
    });
  });
}

export function initRotator(reducedMotion) {
  const rotator = document.querySelector('[data-rotator]');
  if (!rotator) return;
  const items = [...rotator.children];
  if (!items.length) return;

  let index = 0;
  items[0].classList.add('is-active');
  if (reducedMotion || items.length < 2) return;

  setInterval(() => {
    if (document.hidden) return;
    const current = items[index];
    index = (index + 1) % items.length;
    const next = items[index];
    current.classList.remove('is-active');
    current.classList.add('is-leaving');
    next.classList.remove('is-leaving');
    next.classList.add('is-active');
    setTimeout(() => current.classList.remove('is-leaving'), 650);
  }, 2600);
}

export function initProjectFilter() {
  const buttons = document.querySelectorAll('[data-filter]');
  const cases = document.querySelectorAll('.case[data-category]');
  if (!buttons.length || !cases.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      buttons.forEach((b) => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      cases.forEach((c) => {
        c.hidden = !(filter === 'all' || c.dataset.category === filter);
      });
      document.dispatchEvent(new CustomEvent('layout:change'));
    });
  });
}
