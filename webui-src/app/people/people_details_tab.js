const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const peopleUtil = require('people/people_util');
const ownIdsLayout = require('people/people_ownids');
const { EditIdentity, DeleteIdentity } = ownIdsLayout;
const {
  State,
  fetchIdDetails,
  getSafeAvatar,
  get64Num,
  createUsageString,
  loadGxsIdentities,
  initializeDistantChat,
} = require('people/people_state');

const DetailsTab = () => {
  return {
    view: () => {
      fetchIdDetails(State.selectedId);
      const details = State.selectedId ? State.gxsIdToDetailsMap[State.selectedId] : null;
      if (!details) return null;

      const name = details.mNickname || details.mGroupName || 'Unknown';
      const isOwn = State.ownGxsIds.includes(State.selectedId);
      const entry = rs.userList.userMap[State.selectedId];
      const isContact = entry && entry.isContact;
      const pgpId = details.mPgpId;

      return m('.network-detail-view', [
        m('.detail-header', [
          m('.avatar-container', {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              marginRight: '1rem',
            },
          }, [
            m('.friend-avatar', m(peopleUtil.UserAvatar, {
              avatar: getSafeAvatar(details),
              firstLetter: (name || '?').slice(0, 1).toUpperCase(),
              identityId: State.selectedId,
              size: 128,
              isSquare: true,
            })),
            m('.identity-votes', {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                marginTop: '0.5rem',
              },
            }, [
              m('.vote-positive', {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  color: '#22c55e',
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                },
              }, [
                m('i.fas.fa-thumbs-up'),
                m('span', details.mReputation ? details.mReputation.mFriendsPositiveVotes : 0),
              ]),
              m('.vote-negative', {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  color: '#ef4444',
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                },
              }, [
                m('i.fas.fa-thumbs-down'),
                m('span', details.mReputation ? details.mReputation.mFriendsNegativeVotes : 0),
              ]),
            ]),
          ]),
          m('.detail-title', [
            m('h2', name),
            m('.detail-subtitle', [
              m('i.fas.fa-id-card'),
              m('span', isOwn ? 'My Identity' : isContact ? 'Saved Contact' : 'Discovered Identity'),
            ]),
            m('.detail-actions', [
              isOwn
                ? [
                    m(
                      'button.btn',
                      {
                        onclick: () =>
                          widget.popupMessage(
                            m(EditIdentity, {
                              details,
                            })
                          ),
                      },
                      [m('i.fas.fa-edit'), ' Edit']
                    ),
                    m(
                      'button.btn.red',
                      {
                        onclick: () =>
                          widget.popupMessage(
                            m(DeleteIdentity, {
                              id: details.mId,
                              name: details.mNickname,
                            })
                          ),
                      },
                      [m('i.fas.fa-trash-alt'), ' Delete']
                    ),
                  ]
                : [
                    m(
                      'button.btn.blue',
                      {
                        onclick: () => {
                          State.activeTab = 'chat';
                          initializeDistantChat();
                        },
                      },
                      [m('i.fas.fa-comment-alt'), ' Start Chat']
                    ),
                    m(
                      'button.btn.blue',
                      {
                        onclick: () => {
                          State.showMailCompose = true;
                        },
                      },
                      [m('i.fas.fa-envelope'), ' Send Mail']
                    ),
                    m(
                      'button.btn' + (isContact ? '.red' : '.blue'),
                      {
                        onclick: () => {
                          rs.rsJsonApiRequest(
                            '/rsIdentity/setAsRegularContact',
                            { id: State.selectedId, isContact: !isContact },
                            () => {
                              rs.userList.loadUsers();
                              loadGxsIdentities();
                            }
                          );
                        },
                      },
                      isContact
                        ? [m('i.fas.fa-user-minus'), ' Remove Contact']
                        : [m('i.fas.fa-user-plus'), ' Add Contact']
                    ),
                  ],
            ]),
          ]),
        ]),
        m('.detail-section', [
          m('h3', 'Identity Info'),
          m('.info-grid', [
            m('.info-label', 'GXS ID'),
            m('.info-value', details.mId),
            m('.info-label', 'Type'),
            m('.info-value', details.mFlags === 14 ? 'Signed ID' : 'Anonymous ID'),
            m('.info-label', 'Owner Node GPG'),
            m('.info-value', pgpId && pgpId !== '0000000000000000' ? pgpId : 'None'),
            m('.info-label', 'Created On'),
            m(
              '.info-value',
              typeof details.mPublishTS === 'object'
                ? new Date(details.mPublishTS.xint64 * 1000).toLocaleString()
                : 'Unknown'
            ),
            m('.info-label', 'Last Used'),
            m(
              '.info-value',
              typeof details.mLastUsageTS === 'object'
                ? new Date(details.mLastUsageTS.xint64 * 1000).toLocaleDateString()
                : 'Unknown'
            ),
            m('.info-label', 'Friend votes'),
            m('.info-value', details.mReputation && (details.mReputation.mFriendsPositiveVotes > 0 || details.mReputation.mFriendsNegativeVotes > 0)
              ? `${details.mReputation.mFriendsPositiveVotes} positive, ${details.mReputation.mFriendsNegativeVotes} negative`
              : 'No votes from friends'),
            m('.info-label', 'Overall'),
            m('.info-value', (() => {
              const pos = details.mReputation ? details.mReputation.mFriendsPositiveVotes : 0;
              const neg = details.mReputation ? details.mReputation.mFriendsNegativeVotes : 0;
              if (pos > neg) return 'Positive';
              if (pos < neg) return 'Negative';
              return 'Neutral';
            })()),
          ]),
        ]),
        m('.detail-section', [
          m('h3', 'Usage Statistics'),
          m('.usage-list', [
            (!details.mUseCases || details.mUseCases.length === 0)
              ? m('p.usage-placeholder', { style: 'font-style: italic; color: #64748b; padding: 0.5rem 0;' }, '[No record in current session]')
              : (() => {
                  const sorted = [...details.mUseCases].sort((a, b) => get64Num(b.value) - get64Num(a.value));
                  return sorted.map((item) => {
                    const usage = item.key;
                    const ts = get64Num(item.value);
                    const dateStr = ts > 0 ? new Date(ts * 1000).toLocaleString() : 'Unknown';
                    return m('.usage-item', {
                      style: {
                        padding: '0.5rem 0',
                        borderBottom: '1px solid #f1f5f9',
                        fontSize: '0.9rem',
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'flex-start',
                      },
                    }, [
                      m('strong.usage-time', { style: 'color: #64748b; flex-shrink: 0; min-width: 150px;' }, dateStr),
                      m('span.usage-desc', createUsageString(usage)),
                    ]);
                  });
                })(),
          ]),
        ]),
      ]);
    },
  };
};

module.exports = DetailsTab;
