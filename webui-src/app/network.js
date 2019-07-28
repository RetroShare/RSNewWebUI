let m = require('mithril');
let rs = require('rswebui');


const Node = () => {
  return {
    view: (vnode) => m('.friend', {
      key: vnode.attrs.data[0].gpg_id
    }, [
      m('.grid-2col', [
        m('p', 'Name   :'), m('p', vnode.attrs.data[0].name),
      ]),
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
          console.log(friendListIds)
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

