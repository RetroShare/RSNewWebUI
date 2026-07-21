const m = require('mithril');
const Data = require('network/network_data');
const peopleUtil = require('people/people_util');
const { State, startDirectChat, getOnlineSslId } = require('network/network_state');

const OwnProfileCard = () => {
  return {
    view: () => {
      const avatar = State.ownProfile.avatar ? { mData: { base64: State.ownProfile.avatar } } : undefined;
      const firstLetter = (State.ownProfile.name || 'U').slice(0, 1).toUpperCase();

      return m('.own-profile-card', [
        m('.profile-header', [
          m(peopleUtil.UserAvatar, { avatar, firstLetter, seed: State.ownProfile.name }),
          m('.profile-info', [
            m('.profile-name', State.ownProfile.name || 'Loading...'),
            m('.profile-status', 'Online'),
            State.ownProfile.customState &&
              m(
                '.profile-custom-status',
                {
                  style: 'font-size: 0.8rem; color: #94a3b8; font-style: italic; margin-top: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 150px;',
                  title: State.ownProfile.customState,
                },
                State.ownProfile.customState
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
      const filteredFriends = Object.entries(Data.gpgDetails).filter(
        ([gpgId, friend]) => (friend.name || '').toLowerCase().includes(search)
      );

      return m('.friends-list-container', [
        m('.searchbar-container', [
          m('input.searchbar', {
            type: 'text',
            placeholder: 'Search friends...',
            value: State.searchString,
            oninput: (e) => {
              State.searchString = e.target.value;
            },
          }),
        ]),
        m('.friends-scroll', [
          filteredFriends.length === 0
            ? m('p', { style: 'padding: 1rem; color: #94a3b8; text-align: center;' }, 'No friends found')
            : filteredFriends
                .sort((a, b) => (a[1].isOnline === b[1].isOnline ? 0 : a[1].isOnline ? -1 : 1))
                .map(([gpgId, friend]) => {
                  const avatar = friend.avatar ? { mData: { base64: friend.avatar } } : undefined;
                  const firstLetter = (friend.name || '?').slice(0, 1).toUpperCase();
                  const isSelected = State.selectedFriendGpgId === gpgId;

                  return m(
                    `.friend-list-item${isSelected ? '.selected' : ''}`,
                    {
                      key: gpgId,
                      onclick: () => {
                        State.selectedFriendGpgId = gpgId;
                        State.currentChatPeerId = null;
                        State.chatMessages = [];
                        if (State.activeTab === 'chat') {
                          const sslId = getOnlineSslId(gpgId);
                          if (sslId) startDirectChat(sslId);
                        }
                      },
                    },
                    [
                      m('.friend-avatar', m(peopleUtil.UserAvatar, { avatar, firstLetter, seed: gpgId })),
                      m('.friend-meta', [
                        m('.friend-name', friend.name),
                        m(
                          `.friend-status${friend.isOnline ? '.online' : ''}`,
                          friend.isOnline ? 'Online' : 'Offline'
                        ),
                        friend.customState &&
                          m(
                            '.friend-custom-status',
                            {
                              style: 'font-size: 0.85rem; color: #64748b; margin-top: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 160px;',
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
