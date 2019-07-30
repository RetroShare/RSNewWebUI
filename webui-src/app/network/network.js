let m = require('mithril');
let rs = require('rswebui');


const ConfirmRemove = () => {
  return {
    view: (vnode) => [m('h3', 'Remove Friend'),
      m('hr'),
      m('p', 'Are you sure you want to end connections with this peer?'),
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
      key: vnode.attrs.data[0].gpg_id
    }, [
      m('i.fas.fa-angle-right', {
        class: 'fa-rotate-' + (vnode.state.isExpanded ? '90' : '0'),
        onclick: () => {
          vnode.state.isExpanded = !vnode.state.isExpanded;
          console.log(vnode.attrs.data)
          console.log(vnode.state)
        },
      }),
      m('i.fas.fa-2x.fa-user-circle'),
      m('span', vnode.attrs.data[0].name),
      m('.details', {
        style: "display:" + (vnode.state.isExpanded ? "block" : "none"),
      }, [
        m('.grid-2col', [
          m('p', 'Last contacted: '),
          m('p', new Date(vnode.attrs.data[0].lastConnect * 1000).toDateString()),
          m('p', 'Online: '),
          m('i.fas', {
            class: vnode.state.isOnline ? 'fa-check-circle' : 'fa-times-circle'
          }),
        ]),
        m('h4', 'Locations'),
        vnode.attrs.data.map((loc) => m('.location', [
          m('i.fas.fa-user-tag'), m('span', loc.location),
          m('p', 'ID: '),
          m('p', loc.id),
        ])),
        m('button.red', {
          onclick: () => rs.popupMessage(m(ConfirmRemove, {
            gpg: vnode.attrs.data[0].gpg_id
          }))
        }, 'Remove friend'),
      ])
    ]),
  };
};

const Friends = () => {
  let nodes = {};
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
                nodes[details.det.gpg_id] === undefined ?
                  nodes[details.det.gpg_id] = [details.det] :
                  nodes[details.det.gpg_id].push(details.det);
              })
          );
        });
    },
    view: () => m('.widget', [
      m('h3', 'Friend nodes'),
      m('hr'),
      Object.keys(nodes).map((id) => m(Node, {
        data: nodes[id]
      })),
    ]),
  };
};

const Layout = () => {
  return {
    view: () => m('.tab-page', [
      m(Friends),
    ])
  }
};

module.exports = Layout;

