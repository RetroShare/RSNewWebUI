const pending = new WeakMap();

function reduced() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Wait for the real exit, not a timer that can drift away from the CSS.
function leave(dom) {
  if (pending.has(dom)) return pending.get(dom);
  dom.classList.add('is-leaving');
  if (reduced() || !dom.getAnimations) return Promise.resolve();
  const animations = dom.getAnimations({ subtree: true }).filter((animation) =>
    Number.isFinite(animation.effect.getComputedTiming().endTime) &&
    (!animation.animationName || animation.animationName.endsWith('-out')));
  const done = Promise.allSettled(animations.map((animation) => animation.finished));
  pending.set(dom, done);
  return done;
}

function reset(dom) {
  pending.delete(dom);
  dom.classList.remove('is-leaving');
}

function exit({ dom }) {
  return leave(dom);
}

const closingDetails = new WeakMap();

function closeDetails(dom) {
  if (!dom || !dom.open || closingDetails.has(dom)) return;
  const panel = dom.querySelector('.menu__panel, .forum-details__panel');
  if (!panel) {
    dom.open = false;
    return;
  }
  const done = leave(panel);
  closingDetails.set(dom, done);
  done.then(() => {
    if (closingDetails.get(dom) !== done) return;
    dom.open = false;
    closingDetails.delete(dom);
    reset(panel);
  });
}

function toggleDetails(event) {
  const dom = event.currentTarget.closest('details');
  if (!dom.open) return;
  event.preventDefault();
  if (closingDetails.has(dom)) {
    closingDetails.delete(dom);
    reset(dom.querySelector('.menu__panel, .forum-details__panel'));
  } else closeDetails(dom);
}

module.exports = { leave, reset, exit, closeDetails, toggleDetails };
