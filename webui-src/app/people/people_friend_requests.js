const m = require('mithril');
const rs = require('rswebui');
const peopleUtil = require('people/people_util');

const FriendRequests = () => {
  let requests = [];
  let loading = true;

  const loadRequests = () => {
    rs.rsJsonApiRequest('/rsPeers/getFriendList', {}, (data) => {
      if (data && data.sslIds) {
        const pending = data.sslIds.filter((id) => id && id.startsWith('00000000'));
        // For now, load all friends and check their status
        // The actual pending requests would come from a dedicated API
        rs.rsJsonApiRequest('/rsIdentity/getIdentitiesSummaries', {}, (summary) => {
          // Filter for potential pending requests based on relationship
          requests = [];
          loading = false;
          m.redraw();
        });
      }
    });
  };

  const acceptRequest = (sslId) => {
    rs.rsJsonApiRequest('/rsPeers/acceptFriend', { sslId }, (res) => {
      if (res.retval) {
        requests = requests.filter((r) => r.sslId !== sslId);
        m.redraw();
      }
    });
  };

  const declineRequest = (sslId) => {
    rs.rsJsonApiRequest('/rsPeers/removeFriend', { sslId }, (res) => {
      if (res.retval) {
        requests = requests.filter((r) => r.sslId !== sslId);
        m.redraw();
      }
    });
  };

  return {
    oninit: () => loadRequests(),
    view: () => {
      if (loading) {
        return m('.widget', m('.widget__heading', m('h3', 'Friend Requests')), m('.widget__body', m('p', 'Loading...')));
      }
      return m('.widget', [
        m('.widget__heading', m('h3', 'Friend Requests')),
        m('.widget__body', [
          requests.length === 0
            ? m('p', 'No pending friend requests')
            : m(
                '.friend-requests',
                requests.map((req) =>
                  m('.friend-request-item', [
                    m(peopleUtil.UserAvatar, {
                      avatar: req.avatar,
                      firstLetter: req.name ? req.name[0].toUpperCase() : '?',
                    }),
                    m('.friend-request-info', [
                      m('p.bold', req.name || 'Unknown'),
                      m('p.small', req.id || req.sslId),
                    ]),
                    m('.friend-request-actions', [
                      m('button', { onclick: () => acceptRequest(req.sslId) }, 'Accept'),
                      m('button.red', { onclick: () => declineRequest(req.sslId) }, 'Decline'),
                    ]),
                  ])
                )
              ),
        ]),
      ]);
    },
  };
};

module.exports = {
  view: () => m(FriendRequests),
};
