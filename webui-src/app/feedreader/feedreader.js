const m = require('mithril');
const rs = require('rswebui');
const api = (method, body = {}) => rs.rsJsonApiRequest(`/rsFeedReader/${method}`, body);

function safeHtml(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  doc.querySelectorAll('script,iframe,object,embed,form,style').forEach((node) => node.remove());
  doc.querySelectorAll('*').forEach((node) => [...node.attributes].forEach((attr) => {
    if (attr.name.toLowerCase().startsWith('on')) node.removeAttribute(attr.name);
    if ((attr.name === 'href' || attr.name === 'src') && /^javascript:/i.test(attr.value)) node.removeAttribute(attr.name);
  }));
  return doc.body.innerHTML;
}

module.exports = () => {
  let tree = [], selectedFeed = null, selectedMessage = null, messages = [];
  let loading = false, error = '', showAdd = false, addType = 'feed';
  let form = { name: '', url: '', parentId: 0 };

  async function loadBranch(parentId = 0) {
    const res = await api('getFeeds', { parentId });
    if (res.status !== 200) throw new Error(res.body.error || 'Unable to load feeds');
    return Promise.all(res.body.feeds.map(async (feed) => ({
      ...feed, children: feed.folder ? await loadBranch(feed.feedId) : [],
    })));
  }

  async function loadTree() {
    loading = true; error = '';
    try { tree = await loadBranch(); } catch (e) { error = e.message; }
    loading = false; m.redraw();
  }

  async function selectFeed(feed) {
    selectedFeed = feed; selectedMessage = null; messages = []; error = '';
    const res = await api('getMessages', { feedId: feed.feedId });
    if (res.status === 200) messages = res.body.messages.sort((a, b) => b.pubDate - a.pubDate);
    else error = res.body.error || 'Unable to load articles';
    m.redraw();
  }

  async function openMessage(message) {
    selectedMessage = message;
    if (!message.read) {
      await api('setMessageRead', { feedId: message.feedId, msgId: message.msgId, read: true });
      message.read = true;
    }
    m.redraw();
  }

  async function addItem() {
    const res = await api(addType === 'folder' ? 'addFolder' : 'addFeed', form);
    if (res.status === 200) {
      showAdd = false; form = { name: '', url: '', parentId: 0 }; await loadTree();
    } else error = res.body.error || 'Unable to add item';
  }

  async function removeFeed(feed) {
    if (!window.confirm(`Remove “${feed.name || feed.url}”?`)) return;
    const res = await api('removeFeed', { feedId: feed.feedId });
    if (res.status === 200) {
      if (selectedFeed && selectedFeed.feedId === feed.feedId) {
        selectedFeed = null; selectedMessage = null; messages = [];
      }
      await loadTree();
    }
  }

  function renderTree(items, depth = 0) {
    return items.map((item) => [
      m('.feedreader-tree-item', {
        class: selectedFeed && selectedFeed.feedId === item.feedId ? 'selected' : '',
        style: { paddingLeft: `${12 + depth * 16}px` },
        onclick: () => !item.folder && selectFeed(item),
      }, [
        m('i', { class: item.folder ? 'fas fa-folder' : 'fas fa-rss' }),
        m('span', item.name || item.url || 'Untitled'),
        m('button.feedreader-icon-button', {
          title: 'Remove', onclick: (event) => { event.stopPropagation(); removeFeed(item); },
        }, m('i.fas.fa-trash')),
      ]),
      item.children && renderTree(item.children, depth + 1),
    ]);
  }

  return {
    oninit: loadTree,
    view: () => m('.feedreader-page', [
      m('.feedreader-toolbar', [
        m('h2', [m('i.fas.fa-rss'), ' FeedReader']),
        m('button', { onclick: () => { addType = 'feed'; showAdd = true; } }, 'Add feed'),
        m('button', { onclick: () => { addType = 'folder'; showAdd = true; } }, 'Add folder'),
        m('button', { onclick: loadTree, title: 'Reload feed tree' }, m('i.fas.fa-sync-alt')),
      ]),
      error && m('.feedreader-error', error),
      showAdd && m('.feedreader-add', [
        m('h3', addType === 'folder' ? 'Add folder' : 'Add feed'),
        m('input', { placeholder: 'Name', value: form.name, oninput: (e) => (form.name = e.target.value) }),
        addType === 'feed' && m('input', { placeholder: 'https://example.org/feed.xml', value: form.url, oninput: (e) => (form.url = e.target.value) }),
        m('button', { onclick: addItem }, 'Save'),
        m('button', { onclick: () => (showAdd = false) }, 'Cancel'),
      ]),
      m('.feedreader-columns', [
        m('aside.feedreader-tree', loading ? m('p', 'Loading…') : renderTree(tree)),
        m('section.feedreader-messages', selectedFeed ? [
          m('.feedreader-section-title', [
            m('h3', selectedFeed.name || selectedFeed.url),
            m('button', { onclick: async () => {
              await api('refreshFeed', { feedId: selectedFeed.feedId }); await selectFeed(selectedFeed);
            } }, [m('i.fas.fa-sync-alt'), ' Refresh']),
          ]),
          messages.length ? messages.map((message) => m('.feedreader-message-row', {
            class: `${message.read ? 'read' : 'unread'} ${selectedMessage === message ? 'selected' : ''}`,
            onclick: () => openMessage(message),
          }, [
            m('strong', message.title || '(Untitled article)'), m('span', message.author),
            m('time', message.pubDate ? new Date(message.pubDate * 1000).toLocaleString() : ''),
          ])) : m('p.feedreader-placeholder', 'No articles in this feed.'),
        ] : m('p.feedreader-placeholder', 'Select a feed to read its articles.')),
        m('article.feedreader-reader', selectedMessage ? [
          m('h2', selectedMessage.title || '(Untitled article)'),
          m('.feedreader-article-meta', [selectedMessage.author, selectedMessage.pubDate ? new Date(selectedMessage.pubDate * 1000).toLocaleString() : ''].filter(Boolean).join(' · ')),
          selectedMessage.link && m('a', { href: selectedMessage.link, target: '_blank', rel: 'noopener noreferrer' }, 'Open original article'),
          m('.feedreader-article-body', { innerHTML: safeHtml(selectedMessage.descriptionTransformed || selectedMessage.description) }),
          m('.feedreader-article-actions', [
            m('button', { onclick: async () => {
              selectedMessage.read = !selectedMessage.read;
              await api('setMessageRead', { feedId: selectedMessage.feedId, msgId: selectedMessage.msgId, read: selectedMessage.read });
            } }, selectedMessage.read ? 'Mark unread' : 'Mark read'),
            m('button', { onclick: async () => {
              if (!window.confirm('Delete this article?')) return;
              await api('removeMessage', { feedId: selectedMessage.feedId, msgId: selectedMessage.msgId });
              await selectFeed(selectedFeed);
            } }, 'Delete'),
          ]),
        ] : m('p.feedreader-placeholder', 'Select an article to view it.')),
      ]),
    ]),
  };
};
