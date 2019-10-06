let m = require('mithril');
let rs = require('rswebui');
let widget = require('widgets');
let data = require('network_data');


const ConfirmRemove = () => {
  return {
    view: (vnode) => [m('h3', 'Remove Friend'),
      m('hr'),
      m('p', 'Are you sure you want to end connections with this node?'),
      m('button', {
        onclick: () => {
          rs.rsJsonApiRequest('/rsPeers/removeFriend', {
            pgpId: vnode.attrs.gpg
          });
          m.redraw();
        }
      }, 'Confirm'),
    ],
  };
};

const Node = () => {
  return {
    isOnline: false,
    isExpanded: false,

    oninit(v) {
      v.state.isOnline = false;
      // check if any one location is online
      v.attrs.data.map(node => rs.rsJsonApiRequest(
        '/rsPeers/isOnline', {
          sslId: node.id
        }, (data) => data.retval ? v.state.isOnline = true : undefined));
    },

    view: (vnode) => m('.friend', {
      key: vnode.attrs.data[0].gpg_id,
      style: "display:" + (vnode.attrs.isSearched ? "block" : "none"),
    }, [
      m('i.fas.fa-angle-right', {
        class: 'fa-rotate-' + (vnode.state.isExpanded ? '90' : '0'),
        onclick: () => vnode.state.isExpanded = !vnode.state.isExpanded,
      }),
      m('i.fas.fa-2x.fa-user-circle'),
      m('span', vnode.attrs.data[0].name),
      m('i.fas', {
        class: vnode.state.isOnline ? 'fa-check-circle' : 'fa-times-circle'
      }),
      m('.details', {
        style: "display:" + (vnode.state.isExpanded ? "block" : "none"),
      }, [
        m('.grid-2col', [
          m('p', 'Last contacted :'),
          m('p', new Date(vnode.attrs.data[0].lastConnect * 1000).toDateString()),
          m('p', 'Online :'),
          m('i.fas', {
            class: vnode.state.isOnline ? 'fa-check-circle' : 'fa-times-circle'
          }),
        ]),
        m('h4', 'Locations'),
        vnode.attrs.data.map((loc) => m('.location', [
          m('i.fas.fa-user-tag'), m('span', loc.location),
          m('p', 'ID :'),
          m('p', loc.id),
          m('p', 'Online :'),
          m('i.fas', {
            class: vnode.state.isOnline ? 'fa-check-circle' : 'fa-times-circle'
          }),
          m('button.red', {
            onclick: () => widget.popupMessage(m(ConfirmRemove, {
              gpg: loc.gpg_id,
            }))
          }, 'Remove node'),
        ])),
      ])
    ]),
  };
};

let FriendNodes = {};

let searchString = '';
const SearchBar = () => {
  return {
    view: () => m('input[type=text][placeholder=search].searchbar', {
      value: searchString,
      oninput: (e) => {
        searchString = e.target.value.toLowerCase();
        for(let id in FriendNodes) {
          if(FriendNodes[id].locations[0].name.toLowerCase().indexOf(
              searchString) > -1) {
            FriendNodes[id].isSearched = true;
          } else {
            FriendNodes[id].isSearched = false;
          }
        }
      },
    })
  };
};

const Friends = () => {
  return {
    oninit: () => {
        data.refreshGpgDetails();
    },
    view: () => m('.widget', [
      m('h3', 'Friend nodes'),
      m('hr'),
      Object.keys(data.gpgDetails).map((id) => m(Node, {
        data: data.gpgDetails[id].locations,
        isSearched: data.gpgDetails[id].isSearched,
      })),
    ]),
  };
};

const Layout = () => {
  return {
    view: () => m('.tab-page', [
      m(SearchBar),
      m(Friends),
    ])
  }
};

module.exports = Layout;

