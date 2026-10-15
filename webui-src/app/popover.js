const m = require('mithril');

function positionPanel(panel, anchor, { align = 'end', up = false, gapToken = '--s1' } = {}) {
  if (!anchor) return;
  const gap = parseFloat(getComputedStyle(panel).getPropertyValue(gapToken));
  const viewport = window.visualViewport;
  const left = viewport ? viewport.offsetLeft : 0;
  const top = viewport ? viewport.offsetTop : 0;
  const width = viewport ? viewport.width : window.innerWidth;
  const height = viewport ? viewport.height : window.innerHeight;
  const bounds = anchor.getBoundingClientRect();
  const above = Math.max(0, bounds.top - top - gap * 2);
  const below = Math.max(0, top + height - bounds.bottom - gap * 2);
  panel.style.maxWidth = `${Math.max(0, width - gap * 2)}px`;
  panel.style.maxHeight = `${Math.max(above, below)}px`;
  const panelWidth = panel.offsetWidth;
  const panelHeight = panel.offsetHeight;
  const opensUp = up ? above >= panelHeight || above >= below : below < panelHeight && above > below;
  const x = align === 'start' ? bounds.left : bounds.right - panelWidth;
  const y = opensUp ? bounds.top - panelHeight - gap : bounds.bottom + gap;
  panel.style.left = `${Math.max(left + gap, Math.min(x, left + width - panelWidth - gap))}px`;
  panel.style.top = `${Math.max(top + gap, Math.min(y, top + height - panelHeight - gap))}px`;
}

const Popover = () => {
  let root;
  let attrs;
  const position = () => positionPanel(root, attrs.anchor(), attrs);
  const outside = (event) => {
    if (root.contains(event.target) || attrs.anchor()?.contains(event.target)) return;
    attrs.onClose();
    m.redraw();
  };
  return {
    oncreate: ({ dom }) => {
      root = dom;
      if (root.showPopover) root.showPopover();
      position();
      if (attrs.focus) root.querySelector('button:not(:disabled), input:not(:disabled), [tabindex="0"]')?.focus();
      document.addEventListener('pointerdown', outside, true);
      window.addEventListener('resize', position);
      window.addEventListener('scroll', position, true);
      window.visualViewport?.addEventListener('resize', position);
      window.visualViewport?.addEventListener('scroll', position);
    },
    onremove: () => {
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
    },
    view: (vnode) => {
      attrs = vnode.attrs;
      return m('.floating-panel', {
        class: attrs.class,
        popover: 'auto',
        role: 'dialog',
        'aria-label': attrs.label,
        ontoggle: (event) => {
          if (event.newState === 'closed') attrs.onClose();
        },
        onkeydown: (event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          attrs.anchor()?.focus();
          attrs.onClose();
        },
      }, vnode.children);
    },
  };
};

module.exports = { Popover, positionPanel };
