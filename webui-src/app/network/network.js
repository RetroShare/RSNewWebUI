const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const Data = require('network/network_data');

const ConfirmRemove = () => {
  return {
    view: (vnode) => [
      m('h3', 'Remove Friend'),
      m('hr'),
      m('p', 'Are you sure you want to end connections with this node?'),
      m(
        'button',
        {
          onclick: () => {
            rs.rsJsonApiRequest('/rsPeers/removeFriend', {
              pgpId: vnode.attrs.gpg_id,
            });
            m.redraw();
          },
        },
        'Confirm'
      ),
    ],
  };
};

const Locations = () => {
  return {
    view: (v) => [
      m('h4', 'Locations'),
      v.attrs.locations.map((loc) =>
        m('.location', [
          m('i.fas.fa-user-tag', { style: 'margin-top:3px' }),
          m('span', { style: 'margin-top:1px' }, loc.name),
          m('p', 'ID :'),
          m('p', loc.id),
          m('p', 'Last contacted :'),
          m('p', new Date(loc.lastSeen * 1000).toDateString()),
          m('p', 'Online :'),
          m('i.fas', {
            class: loc.isOnline ? 'fa-check-circle' : 'fa-times-circle',
          }),
          m(
            'button.red',
            {
              onclick: () =>
                widget.popupMessage(
                  m(ConfirmRemove, {
                    gpg: loc.gpg_id,
                  })
                ),
            },
            'Remove node'
          ),
        ])
      ),
    ],
  };
};

const Friend = () => {
  return {
    isExpanded: false,

    view: (vnode) =>
      m(
        '.friend',
        {
          key: vnode.attrs.id,
          class: Data.gpgDetails[vnode.attrs.id].isSearched ? '' : 'hidden',
        },
        [
          m('i.fas.fa-angle-right', {
            class: 'fa-rotate-' + (vnode.state.isExpanded ? '90' : '0'),
            style: 'margin-top:12px',
            onclick: () => (vnode.state.isExpanded = !vnode.state.isExpanded),
          }),
          m('.brief-info', { class: Data.gpgDetails[vnode.attrs.id].isOnline ? 'online' : '' }, [
            m('i.fas.fa-2x.fa-user-circle'),
            m('span', Data.gpgDetails[vnode.attrs.id].name),
          ]),
          m(
            '.details',
            {
              style: 'display:' + (vnode.state.isExpanded ? 'block' : 'none'),
            },
            [
              m(Locations, {
                locations: Data.gpgDetails[vnode.attrs.id].locations,
              }),
            ]
          ),
        ]
      ),
  };
};

const SearchBar = () => {
  let searchString = '';
  return {
    view: () =>
      m('input.searchbar', {
        type: 'text',
        placeholder: 'search',
        value: searchString,
        oninput: (e) => {
          searchString = e.target.value.toLowerCase();
          for (const id in Data.gpgDetails) {
            if (Data.gpgDetails[id].name.toLowerCase().indexOf(searchString) > -1) {
              Data.gpgDetails[id].isSearched = true;
            } else {
              Data.gpgDetails[id].isSearched = false;
            }
          }
        },
      }),
  };
};

const FriendsList = () => {
  return {
    oninit: () => {
      Data.refreshGpgDetails();
    },
    view: () =>
      m('.widget', [
        m('.widget__heading', [m('h3', 'Friend nodes'), m(SearchBar)]),
        m('hr'),
        Object.entries(Data.gpgDetails)
          .sort((a, b) => {
            return a[1].isOnline === b[1].isOnline ? 0 : a[1].isOnline ? -1 : 1;
          })
          .map((item) => {
            const id = item[0];
            return m(Friend, { id });
          }),
      ]),
  };
};

const Layout = () => {
  return {
    view: () => m('.node-panel', m(FriendsList)),
  };
};

module.exports = Layout;
