const m = require('mithril');
const motion = require('motion');

const Dialog = () => {
  let opener;
  let onclose = () => { };
  let desktopQuery;
  let onLayoutChange;
  let root;
  const fitViewport = () => {
    const viewport = window.visualViewport;
    root.style.setProperty('--dialog-top', `${viewport?.offsetTop || 0}px`);
    root.style.setProperty('--dialog-left', `${viewport?.offsetLeft || 0}px`);
    root.style.setProperty('--dialog-width', `${viewport?.width || window.innerWidth}px`);
    root.style.setProperty('--dialog-height', `${viewport?.height || window.innerHeight}px`);
  };
  return {
    oncreate: ({ dom, attrs }) => {
      root = dom;
      opener = document.activeElement;
      fitViewport();
      dom.showModal();
      window.addEventListener('resize', fitViewport);
      window.visualViewport?.addEventListener('resize', fitViewport);
      window.visualViewport?.addEventListener('scroll', fitViewport);
      if (attrs.mobileOnly === false) return;
      // Close hidden phone sheets so the page does not stay locked.
      desktopQuery = window.matchMedia('(max-width: 700px)');
      onLayoutChange = (event) => {
        if (!event.matches) {
          onclose();
          m.redraw();
        }
      };
      if (desktopQuery.addEventListener) desktopQuery.addEventListener('change', onLayoutChange);
      else desktopQuery.addListener(onLayoutChange);
    },
    onbeforeremove: motion.exit,
    onremove: ({ dom }) => {
      window.removeEventListener('resize', fitViewport);
      window.visualViewport?.removeEventListener('resize', fitViewport);
      window.visualViewport?.removeEventListener('scroll', fitViewport);
      if (desktopQuery && onLayoutChange) {
        if (desktopQuery.removeEventListener) desktopQuery.removeEventListener('change', onLayoutChange);
        else desktopQuery.removeListener(onLayoutChange);
      }
      dom.close();
      if (opener && opener.isConnected) opener.focus();
    },
    view: ({ attrs, children }) => {
      onclose = attrs.onclose;
      return m('dialog.accessible-dialog', {
        class: attrs.overlayClass,
        'aria-label': attrs.label,
        'aria-modal': 'true',
        oncancel: (event) => {
          event.preventDefault();
          attrs.onclose();
        },
        onclick: (event) => {
          if (attrs.dismissOnBackdrop !== false && event.target === event.currentTarget) attrs.onclose();
        },
        onkeydown: (event) => {
          if (event.key !== 'Tab') return;
          const dialog = event.currentTarget;
          const controls = Array.from(dialog.querySelectorAll(
            'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]'
          )).filter((element) => element.tabIndex >= 0 &&
            !element.matches(':disabled') && !element.closest('[inert]') &&
            element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (!first) {
            event.preventDefault();
          } else if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) {
            event.preventDefault();
            first.focus();
          }
        },
      }, m('div', { class: attrs.sheetClass }, children));
    },
  };
};

module.exports = Dialog;
