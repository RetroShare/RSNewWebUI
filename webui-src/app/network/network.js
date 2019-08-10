let m = require('mithril');
let rs = require('rswebui');


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
    isOnline: true,
    isExpanded: false,

    oninit: (vnode) => rs.rsJsonApiRequest('/rsPeers/isOnline', {
      sslId: vnode.attrs.data[0].id,
    }, (data) => vnode.state.isOnline = data.retval),

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
            onclick: () => rs.popupMessage(m(ConfirmRemove, {
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
      rs.rsJsonApiRequest(
        '/rsPeers/getFriendList', {},
        (friendListIds) => {
          friendListIds.sslIds.map(
            (sslId) => rs.rsJsonApiRequest(
              '/rsPeers/getPeerDetails', {
                sslId
              },
              (details) => {
                // Store nodes obj with gpg id as key
                // single node can have multiple identities
                if(FriendNodes[details.det.gpg_id] === undefined)
                  FriendNodes[details.det.gpg_id] = {
                    locations: [details.det],
                    isSearched: true
                  }
                else
                  FriendNodes[details.det.gpg_id].locations.push(
                    details.det);
              })
          );
        });
    },
    view: () => m('.widget', [
      m('h3', 'Friend nodes'),
      m('hr'),
      Object.keys(FriendNodes).map((id) => m(Node, {
        data: FriendNodes[id].locations,
        isSearched: FriendNodes[id].isSearched,
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

