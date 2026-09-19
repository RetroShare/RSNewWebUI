//  Toasts.
//
//  The product had no way to tell the user that something worked. Every
//  outcome -- "Friend added", "Download cancelled", "Channel created" -- was
//  announced with a modal that covered the screen and had to be dismissed by
//  hand, so confirming a success cost the same effort as answering a question.
//
//  A toast says the thing and leaves. Modals are now only for what needs an
//  answer: a form, or a destructive confirmation.
//
//  Mounted on #notification-container (already in index.html) rather than
//  rendered inside the route, so a toast survives navigation and cannot be
//  torn down by the redraw of whichever screen raised it.

const m = require('mithril');
const icon = require('icon');

const LIFETIME = { success: 4000, info: 4000, warning: 6000, error: 7000 };
const MAX_VISIBLE = 4;
const ICONS = {
  success: 'check-circle',
  error: 'exclamation-triangle',
  warning: 'exclamation-triangle',
  info: 'info-circle',
  loading: 'spinner',
};

let toasts = [];
let seq = 0;
let mounted = false;

function container() {
  return typeof document === 'undefined'
    ? null
    : document.getElementById('notification-container');
}

function ensureMounted() {
  if (mounted) return;
  const host = container();
  if (!host) return;
  mounted = true;
  m.mount(host, Stack);
}

function clearTimer(toast) {
  if (toast.timer) {
    clearTimeout(toast.timer);
    toast.timer = null;
  }
}

//  Removal is two-stage so the leaving animation can play: mark it leaving,
//  redraw, then drop it once the transition has had its time.
function dismiss(id) {
  const toast = toasts.find((t) => t.id === id);
  if (!toast || toast.leaving) return;
  clearTimer(toast);
  toast.leaving = true;
  m.redraw();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    m.redraw();
  }, 180);
}

function arm(toast) {
  if (toast.duration === Infinity || toast.leaving) return;
  clearTimer(toast);
  toast.timer = setTimeout(() => dismiss(toast.id), toast.remaining);
}

//  Hovering holds the stack open: a toast must not expire while it is being
//  read, and the pointer is the only evidence of that we get.
function hold() {
  toasts.forEach((toast) => {
    if (toast.leaving || toast.duration === Infinity || !toast.timer) return;
    toast.remaining = Math.max(600, toast.expiresAt - Date.now());
    clearTimer(toast);
  });
}

function release() {
  toasts.forEach((toast) => {
    if (toast.leaving || toast.duration === Infinity || toast.timer) return;
    toast.expiresAt = Date.now() + toast.remaining;
    arm(toast);
  });
}

function push(type, message, options) {
  const opts = options || {};
  ensureMounted();

  //  An id lets a caller replace a toast in place -- a "Sending..." that
  //  becomes "Sent" without two notices stacking up.
  const id = opts.id || `t${++seq}`;
  const duration = opts.duration !== undefined
    ? opts.duration
    : (type === 'loading' ? Infinity : LIFETIME[type] || 4000);

  const next = {
    id,
    type,
    message: String(message === undefined || message === null ? '' : message),
    description: opts.description ? String(opts.description) : '',
    action: opts.action || null,
    duration,
    remaining: duration,
    expiresAt: Date.now() + duration,
    leaving: false,
    timer: null,
  };

  const existing = toasts.findIndex((t) => t.id === id);
  if (existing >= 0) {
    clearTimer(toasts[existing]);
    toasts[existing] = next;
  } else {
    toasts.push(next);
    //  Oldest first, so a burst of results does not push the newest one off.
    while (toasts.filter((t) => !t.leaving).length > MAX_VISIBLE) {
      const oldest = toasts.find((t) => !t.leaving);
      if (!oldest) break;
      dismiss(oldest.id);
    }
  }

  arm(next);
  m.redraw();
  return id;
}

const Stack = {
  view: () =>
    m('.toasts', { onmouseenter: hold, onmouseleave: release },
      toasts.map((toast) => m(Toast, { key: toast.id, toast }))),
};

const Toast = {
  view: (vnode) => {
    const { toast } = vnode.attrs;
    return m(
      '.toast',
      {
        class: `toast--${toast.type}${toast.leaving ? ' is-leaving' : ''}`,
        role: toast.type === 'error' ? 'alert' : 'status',
        'aria-live': toast.type === 'error' ? 'assertive' : 'polite',
      },
      [
        icon(ICONS[toast.type] || 'info-circle', {
          class: 'toast__icon',
          spin: toast.type === 'loading',
        }),
        m('.toast__text', [
          m('.toast__message', toast.message),
          toast.description && m('.toast__description', toast.description),
        ]),
        toast.action &&
          m('button.toast__action', {
            type: 'button',
            onclick: () => {
              dismiss(toast.id);
              toast.action.onclick();
            },
          }, toast.action.label),
        m('button.toast__close', {
          type: 'button',
          'aria-label': 'Dismiss',
          onclick: () => dismiss(toast.id),
        }, icon('times')),
      ]
    );
  },
};

const toast = (message, options) => push('info', message, options);
toast.success = (message, options) => push('success', message, options);
toast.error = (message, options) => push('error', message, options);
toast.warning = (message, options) => push('warning', message, options);
toast.info = (message, options) => push('info', message, options);
toast.loading = (message, options) => push('loading', message, options);
toast.dismiss = dismiss;

//  `toast.result(ok, okMessage, failMessage)` collapses the shape that ran
//  through 43 call sites: a request answers, and one of two notices follows.
toast.result = (ok, okMessage, failMessage, options) =>
  ok ? push('success', okMessage, options) : push('error', failMessage, options);

module.exports = toast;
