const m = require('mithril');
const Data = require('network/network_data');
const peopleUtil = require('people/people_util');
const {
  State,
  startDirectChat,
  getOnlineSslId,
  setOwnCustomStateString,
  setOwnStatus,
} = require('network/network_state');

function formatRelativeTime(ts) {
  if (!ts) return '';
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  if (diff < 30) return 'Just Now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min${Math.floor(diff / 60) > 1 ? 's' : ''}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr${Math.floor(diff / 3600) > 1 ? 's' : ''}`;
  return `${Math.floor(diff / 86400)} d`;
}

const OwnProfileCard = () => {
  let isEditing = false;
  let isPresenceMenuOpen = false;
  let statusInputText = '';

  return {
    view: () => {
      const avatar = State.ownProfile.avatar ? { mData: { base64: State.ownProfile.avatar } } : undefined;
      const firstLetter = (State.ownProfile.name || 'U').slice(0, 1).toUpperCase();
      const displayName = State.ownProfile.location
        ? `${State.ownProfile.name || 'Unknown'} (${State.ownProfile.location})`
        : State.ownProfile.name || 'Loading...';
      const status = Data.getStatusPresentation(State.ownProfile.statusValue, true);

      return m('.own-profile-card', [
        m('.profile-header', [
          m('.profile-avatar-wrapper', [
            m(peopleUtil.UserAvatar, { avatar, firstLetter, seed: State.ownProfile.name }),
            m('button.status-dot.profile-status-button', {
              'aria-label': `Change status. Current status: ${status.label}`,
              'aria-expanded': String(isPresenceMenuOpen),
              style: { backgroundColor: status.color },
              title: `Status: ${status.label}. Click to change.`,
              onclick: () => {
                isPresenceMenuOpen = !isPresenceMenuOpen;
              },
            }),
            isPresenceMenuOpen && m('.profile-presence-menu', [
              [
                { value: 3, label: 'Online' },
                { value: 1, label: 'Away' },
                { value: 2, label: 'Busy' },
              ].map((option) => {
                const optionStatus = Data.getStatusPresentation(option.value, true);
                return m('button.profile-presence-option', {
                  class: status.value === option.value ? 'active' : '',
                  onclick: () => {
                    setOwnStatus(option.value);
                    isPresenceMenuOpen = false;
                  },
                }, [
                  m('span', { style: { backgroundColor: optionStatus.color } }),
                  option.label,
                  status.value === option.value && m('i.fas.fa-check'),
                ]);
              }),
            ]),
          ]),
          m('.profile-info', [
            m('.profile-name', { title: displayName }, displayName),
            isEditing
              ? m('.profile-custom-status-edit', {
                  style: 'display: flex; align-items: center; gap: 4px; margin-top: 3px;'
                }, [
                  m('input[type=text]', {
                    value: statusInputText,
                    placeholder: 'Set custom status...',
                    style: 'font-size: 0.8rem; padding: 2px 6px; border: 1px solid #3ba4d7; border-radius: 4px; width: 125px; outline: none; background: #ffffff;',
                    oninput: (e) => { statusInputText = e.target.value; },
                    onkeydown: (e) => {
                      if (e.key === 'Enter') {
                        setOwnCustomStateString(statusInputText);
                        isEditing = false;
                      } else if (e.key === 'Escape') {
                        isEditing = false;
                      }
                    },
                    oncreate: (vnode) => vnode.dom.focus(),
                  }),
                  m('i.fas.fa-check', {
                    style: 'cursor: pointer; color: #10b981; font-size: 0.85rem; padding: 2px;',
                    title: 'Save status',
                    onclick: () => {
                      setOwnCustomStateString(statusInputText);
                      isEditing = false;
                    },
                  }),
                  m('i.fas.fa-times', {
                    style: 'cursor: pointer; color: #ef4444; font-size: 0.85rem; padding: 2px;',
                    title: 'Cancel',
                    onclick: () => {
                      isEditing = false;
                    },
                  }),
                ])
              : m(
                  '.profile-custom-status',
                  {
                    style: State.ownProfile.customState
                      ? 'font-size: 0.825rem; color: #64748b; font-style: italic; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 180px; cursor: pointer; margin-top: 2px;'
                      : 'font-size: 0.825rem; color: #94a3b8; font-style: italic; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 180px; cursor: pointer; margin-top: 2px;',
                    title: 'Edit status message',
                    onclick: () => {
                      statusInputText = State.ownProfile.customState || '';
                      isEditing = true;
                    },
                  },
                  State.ownProfile.customState || 'Set custom status...'
                ),
          ]),
        ]),
      ]);
    },
  };
};

