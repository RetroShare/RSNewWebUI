const m = require('mithril');
const rs = require('rswebui');

const Reputation = () => {
  let addFriendIdAsContacts = undefined;
  let usePositiveDefault = undefined;
  let deleteBannedAfter = undefined;
  let negativeThreshold = undefined;
  let positiveThreshold = undefined;

  return {
    oninit: (vnode) => {
      rs.rsJsonApiRequest(
        '/rsIdentity/autoAddFriendIdsAsContact',
        {},
        (data) => (addFriendIdAsContacts = data.retval)
      );
      rs.rsJsonApiRequest(
        '/rsreputations/autoPositiveOpinionForContacts',
        {},
        (data) => (usePositiveDefault = data.retval)
      );
      rs.rsJsonApiRequest(
        '/rsIdentity/deleteBannedNodesThreshold',
        {},
        (data) => (deleteBannedAfter = data.retval)
      );
      rs.rsJsonApiRequest(
        '/rsreputations/thresholdForRemotelyPositiveReputation',
        {},
        (data) => (positiveThreshold = data.retval)
      );
      rs.rsJsonApiRequest(
        '/rsreputations/thresholdForRemotelyNegativeReputation',
        {},
        (data) => (negativeThreshold = data.retval)
      );
    },
    view: (vnode) =>
      m('.widget', [
        m('.widget__heading', m('h3', 'Reputation')),
        m('.widget__body', [
          m('.grid-2col', [
            m('p', 'Use "positive" as the default opinion for contacts(instead of neutral):'),
            m('input[type=checkbox]', {
              checked: usePositiveDefault,
              oninput: (e) => {
                usePositiveDefault = e.target.checked;
                rs.rsJsonApiRequest(
                  '/rsreputations/setAutoPositiveOpinionForContacts',
                  {
                    b: usePositiveDefault,
                  },
                  () => {}
                );
              },
            }),
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
            m('p', 'Difference in votes (+/-) to rate an ID positively:'),
            m('input[type=number]', {
              oninput: (e) => (positiveThreshold = e.target.value),
              value: positiveThreshold,
              onchange: () =>
                rs.rsJsonApiRequest(
                  '/rsreputations/setThresholdForRemotelyPositiveReputation',
                  {
                    thresh: positiveThreshold,
                  },
                  () => {}
                ),
            }),
            m('p', 'Difference in votes (+/-) to rate an ID negatively:'),
            m('input[type=number]', {
              oninput: (e) => (negativeThreshold = e.target.value),
              value: negativeThreshold,
              onchange: () =>
                rs.rsJsonApiRequest(
                  '/rsreputations/setThresholdForRemotelyNegativeReputation',
                  {
                    thresh: negativeThreshold,
                  },
                  () => {}
                ),
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
      ]),
  };
};

const Layout = () => {
  return {
    view: (vnode) => [m(Reputation)],
  };
};

module.exports = Layout;
