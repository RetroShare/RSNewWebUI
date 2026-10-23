const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const peopleUtil = require('people/people_util');
const ownIdsLayout = require('people/people_ownids');
const icon = require('icon');
const { EditIdentity, DeleteIdentity } = ownIdsLayout;
const {
  State,
  fetchIdDetails,
  refreshSelectedIdDetails,
  getSafeAvatar,
  get64Num,
  createUsageString,
  loadGxsIdentities,
  initializeDistantChat,
} = require('people/people_state');

const DetailsTab = () => {
  return {
    oninit: () => refreshSelectedIdDetails(),
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
            m('.identity-votes', [
              m('.vote-positive', [
                icon('thumbs-up'),
                m('span', details.mReputation ? details.mReputation.mFriendsPositiveVotes : 0),
              ]),
              m('.vote-negative', [
                icon('thumbs-down'),
                m('span', details.mReputation ? details.mReputation.mFriendsNegativeVotes : 0),
              ]),
            ]),
          ]),
          m('.detail-title', [
            m('h2', name),
            m('.detail-subtitle', [
              icon('id-card'),
              m('span', isOwn ? 'My Identity' : isContact ? 'Saved Contact' : 'Discovered Identity'),
            ]),
            m('.detail-actions', [
              isOwn
                ? [
                    m('button.btn.is-primary',
                      {
                        onclick: () =>
                          widget.popupMessage(
                            m(EditIdentity, {
                              details,
                            }),
                            'edit-identity-modal',
                            {
                              title: 'Edit Identity',
                              lead: 'Rename this identity or replace its avatar.',
                            }
                          ),
                      },
                      [icon('edit'), m('span.btn-text', ' Edit')]
                    ),
                    m(
                      'button.btn.is-danger',
                      {
                        onclick: () =>
                          DeleteIdentity({
                            id: details.mId,
                            name: details.mNickname,
                          }),
                      },
                      [icon('trash-alt'), m('span.btn-text', ' Delete')]
                    ),
                  ]
                : [
                    m('button.btn.blue.is-primary',
                      {
                        onclick: () => {
                          State.activeTab = 'chat';
                          initializeDistantChat();
                        },
                      },
                      [icon('comments'), m('span.btn-text', ' Start Chat')]
                    ),
                    m('button.btn.blue.is-primary',
                      {
                        onclick: () => {
                          State.showMailCompose = true;
                        },
                      },
                      [icon('envelope'), m('span.btn-text', ' Send Mail')]
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
                        ? [icon('user-minus'), m('span.btn-text', ' Remove Contact')]
                        : [icon('user-plus'), m('span.btn-text', ' Add Contact')]
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
            //  mFlags is a bitfield: RS_IDENTITY_FLAGS_PGP_LINKED is 0x2.
            //  Comparing the whole word against 14 -- PGP_LINKED | PGP_KNOWN |
            //  IS_OWN_ID -- only ever matched our own signed identities, so
            //  every signed identity of somebody else read "Anonymous".
            m('.info-value', (details.mFlags & 0x2) ? 'Signed ID' : 'Anonymous ID'),
            m('.info-label', 'Owner Node GPG'),
            m('.info-value', pgpId && pgpId !== '0000000000000000' ? pgpId : 'None'),
            m('.info-label', 'Created On'),
            //  get64Num exists for these: a 64 bit field arrives as
            //  {xint64, xstr64}, and large values carry xstr64 alone -- reading
            //  .xint64 straight then dates the identity to "Invalid Date".
            m('.info-value', (() => {
              const ts = get64Num(details.mPublishTS);
              return ts > 0 ? new Date(ts * 1000).toLocaleString() : 'Unknown';
            })()),
            m('.info-label', 'Last Used'),
            m('.info-value', (() => {
              const ts = get64Num(details.mLastUsageTS);
              return ts > 0 ? new Date(ts * 1000).toLocaleDateString() : 'Unknown';
            })()),
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
              ? m('p.usage-placeholder', 'No recorded use in this session.')
              : (() => {
                  const sorted = [...details.mUseCases].sort((a, b) => get64Num(b.value) - get64Num(a.value));
                  return sorted.map((item) => {
                    const usage = item.key;
                    const ts = get64Num(item.value);
                    const dateStr = ts > 0 ? new Date(ts * 1000).toLocaleString() : 'Unknown';
                    return m('.usage-item', [
                      m('span.usage-time', dateStr),
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
