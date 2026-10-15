const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const m = require('../app/mithril');

function load(name, dependencies = {}, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(readFileSync(path.join(__dirname, '../app', name), 'utf8'), {
    module,
    require: (id) => {
      if (id === 'mithril') return dependencies.mithril || m;
      if (id === 'icon') return () => m('svg.icon');
      if (id === 'popover') return dependencies.popover || { Popover: { view() {} } };
      if (id === 'dialog') return dependencies.dialog || { view() {} };
      if (id in dependencies) return dependencies[id];
      throw new Error(`Unexpected dependency: ${id}`);
    },
    ...globals,
  });
  return module.exports;
}

function descendants(vnode) {
  const children = Array.isArray(vnode.children) ? vnode.children : [];
  return [vnode, ...children.flatMap((child) =>
    child && typeof child === 'object' ? descendants(child) : [])];
}

test('search fields have persistent accessible names', () => {
  const { SearchField } = load('widgets.js');
  const view = SearchField.view({ attrs: { placeholder: 'Search threads', value: 'Hello' } });
  const input = descendants(view).find((vnode) => vnode.tag === 'input');
  assert.equal(input.attrs['aria-label'], 'Search threads');
});

test('segmented controls support wrapping arrow keys, Home and End', () => {
  const { Segmented } = load('widgets.js');
  let selection = 'one';
  let focused = -1;
  const options = ['one', 'two', 'three'].map((id) => ({ id, label: id }));
  const view = Segmented.view({ attrs: {
    options, value: selection, onSelect: (id) => { selection = id; },
  } });
  const buttons = view.children;
  assert.deepEqual(buttons.map((button) => button.attrs.tabindex), [0, -1, -1]);
  const currentTarget = { parentElement: { children: options.map((_, index) => ({
    focus: () => { focused = index; },
  })) } };
  const press = (key) => buttons[0].attrs.onkeydown({ key, currentTarget, preventDefault() {} });
  press('ArrowLeft');
  assert.equal(selection, 'three');
  assert.equal(focused, 2);
  press('Home');
  assert.equal(selection, 'one');
  press('End');
  assert.equal(selection, 'three');
});

test('local-state sidebar items are real buttons', () => {
  const { Sidebar } = load('widgets.js');
  const view = Sidebar().view({ attrs: { tabs: ['Overview'], active: 'Overview', onSelect() {} } });
  const button = descendants(view).find((vnode) => vnode.tag === 'button');
  assert.ok(button);
  assert.equal(button.attrs.type, 'button');
});

test('segmented controls without a selection keep the first option tabbable', () => {
  const { Segmented } = load('widgets.js');
  const view = Segmented.view({ attrs: {
    options: [{ id: 'one', label: 'One' }, { id: 'two', label: 'Two' }],
    value: 'missing',
  } });
  assert.deepEqual(view.children.map((button) => button.attrs.tabindex), [0, -1]);
});

test('sidebar toolbar and links agree on the selected route', () => {
  const render = Object.assign((...args) => m(...args), {
    route: { get: () => '/forums/Subscribed/sample', Link: { view() {} } },
  });
  const { Sidebar } = load('widgets.js', { mithril: render });
  const view = Sidebar().view({ attrs: {
    tabs: ['All', 'Subscribed'], labels: { Subscribed: 'Subscribed forums' },
    baseRoute: '/forums/', mobileDrawer: true,
  } });
  const nodes = descendants(view);
  assert.equal(nodes.find((node) => node.attrs?.className === 'sidebar-drawer__current').children[0].children,
    'Subscribed forums');
  const selected = nodes.find((node) => node.attrs?.['aria-current'] === 'page');
  assert.equal(selected.attrs.href, '/forums/Subscribed');
});

test('chat Enter does not send while an IME is composing', () => {
  const { ChatComposer } = load('chat/chat_composer.js', {
    widgets: { Menu: { view() {} } },
    'chat/chat_emoji': {},
    'chat/chat_state': { autoResizeTextarea() {} },
  });
  let sends = 0;
  const view = ChatComposer().view({ attrs: { onSend: () => { sends++; } } });
  const field = view.flatMap((node) => node ? descendants(node) : []).find((node) => node.tag === 'textarea');
  field.attrs.onkeydown({ key: 'Enter', isComposing: true });
  field.attrs.onkeydown({ key: 'Enter', keyCode: 229 });
  assert.equal(sends, 0);
  field.attrs.onkeydown({ key: 'Enter', preventDefault() {} });
  assert.equal(sends, 1);
});

test('appearance survives blocked storage and rejects invalid preferences', () => {
  const document = { documentElement: { dataset: {} } };
  const appearance = load('appearance.js', {}, {
    document,
    localStorage: { setItem() { throw new Error('Blocked'); } },
  });
  assert.equal(appearance.getPreference(), 'system');
  appearance.setPreference('dark');
  assert.equal(document.documentElement.dataset.appearance, 'dark');
  appearance.setPreference('unknown');
  assert.equal(appearance.getPreference(), 'system');
});

test('menus keep their panel open through focus loss and select once', () => {
  const { Menu } = load('widgets.js');
  const menu = Menu();
  let selected = 0;
  let focused = 0;
  const attrs = { title: 'People filter', items: [{ label: 'Contacts', onclick: () => { selected++; } }] };
  let view = menu.view({ attrs });
  const trigger = view.children[0];
  trigger.attrs.oncreate({ dom: { focus: () => { focused++; } } });
  trigger.attrs.onclick();
  view = menu.view({ attrs });
  assert.equal(view.attrs.onfocusout, undefined);
  assert.equal(view.children[0].attrs['aria-expanded'], 'true');
  view.children[1].children[0].attrs.onclick();
  assert.equal(selected, 1);
  assert.equal(focused, 1);
  assert.equal(menu.view({ attrs }).children[0].attrs['aria-expanded'], 'false');
});

