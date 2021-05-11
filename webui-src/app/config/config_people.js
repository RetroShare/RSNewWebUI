const m = require('mithril');
const rs = require('rswebui');

const Reputation = () => {
  let addFriendIdAsContacts = undefined;
  let deleteBannedAfter = undefined;
  return {
    oninit: (vnode) => {
      rs.rsJsonApiRequest(
        '/rsIdentity/autoAddFriendIdsAsContact',
        {},
        (data) => (addFriendIdAsContacts = data.retval)
      );
      rs.rsJsonApiRequest(
        '/rsIdentity/deleteBannedNodesThreshold',
        {},
        (data) => (deleteBannedAfter = data.retval)
      );
    },
    view: (vnode) =>
      m('.widget .', [
        m('h3', 'Reputation'),
        m('hr'),
        m('.grid-2col', [
          m('p', 'Automatically add identities owned by friend nodes to my contacts:'),
          m('input[type=checkbox]', {
            checked: addFriendIdAsContacts,
            oninput: (e) => {
              addFriendIdAsContacts = e.target.checked;
              rs.rsJsonApiRequest(
                '/rsIdentity/setAutoAddFriendIdsAsContact',
                {
                  enabled: addFriendIdAsContacts,
                },
                () => {}
              );
            },
          }),
          m('p', 'Delete banned identities after(in days, 0 means indefinitely):'),
          m('input[type=number]', {
            oninput: (e) => (deleteBannedAfter = e.target.value),
            value: deleteBannedAfter,
            onchange: () =>
              rs.rsJsonApiRequest(
                '/rsIdentity/setDeleteBannedNodesThreshold',
                {
                  days: deleteBannedAfter,
                },
                () => {}
              ),
          }),
        ]),
      ]),
  };
};

const Layout = () => {
  return {
    view: (vnode) => [m(Reputation)],
  };
};

module.exports = Layout;
