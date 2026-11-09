const observers = new WeakMap();

function position({ dom }) {
  const selected = dom.querySelector('.segmented__item.is-selected');
  if (!selected) {
    delete dom.dataset.indicator;
    return;
  }
  if (!dom.getClientRects().length) return;
  dom.style.setProperty('--segment-x', `${selected.offsetLeft}px`);
  dom.style.setProperty('--segment-y', `${selected.offsetTop}px`);
  dom.style.setProperty('--segment-width', `${selected.offsetWidth}px`);
  dom.style.setProperty('--segment-height', `${selected.offsetHeight}px`);
  dom.dataset.indicator = 'true';
}

function create(vnode) {
  position(vnode);
  const update = () => position(vnode);
  const observer = new ResizeObserver(update);
  observer.observe(vnode.dom);
  vnode.dom.querySelectorAll('.segmented__item').forEach((item) => observer.observe(item));
  observers.set(vnode.dom, observer);
}

function remove({ dom }) {
  observers.get(dom)?.disconnect();
  observers.delete(dom);
}

module.exports = { oncreate: create, onupdate: position, onremove: remove };
