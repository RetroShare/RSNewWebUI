const m = require('mithril');
const icon = require('icon');
const { Popover } = require('popover');
const Dialog = require('dialog');
const motion = require('motion');
const selectionIndicator = require('selection_indicator');

const Loading = {
  view: ({ attrs }) => m('.loading-state', { role: 'status' }, [
    m('span.loading-state__ring', { 'aria-hidden': 'true' }),
    m('span', attrs.label || 'Loading…'),
  ]),
};

const TableLoading = {
  view: ({ attrs }) => m('.group-list-loading', { 'aria-busy': 'true' }, [
    m(Loading, { label: attrs.label || 'Loading groups…' }),
    m('table.group-table', { 'aria-hidden': 'true' }, m('tbody',
      Array.from({ length: 5 }, (_, index) => m('tr', { key: index }, [
        m('td', m('.group-row__inner', [m('span.skeleton.skeleton--mark'), m('span.skeleton.skeleton--name')])),
        m('td.group-row__posts', m('span.skeleton')),
        m('td.group-row__activity', m('span.skeleton')),
      ])))),
  ]),
};

const ListError = {
  view: ({ attrs }) => m('.group-list-error[role=alert]', [
    icon('exclamation-triangle'),
    m('span', attrs.message),
    m('button[type=button]', { onclick: attrs.onretry }, 'Try again'),
  ]),
};

const SearchField = {
  view: ({ attrs }) => {
    const submits = Boolean(attrs.onSubmit);
    const field = m('.search-field', { class: submits ? undefined : attrs.class }, [
      submits ? null : icon('search'),
      m('input.search-field__input[type=search]', {
        id: attrs.id,
        placeholder: attrs.placeholder || 'Search',
        'aria-label': attrs.label || attrs.placeholder || 'Search',
        value: attrs.value || '',
        autofocus: attrs.autofocus,
        oninput: attrs.oninput,
        onkeydown: attrs.onkeydown,
      }),
      !submits && attrs.onclear && attrs.value
        ? m('button.search-field__clear.is-glyph[type=button][aria-label=Clear search]', {
          onclick: attrs.onclear,
        }, icon('times'))
        : null,
    ]);

    if (!submits) return field;
    return m('form.search-submit', {
      class: attrs.class,
      onsubmit: (event) => {
        event.preventDefault();
        attrs.onSubmit();
      },
    }, [
      field,
      m('button.is-primary[type=submit]', [icon('search'), attrs.submitLabel || 'Search']),
    ]);
  },
};

const BackButton = {
  view: ({ attrs }) => m('button.back-button[type=button]', {
    title: attrs.label || 'Back',
    'aria-label': attrs.label || 'Back',
    onclick: attrs.onclick,
  }, icon('arrow-left')),
};

/**
 * A button and a floating panel. Focus leaving a button must not eat a tap.
 *
 * attrs:
 *   label     text on the button; hidden at phone widths, where the mark alone
 *             has to carry it, so always pass `title` too
 *   mark      icon name on the button
 *   title     tooltip and accessible name
 *   items     [{ label, icon, onclick, onfile, accept, selected, danger }]
 *   buttonClass extra class on the trigger button
 *   align     'end' pins the panel to the button's right edge (default), 'start'
 *             to its left
 *   up        true opens the panel above the button
 *   class     extra class on the wrapper
 */
const Menu = () => {
  let open = false;
  let trigger;
  let focusPanel = false;
  const close = () => { open = false; };
  return {
    view: ({ attrs }) => m('.menu', { class: attrs.class }, [
      m('button.menu__button[type=button]', {
        oncreate: ({ dom }) => { trigger = dom; },
        class: attrs.buttonClass,
        title: attrs.title || attrs.label,
        'aria-label': attrs.title || attrs.label,
        'aria-expanded': String(open),
        'aria-haspopup': 'dialog',
        disabled: attrs.disabled,
        onclick: () => { focusPanel = false; open = !open; },
        onkeydown: (event) => {
          if (event.key !== 'ArrowDown') return;
          event.preventDefault();
          focusPanel = true;
          open = true;
        },
      }, [
        attrs.mark ? icon(attrs.mark) : null,
        attrs.label ? m('span.btn-text', attrs.label) : null,
        m('span.menu__caret', icon('chevron-down')),
      ]),
      open && m(Popover, {
        class: 'menu__panel',
        label: attrs.title || attrs.label,
        anchor: () => trigger,
        align: attrs.align,
        up: attrs.up,
        focus: focusPanel,
        onClose: close,
      }, (attrs.items || []).map((item) => {
        const content = [item.icon ? icon(item.icon) : null, m('span', item.label)];
        if (item.onfile) {
          return m('label.menu__item', {
            key: item.label,
            tabindex: item.disabled ? -1 : 0,
            'aria-disabled': item.disabled ? 'true' : undefined,
            onkeydown: (event) => {
              if (item.disabled || !['Enter', ' '].includes(event.key)) return;
              event.preventDefault();
              event.currentTarget.querySelector('input').click();
            },
          }, content.concat(m('input.menu__file[type=file]', {
            accept: item.accept,
            tabindex: -1,
            disabled: item.disabled,
            onchange: (event) => {
              const file = event.target.files && event.target.files[0];
              if (file) item.onfile(file);
              event.target.value = '';
              close();
              trigger.focus();
            },
          })));
        }
        return m('button.menu__item[type=button]', {
          key: item.label,
          disabled: item.disabled,
          'aria-pressed': item.selected === undefined ? undefined : String(item.selected),
          class: [item.selected ? 'is-selected' : '', item.danger ? 'is-danger' : '']
            .filter(Boolean).join(' '),
          onclick: () => {
            close();
            trigger.focus();
            item.onclick();
          },
        }, content);
      })),
    ]),
  };
};

