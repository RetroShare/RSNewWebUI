const m = require('mithril');
const icon = require('icon');
//  The search field -- see scss/components/_search.scss.
//
//  Two shapes, because there are two kinds of search in the product and they
//  promise different things:
//
//  · Filtering, the default. The list narrows as you type, so the lens sits
//    inside the box as a label for what the field does, and a clear button
//    appears once there is something to clear. Nothing to press.
//
//  · Submitting, when `onSubmit` is given. The query goes to the core and
//    results come back later, so there has to be something to press: the box
//    holds only its placeholder, and the lens moves to the primary button
//    beside it, where it names the action rather than the field.
//
//  attrs: placeholder, value, oninput, onclear, onSubmit, submitLabel,
//         id, class, autofocus
const SearchField = {
  view: ({ attrs }) => {
    const submits = Boolean(attrs.onSubmit);
    const field = m('.search-field', { class: submits ? undefined : attrs.class }, [
      submits ? null : icon('search'),
      m('input.search-field__input[type=search]', {
        id: attrs.id,
        placeholder: attrs.placeholder || 'Search',
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

//  The one back button. Same look and size wherever you leave a detail view.
//
//  attrs: onclick, label (what you go back to, for screen readers)
const BackButton = {
  view: ({ attrs }) => m('button.back-button[type=button]', {
    title: attrs.label || 'Back',
    'aria-label': attrs.label || 'Back',
    onclick: attrs.onclick,
  }, icon('arrow-left')),
};

/**
 * A button that opens a short list under it. Native <details>, so it needs no
 * open/close state of its own and closes on Escape or on focus leaving it.
 *
 * attrs:
 *   label     text on the button; hidden at phone widths, where the mark alone
 *             has to carry it, so always pass `title` too
 *   mark      icon name on the button
 *   title     tooltip and accessible name
 *   items     [{ label, icon, onclick, onfile, accept, selected, danger }]
 *   buttonClass extra class on the summary button
 *   align     'end' pins the panel to the button's right edge (default), 'start'
 *             to its left
 *   up        true opens the panel above the button
 *   class     extra class on the <details>
 */
const Menu = {
  view: ({ attrs }) => m('details.menu', {
    class: [attrs.class || '', attrs.up ? 'menu--up' : '', `menu--${attrs.align || 'end'}`]
      .filter(Boolean).join(' '),
    onkeydown: (event) => {
      if (event.key !== 'Escape') return;
      event.currentTarget.open = false;
      event.currentTarget.querySelector('summary').focus();
    },
    onfocusout: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
    },
  }, [
    m('summary.menu__button', {
      class: attrs.buttonClass,
      title: attrs.title || attrs.label,
      'aria-label': attrs.title || attrs.label,
    }, [
      attrs.mark ? icon(attrs.mark) : null,
      attrs.label ? m('span.btn-text', attrs.label) : null,
      m('span.menu__caret', icon('chevron-down')),
    ]),
    m('.menu__panel', (attrs.items || []).map((item) => {
      const content = [item.icon ? icon(item.icon) : null, m('span', item.label)];
      if (item.onfile) {
        return m('label.menu__item', {
          key: item.label,
          'aria-disabled': item.disabled ? 'true' : undefined,
        }, content.concat(m('input.menu__file[type=file]', {
          accept: item.accept,
          disabled: item.disabled,
          onchange: (event) => {
            const file = event.target.files && event.target.files[0];
            if (file) item.onfile(file);
            event.target.value = '';
            const menu = event.target.closest('details');
            if (menu) menu.open = false;
          },
        })));
      }
      return m('button.menu__item[type=button]', {
        key: item.label,
        disabled: item.disabled,
        class: [item.selected ? 'is-selected' : '', item.danger ? 'is-danger' : '']
          .filter(Boolean).join(' '),
        onclick: (event) => {
          const menu = event.currentTarget.closest('details');
          if (menu) {
            menu.open = false;
            menu.querySelector('summary').focus();
          }
          item.onclick();
        },
      }, content);
    })),
  ]),
};

//  The page header -- see scss/components/_page-head.scss.
//
//  attrs: title, lead, mark (an icon name), actions (a vnode or array), class,
//         back (BackButton attrs; a detail view passes this instead of giving
//         the arrow a row of its own)
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

//  The segmented control -- see scss/components/_segmented.scss.
//
//  attrs:
//    variant   'lozenge' (a picker, alternatives side by side) or
//              'underline' (tabs, when the pane below changes). Default lozenge.
//    value     the selected option's id
//    options   [{ id, label, icon, badge, title }]
//    onSelect  (id) => void
//    class, ariaLabel
//
//  Options carrying only an icon get the square icon-only metrics.
const Segmented = {
  view: ({ attrs }) => {
    const options = attrs.options || [];
    const underline = attrs.variant === 'underline';
    const iconsOnly = options.every((o) => o.icon && !o.label);
    return m('.segmented', {
      class: [
        underline ? 'segmented--underline' : 'segmented--lozenge',
        iconsOnly ? 'segmented--icons' : '',
        attrs.class || '',
      ].filter(Boolean).join(' '),
      role: underline ? 'tablist' : 'radiogroup',
      'aria-label': attrs.ariaLabel,
    }, options.map((option) => {
      const selected = option.id === attrs.value;
      return m('button.segmented__item[type=button]', {
        key: option.id,
        class: selected ? 'is-selected' : '',
        title: option.title,
        'aria-label': option.title && !option.label ? option.title : undefined,
        role: underline ? 'tab' : 'radio',
        'aria-selected': underline ? String(selected) : undefined,
        'aria-checked': underline ? undefined : String(selected),
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

  //  `icons` and `labels` are optional maps keyed by tab name. Callers that
  //  pass neither keep the plain capitalised text link.
  //
  //  Two ways to drive it. Most sections are routed: pass `baseRoute` and the
  //  rail reads the current route. Statistics switches panes in local state,
  //  so it passes `active` and `onSelect` instead -- the rail is the same
  //  object either way, which is the point.
  const links = (v) => v.attrs.tabs.map((panelName) => {
    const href = v.attrs.baseRoute ? v.attrs.baseRoute + panelName : undefined;
    const selected = v.attrs.onSelect
      ? v.attrs.active === panelName
      : m.route.get().toLowerCase().startsWith(href.toLowerCase());
    const glyph = v.attrs.icons && v.attrs.icons[panelName];
    const label = (v.attrs.labels && v.attrs.labels[panelName]) || panelName;
    return m('a', {
      class: selected ? 'selected-sidebar-link' : '',
      href,
      'aria-current': selected ? 'page' : undefined,
      title: v.attrs.titles && v.attrs.titles[panelName],
      onclick: (event) => {
        event.preventDefault();
        mobileOpen = false;
        if (v.attrs.onSelect) v.attrs.onSelect(panelName);
        else m.route.set(href);
      },
    }, glyph ? [icon(glyph, { class: 'sidebar__icon' }), m('span', label)] : label);
  });

  return {
    view: (v) => {
      //  `title` is the rail's section label, the counterpart of mail's
      //  FOLDERS / CATEGORIES headings.
      const heading = v.attrs.title
        ? m('.sidebar__section-title', v.attrs.title)
        : null;
      if (!v.attrs.mobileDrawer) return m('.sidebar', [heading, ...links(v)]);
      return m('.sidebar-drawer', [
        m('button.sidebar-mobile-toggle[type=button][aria-label=Open navigation]', {
          'aria-expanded': mobileOpen,
          onclick: () => { mobileOpen = !mobileOpen; },
        }, icon('bars')),
        mobileOpen ? m('.sidebar-drawer__backdrop', { onclick: () => { mobileOpen = false; } }) : null,
        m('.sidebar', { class: mobileOpen ? 'sidebar--mobile-open' : '' }, [
          //  Two headings, one per layout: the rail's section label on a
          //  pointer, the drawer's own title on a phone. Each is hidden in
          //  the other mode.
          heading,
          m('.sidebar-drawer__title', v.attrs.title || 'Navigation'),
          ...links(v),
        ]),
      ]);
    },
  };
};
const SidebarQuickView = () => {
  // for the Mail tab, to be moved later.
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

// There are ways of doing this inside m.route but it is probably
// cleaner and faster when kept outside of the main auto
// rendering system
function closePopupMessage() {
  const container = document.getElementById('modal-container');
  if (!container) return;
  m.mount(container, null);
  container.style.display = 'none';
}

//  `popupMessage(content, modalClass)` keeps working for the call sites that
//  build their own heading. `options.title` is the new form: it renders the
//  standard head so every modal in the product is the same object -- the task
//  named at display size, `options.lead` under it saying what to do, and the
//  dismiss in the corner.
//
//  A modal with no title and nothing to answer is not a modal; it is a notice,
//  and belongs in `toast` (app/toast.js).
function popupMessage(message, modalClass = '', options = {}) {
  const container = document.getElementById('modal-container');
  if (!container) return;
  container.style.display = 'block';

  //  A vnode carries the DOM node it owns, so the same one cannot be
  //  rendered twice. Most call sites hand popupMessage a ready-made vnode
  //  (or an array of them); re-rendering it on every global redraw needs a
  //  fresh copy each time -- and a copy all the way down, since mithril
  //  skips a subtree whose children array is identical (old === vnodes) and
  //  freezes it at its first render. Component call sites go through m()
  //  and need no copying.
  const freshVnode = (vnode) => {
    if (Array.isArray(vnode)) return vnode.map(freshVnode);
    if (!vnode || typeof vnode !== 'object' || !vnode.tag) return vnode;
    //  '<' is m.trust and '[' is m.fragment: neither is a selector m() can
    //  parse. Rebuilding them with m() would silently turn trusted html into
    //  an empty div, so they go back through their own factory. '#' is a
    //  text vnode, whose children is the string itself.
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
      `.modal-content${modalClass ? `.${modalClass}` : ''}${title ? '.modal--titled' : ''}`,
      {
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': title || undefined,
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

//  Escape closes whatever modal is open. Registered once.
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const container = document.getElementById('modal-container');
    if (container && container.style.display === 'block') closePopupMessage();
  });
}

//  The one confirmation dialog.
//
//  Confirmations were being written by hand at each call site -- a bare <p>
//  and a lone button, no title, the action sometimes red and sometimes not --
//  and two of them were still native confirm(). This is the whole decision in
//  one shape: what is about to happen, cancel, and the action named as itself.
//
//  `danger: true` outlines the action in red rather than filling it; a solid
//  red button invites the click it exists to discourage.
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
