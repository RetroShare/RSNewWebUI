const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const Data = require('network/network_data');
const peopleUtil = require('people/people_util');
const { State, startDirectChat, getOnlineSslId } = require('network/network_state');

function formatFingerprint(fingerprint) {
  return String(fingerprint || '')
    .replace(/\s/g, '')
    .match(/.{1,4}/g)
    ?.join(' ') || '';
}

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
            State.selectedFriendGpgId = null;
            Data.refreshGpgDetails().then(() => m.redraw());
            widget.popupMessage(m('p', 'Friend removed successfully.'));
          },
        },
        'Confirm'
      ),
    ],
  };
};

const DetailsTab = () => {
  return {
    view: () => {
      const gpgId = State.selectedFriendGpgId;
      const friend = Data.gpgDetails[gpgId];
      if (!friend) return null;

      const friendGxsId = State.gpgToGxsIdMap[gpgId.toLowerCase()];
      const status = Data.getStatusPresentation(friend.statusValue, friend.isOnline);
      const fingerprint = formatFingerprint(friend.fingerprint);

      return m('.network-detail-view', [
        m('.detail-header', [
          m('.friend-avatar', m(peopleUtil.UserAvatar, {
            avatar: friend.avatar ? { mData: { base64: friend.avatar } } : undefined,
            firstLetter: (friend.name || '?').slice(0, 1).toUpperCase(),
            size: 128,
            seed: gpgId,
          })),
          m('.detail-title', [
            m('h2', friend.name),
            m('.detail-subtitle', [
              m('i.fas.fa-fingerprint'),
              m('span', 'GPG ID: ' + gpgId),
            ]),
            m('.detail-actions', { style: 'margin-top: 0.75rem;' }, [
              m(
                'button',
                {
                  onclick: () => {
                    const sslId = getOnlineSslId(gpgId);
                    if (sslId) {
                      State.activeTab = 'chat';
                      startDirectChat(sslId);
                    }
                  },
                },
                [m('i.fas.fa-comments'), m('span.btn-text', ' Start Chat')]
              ),
              m(
                'button',
                {
                  onclick: () => {
                    State.showMailCompose = true;
                  },
                },
                [m('i.fas.fa-envelope'), m('span.btn-text', ' Send Mail')]
              ),
            ]),
          ]),
        ]),

        m('.detail-section', [
          m('h3', 'Profile Info'),
          m('.info-grid', [
            m('.info-label', 'Status'),
            m(
              '.info-value',
              { style: `color: ${status.color}; font-weight: 600;` },
              status.label
            ),
            m('.info-label', 'Custom Status'),
            m(
              '.info-value',
              { style: 'font-style: italic; color: #64748b;' },
              friend.customState || 'None'
            ),
            friendGxsId ? [
              m('.info-label', 'GXS Identity'),
              m('.info-value', friendGxsId),
            ] : null,
            m('.info-label', 'Node GPG Key'),
            m('.info-value', gpgId),
            m('.info-label', 'PGP Fingerprint'),
            m('.info-value', fingerprint || 'Unavailable'),
          ]),
        ]),

        m('.detail-section', [
          m('h3', 'Locations (' + friend.locations.length + ')'),
          m(
            '.locations-grid',
            friend.locations
              .slice()
              .sort((a, b) => (a.isOnline === b.isOnline ? 0 : a.isOnline ? -1 : 1))
              .map((loc) => {
              const locStatus = Data.getStatusPresentation(loc.statusValue, loc.isOnline);
              return m('.location-card', { key: loc.id }, [
                m('.loc-header', [
                  m('.loc-name', loc.name),
                  m(
                    '.loc-status',
                    { style: { color: locStatus.color } },
                    locStatus.label
                  ),
                ]),
                m('.loc-body', [
                  m('.loc-label', 'SSL ID'),
                  m('.loc-val', loc.id),
                  m('.loc-label', 'Last Seen'),
                  m('.loc-val', new Date(loc.lastSeen * 1000).toLocaleString()),
                ]),
                m('.loc-footer', [
                  m(
                    'button.red',
                    {
                      onclick: () =>
                        widget.popupMessage(
                          m(ConfirmRemove, {
                            gpg_id: loc.gpg_id,
                          })
                        ),
                    },
                    'Remove Location'
                  ),
                ]),
              ]);
            })
          ),
        ]),
      ]);
    },
  };
};

module.exports = DetailsTab;