const FriendsList = () => {
  return {
    view: () => {
      const search = State.searchString.toLowerCase();
      const allGpgEntries = Object.entries(Data.gpgDetails || {});

      // Compute active chats count
      let activeChatsCount = 0;
      allGpgEntries.forEach(([gpgId]) => {
        const hist = State.chatHistoryMap && State.chatHistoryMap[gpgId];
        if (hist && hist.lastMsg) {
          activeChatsCount++;
        }
      });

      let displayFriends;

      if (State.mainTab === 'network') {
        displayFriends = allGpgEntries.filter(([gpgId, friend]) =>
          (friend.name || '').toLowerCase().includes(search)
        );
        displayFriends.sort((a, b) =>
          a[1].isOnline === b[1].isOnline ? 0 : a[1].isOnline ? -1 : 1
        );
      } else {
        // Chats Tab: filter friends with chat history
        displayFriends = allGpgEntries.filter(([gpgId, friend]) => {
          const hist = State.chatHistoryMap && State.chatHistoryMap[gpgId];
          if (!hist || !hist.lastMsg) return false;
          return (friend.name || '').toLowerCase().includes(search);
        });

        displayFriends.sort((a, b) => {
          const histA = State.chatHistoryMap[a[0]];
          const histB = State.chatHistoryMap[b[0]];
          const timeA = histA ? histA.lastTime : 0;
          const timeB = histB ? histB.lastTime : 0;
          return timeB - timeA;
        });
      }

      return m('.friends-list-container', [
        m('.people-sidebar-header', [
          m('.searchbar-wrapper', [
            m('i.fas.fa-search'),
            m('input.searchbar-input', {
              type: 'text',
              placeholder: State.mainTab === 'network' ? 'Search friends...' : 'Search chats...',
              value: State.searchString,
              oninput: (e) => {
                State.searchString = e.target.value;
              },
            }),
          ]),
          m('.segmented-control', [
            m(
              'button.segment-tab' + (State.mainTab === 'network' ? '.active' : ''),
              {
                onclick: () => {
                  State.mainTab = 'network';
                },
              },
              [m('i.fas.fa-users'), ' Network']
            ),
            m(
              'button.segment-tab' + (State.mainTab === 'chats' ? '.active' : ''),
              {
                onclick: () => {
                  State.mainTab = 'chats';
                },
              },
              [
                m('i.fas.fa-comments'),
                ' Chats',
                activeChatsCount > 0 && m('span.segment-badge', activeChatsCount),
              ]
            ),
            m(
              'button.segment-tab.mobile-graph-shortcut',
              {
                onclick: () => {
                  State.activeTab = 'graph';
                  State.mobilePane = 'detail';
                },
              },
              [m('i.fas.fa-project-diagram'), ' Graph']
            ),
          ]),
        ]),
        m('.friends-scroll', [
          displayFriends.length === 0
            ? m(
                'p',
                { style: 'padding: 1rem; color: #94a3b8; text-align: center;' },
                State.mainTab === 'network' ? 'No friends found' : 'No active chats found'
              )
            : displayFriends.map(([gpgId, friend]) => {
                const avatar = friend.avatar ? { mData: { base64: friend.avatar } } : undefined;
                const firstLetter = (friend.name || '?').slice(0, 1).toUpperCase();
                const isSelected = State.selectedFriendGpgId === gpgId;
                const hist = State.chatHistoryMap && State.chatHistoryMap[gpgId];
                const status = Data.getStatusPresentation(friend.statusValue, friend.isOnline);

                const isOnlineOrActive = friend.isOnline || (status && status.value > 0);

                if (State.mainTab === 'chats') {
                  // Render Chat List Item
                  return m(
                    `.chat-item${isSelected ? '.selected' : ''}`,
                    {
                      key: gpgId,
                      onclick: () => {
                        State.selectedFriendGpgId = gpgId;
                        State.activeTab = 'chat';
                        State.mobilePane = 'detail';
                        const sslId = getOnlineSslId(gpgId);
                        if (sslId) startDirectChat(sslId);
                      },
                    },
                    [
                      m('.chat-avatar-wrapper', [
                        m(peopleUtil.UserAvatar, { avatar, firstLetter, seed: gpgId }),
                        m('.status-dot', {
                          style: {
                            backgroundColor: status.color,
                          },
                          title: status.label,
                        }),
                      ]),
                      m('.chat-info', [
                        m(
                          '.chat-name',
                          {
                            style: isOnlineOrActive ? { color: status.color, fontWeight: '700' } : {},
                          },
                          friend.name
                        ),
                        m('.chat-last-msg', hist ? hist.lastMsg : ''),
                      ]),
                      m('.chat-meta', [
                        hist && hist.lastTime && m('.chat-time', formatRelativeTime(hist.lastTime)),
                      ]),
                    ]
                  );
                }

                // Render Network Friend List Item
                return m(
                  `.friend-list-item${isSelected ? '.selected' : ''}`,
                  {
                    key: gpgId,
                    onclick: () => {
                      State.selectedFriendGpgId = gpgId;
                      State.activeTab = 'details';
                      State.mobilePane = 'detail';
                      State.currentChatPeerId = null;
                      State.chatMessages = [];
                      if (State.activeTab === 'chat') {
                        const sslId = getOnlineSslId(gpgId);
                        if (sslId) startDirectChat(sslId);
                      }
                    },
                  },
                  [
                    m('.friend-avatar', [
                      m(peopleUtil.UserAvatar, { avatar, firstLetter, seed: gpgId }),
                      m('.status-dot', {
                        style: { backgroundColor: status.color },
                        title: status.label,
                      }),
                    ]),
                    m('.friend-meta', [
                      m(
                        '.friend-name',
                        {
                          style: isOnlineOrActive ? { color: status.color, fontWeight: '700' } : {},
                        },
                        friend.name
                      ),
                      friend.customState &&
                        m(
                          '.friend-custom-status',
                          {
                            style:
                              'font-size: 0.85rem; color: #64748b; margin-top: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 180px;',
                            title: friend.customState,
                          },
                          friend.customState
                        ),
                    ]),
                  ]
                );
              }),
        ]),
      ]);
    },
  };
};

module.exports = {
  OwnProfileCard,
  FriendsList,
};
