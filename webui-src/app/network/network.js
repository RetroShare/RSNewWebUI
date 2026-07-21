const m = require('mithril');
const rs = require('rswebui');
const Data = require('network/network_data');
const compose = require('mail/mail_compose');
const {
  State,
  loadOwnProfile,
  loadGxsIdentities,
  fetchIdDetails,
  startDirectChat,
  getOnlineSslId,
} = require('network/network_state');
const { OwnProfileCard, FriendsList } = require('network/network_friends_list');
const DetailsTab = require('network/network_details_tab');
const ChatTab = require('network/network_chat_tab');

const NetworkLayout = () => {
  return {
    oninit: () => {
      Data.refreshGpgDetails().then(() => m.redraw());
      loadOwnProfile();
      loadGxsIdentities();
    },
    onremove: () => {
      if (rs.events[15]) {
        rs.events[15].notify = () => {};
      }
    },
    view: () => {
      const selectedFriend = State.selectedFriendGpgId
        ? Data.gpgDetails[State.selectedFriendGpgId]
        : null;

      const selectedGxsId = State.selectedFriendGpgId
        ? State.gpgToGxsIdMap[State.selectedFriendGpgId.toLowerCase()]
        : null;

      if (State.selectedFriendGpgId && !selectedGxsId && State.gxsIdentities) {
        State.gxsIdentities.forEach((gxsId) => fetchIdDetails(gxsId));
      }

      return m('.network-container', [
        m('.network-left-pane', [m(OwnProfileCard), m(FriendsList)]),
        m('.network-right-pane', [
          selectedFriend
            ? [
                m('.network-tabs', [
                  m(
                    'button.tab-btn' + (State.activeTab === 'details' ? '.active' : ''),
                    {
                      onclick: () => {
                        State.activeTab = 'details';
                      },
                    },
                    'Details View'
                  ),
                  m(
                    'button.tab-btn' + (State.activeTab === 'chat' ? '.active' : ''),
                    {
                      onclick: () => {
                        State.activeTab = 'chat';
                        const sslId = getOnlineSslId(State.selectedFriendGpgId);
                        if (sslId && !State.currentChatPeerId) {
                          startDirectChat(sslId);
                        }
                      },
                    },
                    'Chat Conversation'
                  ),
                ]),
                m('.network-tab-content', [
                  State.activeTab === 'details' ? m(DetailsTab) : m(ChatTab),
                ]),
              ]
            : m('.network-pane-placeholder', [
                m('i.fas.fa-network-wired'),
                m(
                  'p',
                  'Select a friend node from the left side panel to view locations details or start a private chat.'
                ),
              ]),
        ]),
        State.showMailCompose &&
          State.selectedFriendGpgId &&
          m(
            '.composePopupOverlay#mailComposerPopup',
            { style: { display: 'block' } },
            m(
              '.composePopup',
              m(compose, {
                msgType: 'compose',
                toId: selectedGxsId || State.selectedFriendGpgId,
                friendName: selectedFriend ? selectedFriend.name : 'Unknown Friend',
                isDirectMail: true,
                setShowCompose: (val) => {
                  State.showMailCompose = val;
                },
              }),
              m(
                'button.red.close-btn',
                {
                  onclick: () => {
                    State.showMailCompose = false;
                  },
                },
                m('i.fas.fa-times')
              )
            )
          ),
      ]);
    },
  };
};

module.exports = NetworkLayout;
