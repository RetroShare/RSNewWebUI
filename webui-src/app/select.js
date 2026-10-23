const m = require('mithril');
const icon = require('icon');
const { Popover } = require('popover');

let sequence = 0;
const TYPEAHEAD_RESET_MS = 700;

const Select = () => {
  const listId = `select-options-${++sequence}`;
  let native;
  let trigger;
  let options = [];
  let selected = -1;
  let active = -1;
  let open = false;
  let signature;
  let name = 'Choose option';
  let query = '';
  let timer;

  const sync = ({ dom, attrs }) => {
    native = dom.querySelector('select');
    trigger = dom.querySelector('.select-control__trigger');
    const next = Array.from(native.options, (option) => ({
      label: option.label, disabled: option.disabled || option.parentElement.disabled,
    }));
    const label = Array.from(native.labels || [], (element) => {
      const copy = element.cloneNode(true);
      copy.querySelectorAll('.select-control').forEach((control) => control.remove());
      return copy.textContent.trim();
    }).filter(Boolean).join(' ');
    const nextName = attrs.input.attrs['aria-label'] || label || attrs.input.attrs.title || 'Choose option';
    const nextSignature = JSON.stringify([next, native.selectedIndex, nextName]);
    if (signature === nextSignature) return;
    signature = nextSignature;
    options = next;
    selected = native.selectedIndex;
    name = nextName;
    if (!open) active = selected;
    m.redraw();
  };

  const close = () => { open = false; };
  const choose = (index) => {
    if (!options[index] || options[index].disabled) return;
    selected = index;
    native.selectedIndex = index;
    native.dispatchEvent(new Event('input', { bubbles: true }));
    native.dispatchEvent(new Event('change', { bubbles: true }));
    close();
    trigger.focus();
    m.redraw();
  };
  const toggle = () => {
    open = !open;
    active = selected >= 0 && !options[selected]?.disabled
      ? selected : options.findIndex((option) => !option.disabled);
  };
  const keydown = (event) => {
    if (event.key === 'Tab') {
      close();
      return;
    }
    if (event.key === 'Escape') {
      if (!open) return;
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    const enabled = options.map((option, index) => option.disabled ? -1 : index).filter((index) => index >= 0);
    if (!enabled.length) return;
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!open) toggle();
      else if (event.key.startsWith('Arrow')) {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        active = enabled[(enabled.indexOf(active) + step + enabled.length) % enabled.length];
      }
      if (event.key === 'Home') active = enabled[0];
      if (event.key === 'End') active = enabled[enabled.length - 1];
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(active);
      else toggle();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      query += event.key.toLocaleLowerCase();
      clearTimeout(timer);
      timer = setTimeout(() => { query = ''; }, TYPEAHEAD_RESET_MS);
      const match = enabled.find((index) => options[index].label.toLocaleLowerCase().startsWith(query));
      if (match !== undefined) {
        active = match;
        if (!open) choose(match);
      }
    }
    if (open) requestAnimationFrame(() => document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' }));
  };

  return {
    oncreate: sync,
    onupdate: sync,
    onremove: () => clearTimeout(timer),
    view: ({ attrs: { input } }) => m('.select-control', {
      class: input.attrs.className || input.attrs.class,
      style: input.attrs.style,
    }, [
      // Keep native values, forms and old change handlers working behind the new UI.
      m('select.select-control__native', {
        ...input.attrs,
        class: 'select-control__native',
        className: undefined,
        tabindex: -1,
        'aria-hidden': 'true',
        onfocus: () => trigger?.focus(),
        onclick: (event) => { event.preventDefault(); toggle(); trigger.focus(); },
        oninvalid: () => trigger.focus(),
      }, input.children),
      m('button.select-control__trigger[type=button]', {
        role: 'combobox',
        disabled: input.attrs.disabled,
        'aria-label': name,
        'aria-describedby': input.attrs['aria-describedby'],
        'aria-labelledby': input.attrs['aria-labelledby'],
        'aria-required': input.attrs.required ? 'true' : undefined,
        'aria-expanded': String(open),
        'aria-haspopup': 'listbox',
        'aria-controls': open ? listId : undefined,
        'aria-activedescendant': open && active >= 0 ? `${listId}-${active}` : undefined,
        onclick: toggle,
        onkeydown: keydown,
      }, [m('span', options[selected]?.label || 'Choose option'), icon('chevron-down')]),
      open && m(Popover, {
        id: listId,
        role: 'listbox',
        label: name,
        class: 'select-control__panel',
        anchor: () => trigger,
        align: 'start',
        style: { minWidth: `${trigger.offsetWidth}px` },
        onClose: close,
      }, options.map((option, index) => m('.select-control__option', {
        key: index,
        id: `${listId}-${index}`,
        role: 'option',
        'aria-selected': String(index === selected),
        'aria-disabled': option.disabled ? 'true' : undefined,
        class: index === active ? 'is-active' : '',
        onclick: () => choose(index),
        onpointermove: () => { if (!option.disabled) active = index; },
      }, [
        index === selected ? icon('check') : m('span.select-control__check'),
        m('span', option.label),
      ]))),
    ]),
  };
};

module.exports = (selector, attrs, children) => m(Select, { input: m(selector, attrs, children) });