test('popup messages use the shared native dialog on every viewport', () => {
  let mounted;
  const Dialog = { view() {} };
  const render = Object.assign((...args) => m(...args), { mount: (_container, component) => { mounted = component; } });
  const document = { getElementById: () => ({ style: {} }) };
  const widgets = load('widgets.js', { mithril: render, dialog: Dialog }, { document });
  widgets.popupMessage(m('p', 'Help'), 'web-help-modal', { title: 'Open Web Help' });
  const popup = mounted.view();
  assert.equal(popup.tag, Dialog);
  assert.equal(popup.attrs.mobileOnly, false);
  assert.equal(popup.attrs.dismissOnBackdrop, false);
  assert.equal(popup.attrs.label, 'Open Web Help');
});

test('dialog follows visual viewport changes and removes its listeners', () => {
  const listeners = new Map();
  const viewport = {
    offsetTop: 0, offsetLeft: 0, width: 393, height: 659,
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name) => listeners.delete(name),
  };
  const window = { visualViewport: viewport, addEventListener() {}, removeEventListener() {} };
  const styles = {};
  const dom = { style: { setProperty: (name, value) => { styles[name] = value; } }, showModal() {}, close() {} };
  const Dialog = load('dialog.js', {}, { window, document: { activeElement: null } });
  const dialog = Dialog();
  dialog.oncreate({ dom, attrs: { mobileOnly: false } });
  assert.equal(styles['--dialog-height'], '659px');
  viewport.height = 320;
  viewport.offsetTop = 40;
  listeners.get('resize')();
  assert.equal(styles['--dialog-height'], '320px');
  assert.equal(styles['--dialog-top'], '40px');
  dialog.onremove({ dom });
  assert.equal(listeners.size, 0);
});

for (const [width, height, expected] of [
  [160, 80, [40, 0, 80, 80, 0, 0, 64, 64]],
  [80, 160, [0, 40, 80, 80, 0, 0, 64, 64]],
  [64, 64, [0, 0, 64, 64, 0, 0, 64, 64]],
]) {
  test(`group thumbnail center-crops ${width} × ${height} to 64 × 64 PNG`, async () => {
    let draw;
    let revoked;
    const canvas = {
      getContext: () => ({ drawImage: (_image, ...args) => { draw = args; } }),
      toDataURL: (type) => { assert.equal(type, 'image/png'); return 'data:image/png;base64,crop'; },
    };
    const prepare = load('group_thumbnail.js', {}, {
      Image: class {
        naturalWidth = width;
        naturalHeight = height;
        set src(_value) { this.onload(); }
      },
      URL: { createObjectURL: () => 'blob:test', revokeObjectURL: (url) => { revoked = url; } },
      document: { createElement: () => canvas },
    });
    assert.equal(await prepare({}), 'data:image/png;base64,crop');
    assert.deepEqual(draw, expected);
    assert.equal(canvas.width, 64);
    assert.equal(canvas.height, 64);
    assert.equal(revoked, 'blob:test');
  });
}

test('thumbnail decode failures reject and release the object URL', async () => {
  let released = false;
  const prepare = load('group_thumbnail.js', {}, {
    Image: class { set src(_value) { this.onerror(); } },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => { released = true; } },
  });
  await assert.rejects(prepare({}), /Unable to load thumbnail/);
  assert.equal(released, true);
});

for (const [file, factory, prefix, utility] of [
  ['boards/board_view.js', 'createboard', 'create-board-form', 'boards/boards_util'],
  ['channels/channel_view.js', 'createchannel', 'create-channel-form', 'channels/channels_util'],
]) {
  test(`${factory} blocks incomplete thumbnails and duplicate submissions`, async () => {
    let finishThumbnail;
    let finishRequest;
    let requests = 0;
    let closes = 0;
    const render = Object.assign((...args) => m(...args), { redraw() {} });
    const dependencies = {
      mithril: render,
      [utility]: { Data: {}, PUBLIC: 1, updatedisplaychannels: async () => {} },
      'boards/board_kanban': {},
      'people/people_util': {},
      'channels/sha1': {},
      'files/files_util': {},
      'files/files_downloads': {},
      comments: {},
      widgets: { closePopupMessage: () => { closes++; } },
      toast: { success() {}, error() {} },
      group_thumbnail: () => new Promise((resolve) => { finishThumbnail = resolve; }),
      rswebui: { rsJsonApiRequest: () => {
        requests++;
        return new Promise((resolve) => { finishRequest = resolve; });
      } },
    };
    const component = load(file, dependencies)[factory]();
    const vnode = { attrs: { authorId: [] } };
    const find = (suffix) => descendants(component.view(vnode))
      .find((node) => node.attrs?.className?.includes(`${prefix}__${suffix}`));
    const input = descendants(component.view(vnode)).find((node) => node.tag === 'input' && node.attrs.type === 'file');
    const upload = input.attrs.onchange({ target: { files: [{ name: 'logo.jpg' }] } });
    assert.equal(find('submit').attrs.disabled, true);
    await find('submit').attrs.onclick();
    assert.equal(requests, 0);
    finishThumbnail('data:image/png;base64,thumbnail');
    await upload;
    assert.equal(find('submit').attrs.disabled, false);
    const pending = find('submit').attrs.onclick();
    await find('submit').attrs.onclick();
    assert.equal(requests, 1);
    finishRequest({ body: { retval: true, channelId: 'created' } });
    await pending;
    assert.equal(closes, 1);
  });
}