const PageHead = {
  view: ({ attrs }) => m('.page-head', { class: attrs.class }, [
    m('.page-head__group', [
      attrs.back ? m(BackButton, attrs.back) : null,
      attrs.mark ? m('.page-head__mark', icon(attrs.mark)) : null,
      m('.page-head__text', [
        m('h2.page-head__title', attrs.title),
        attrs.lead ? m('p.page-head__lead', attrs.lead) : null,
      ]),
    ]),
    attrs.actions ? m('.page-head__actions', attrs.actions) : null,
  ]),
};

const Segmented = {
  view: ({ attrs }) => {
    const options = attrs.options || [];
    const underline = attrs.variant === 'underline';
    const iconsOnly = options.every((o) => o.icon && !o.label);
    const selectedIndex = options.findIndex((option) => option.id === attrs.value);
    return m('.segmented', {
      ...selectionIndicator,
      class: [
        underline ? 'segmented--underline' : 'segmented--lozenge',
        iconsOnly ? 'segmented--icons' : '',
        attrs.class || '',
      ].filter(Boolean).join(' '),
      role: underline ? 'tablist' : 'radiogroup',
      'aria-label': attrs.ariaLabel,
    }, options.map((option, index) => {
      const selected = option.id === attrs.value;
      return m('button.segmented__item[type=button]', {
        key: option.id,
        class: selected ? 'is-selected' : '',
        title: option.title || option.label,
        'aria-label': option.title && !option.label ? option.title : undefined,
        role: underline ? 'tab' : 'radio',
        'aria-selected': underline ? String(selected) : undefined,
        'aria-checked': underline ? undefined : String(selected),
        tabindex: selected || (selectedIndex === -1 && index === 0) ? 0 : -1,
        onkeydown: (event) => {
          const directions = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
          if (!directions[event.key] && event.key !== 'Home' && event.key !== 'End') return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
            : (index + directions[event.key] + options.length) % options.length;
          attrs.onSelect(options[next].id);
          event.currentTarget.parentElement.children[next].focus();
        },
        onclick: () => attrs.onSelect(option.id),
      }, [
        option.icon ? icon(option.icon) : null,
        option.label ? m('span', option.label) : null,
        option.badge ? m('b.segmented__badge', option.badge) : null,
      ]);
    }));
  },
};

const Sidebar = () => {
  let mobileOpen = false;

  const isSelected = (attrs, panelName) => attrs.onSelect
    ? attrs.active === panelName
    : m.route.get().toLowerCase().startsWith((attrs.baseRoute + panelName).toLowerCase());

  const links = (v) => v.attrs.tabs.map((panelName) => {
    const href = v.attrs.baseRoute ? v.attrs.baseRoute + panelName : undefined;
    const selected = isSelected(v.attrs, panelName);
    const glyph = v.attrs.icons && v.attrs.icons[panelName];
    const label = (v.attrs.labels && v.attrs.labels[panelName]) || panelName;
    return m(v.attrs.onSelect ? 'button' : m.route.Link, {
      type: v.attrs.onSelect ? 'button' : undefined,
      class: selected ? 'selected-sidebar-link' : '',
      href,
      'aria-current': selected ? 'page' : undefined,
      title: v.attrs.titles && v.attrs.titles[panelName],
      onclick: (event) => {
        mobileOpen = false;
        if (v.attrs.onSelect) {
          event.preventDefault();
          v.attrs.onSelect(panelName);
        }
      },
    }, glyph ? [icon(glyph, { class: 'sidebar__icon' }), m('span', label)] : label);
  });

  return {
    view: (v) => {
      const heading = v.attrs.title
        ? m('.sidebar__section-title', v.attrs.title)
        : null;
      if (!v.attrs.mobileDrawer) return m('.sidebar', [heading, ...links(v)]);
      const active = v.attrs.tabs.find((panelName) => isSelected(v.attrs, panelName));
      return m('.sidebar-drawer', [
        m('.sidebar-drawer__toolbar', [
          m('button.sidebar-mobile-toggle[type=button]', {
            'aria-label': `Open ${v.attrs.title || 'section'} navigation`,
            'aria-expanded': String(mobileOpen),
            'aria-haspopup': 'dialog',
            onclick: () => { mobileOpen = true; },
          }, [icon('bars'), m('span', v.attrs.title || 'Navigation'), icon('chevron-down')]),
          active && m('span.sidebar-drawer__current', v.attrs.labels?.[active] || active),
        ]),
        m('.sidebar.sidebar--desktop', [heading, ...links(v)]),
        mobileOpen && m(Dialog, {
          label: `${v.attrs.title || 'Section'} navigation`,
          overlayClass: 'section-drawer-overlay',
          sheetClass: 'section-drawer',
          onclose: () => { mobileOpen = false; },
        }, [
          m('.section-drawer__heading', [
            m('h3', v.attrs.title || 'Navigation'),
            m('button.is-glyph[type=button][aria-label=Close navigation]', {
              onclick: () => { mobileOpen = false; },
            }, icon('times')),
          ]),
          m('nav.section-drawer__links', { 'aria-label': v.attrs.title || 'Section' }, links(v)),
        ]),
      ]);
    },
  };
};

