let m = require('mithril');


const Sidebar = () => {
  let active = 0;
  return {
    view: (v) => m('.sidebar',
      v.attrs.tabs.map((panelName, index) => m('a', {
          href: v.attrs.baseRoute + panelName,
          oncreate: m.route.link,
          class: index === active ?
            'selected-sidebar-link' : '',
          onclick: function() {
            active = index;
          },
        },
        panelName)),
    ),
  };
};

// There are ways of doing this inside m.route but it is probably
// cleaner and faster when kept outside of the main auto
// rendering system
function popupMessage(message) {
  const container = document.getElementById('modal-container');
  container.style.display = 'block';
  m.render(container,
    m('.modal-content', [
      m('button.red', {
        onclick: () => container.style.display = 'none'
      }, m('i.fas.fa-times')),
      message,
    ]));
};

module.exports = {
  Sidebar,
  popupMessage,
};