const SidebarQuickView = () => {
  let quickactive = -1;
  return {
    view: (v) =>
      m(
        '.sidebarquickview',
        m('h4', 'Quick View'),
        v.attrs.tabs.map((panelName, index) =>
          m(
            m.route.Link,
            {
              class: index === quickactive ? 'selected-sidebarquickview-link' : '',
              onclick: () => (quickactive = index),
              href: v.attrs.baseRoute + panelName,
            },
            panelName
          )
        )
      ),
  };
};

let popupClose;

function closePopupMessage() {
  const container = document.getElementById('modal-container');
  if (!container || container.style.display === 'none' || popupClose) return;
  const surface = container.querySelector('dialog') || container;
  const done = motion.leave(surface);
  popupClose = done;
  done.then(() => {
    if (popupClose !== done) return;
    m.mount(container, null);
    container.style.display = 'none';
    motion.reset(surface);
    popupClose = null;
  });
}

function popupMessage(message, modalClass = '', options = {}) {
  const container = document.getElementById('modal-container');
  if (!container) return;
  popupClose = null;
  container.style.display = 'block';

  // Mithril skips reused vnodes. Copy them so modal content can update.
  const freshVnode = (vnode) => {
    if (Array.isArray(vnode)) return vnode.map(freshVnode);
    if (!vnode || typeof vnode !== 'object' || !vnode.tag) return vnode;
    // Text, trusted HTML and fragments are not element selectors.
    if (vnode.tag === '<') return m.trust(vnode.children);
    if (vnode.tag === '#') return vnode.children;
    if (vnode.tag === '[') return m.fragment(vnode.attrs, freshVnode(vnode.children));
    if (typeof vnode.tag !== 'string') return m(vnode.tag, vnode.attrs, vnode.children);
    return m(vnode.tag, vnode.attrs, freshVnode(vnode.children));
  };

  const renderContent = () => {
    if (typeof message === 'function') {
      const res = message();
      if (res && typeof res.view === 'function') {
        return m(message);
      }
      return freshVnode(res);
    }
    if (message && typeof message.view === 'function') {
      return m(message);
    }
    return freshVnode(message);
  };

  const title = options.title;
  const dismiss = m('button.modal__close[type=button][aria-label=Close]', {
    onclick: () => closePopupMessage(),
  }, icon('times'));

  const Popup = {
    view: () => m(
      Dialog,
      {
        label: title || 'Dialog',
        mobileOnly: false,
        dismissOnBackdrop: false,
        overlayClass: 'popup-dialog',
        sheetClass: `modal-content ${modalClass} ${title ? 'modal--titled' : ''}`,
        onclose: closePopupMessage,
      },
      title
        ? [
            dismiss,
            m('.modal__head', [
              m('h2.modal__title', title),
              options.lead ? m('p.modal__lead', options.lead) : null,
            ]),
            m('.modal__body', renderContent()),
          ]
        : [dismiss, renderContent()]
    ),
  };

  m.mount(container, Popup);
}

function confirmMessage(options) {
  const opts = options || {};
  const Body = {
    view: () => [
      m('.modal__confirm', [
        opts.message ? m('p.modal__confirm-text', opts.message) : null,
        opts.description ? m('p.modal__confirm-hint', opts.description) : null,
      ]),
      m('.modal__foot', [
        m('button[type=button]', {
          onclick: () => {
            closePopupMessage();
            if (opts.onCancel) opts.onCancel();
          },
        }, opts.cancelLabel || 'Cancel'),
        m('button[type=button]', {
          class: opts.danger ? 'is-danger' : 'is-primary',
          onclick: () => {
            closePopupMessage();
            if (opts.onConfirm) opts.onConfirm();
          },
        }, opts.confirmLabel || 'Confirm'),
      ]),
    ],
  };
  popupMessage(m(Body), 'modal--confirm', { title: opts.title || 'Are you sure?' });
}

module.exports = {
  TableLoading,
  ListError,
  Loading,
  BackButton,
  Menu,
  PageHead,
  Segmented,
  Sidebar,
  SearchField,
  confirmMessage,
  SidebarQuickView,
  popupMessage,
  closePopupMessage,
};
