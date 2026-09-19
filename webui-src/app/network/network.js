const m = require('mithril');
const Data = require('network/network_data');
const compose = require('mail/mail_compose');
const {
  State,
  loadOwnProfile,
  loadGxsIdentities,
  fetchIdDetails,
  startDirectChat,
  getOnlineSslId,
  preloadNetworkChatHistory,
  loadDirectChatMessages,
  markDirectChatRead,
} = require('network/network_state');
const { OwnProfileCard, FriendsList } = require('network/network_friends_list');
const DetailsTab = require('network/network_details_tab');
const ChatTab = require('network/network_chat_tab');
const NetworkGraph = require('network/network_graph');
const icon = require('icon');
const widget = require('widgets');

const NetworkLayout = () => {
  return {
    oninit: () => {
      // Keep the active-chat list current even when no conversation is open.
      loadDirectChatMessages();
      Data.refreshGpgDetails().then(() => {
        preloadNetworkChatHistory();
        m.redraw();
      });
      loadOwnProfile();
      loadGxsIdentities();
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

      return m('.network-container' + (State.mobilePane === 'detail' ? '.mobile-detail-open' : ''), [
        m('.network-left-pane', [m(OwnProfileCard), m(FriendsList)]),
        m('.network-right-pane', [
          m('.mobile-pane-header', [
            m(widget.BackButton, {
              label: 'Back to Network',
              onclick: () => { State.mobilePane = 'list'; },
            }),
            m('strong', State.activeTab === 'graph' ? 'Network Graph' : (selectedFriend ? selectedFriend.name : 'Friend')),
          ]),
          m(widget.Segmented, {
            variant: 'underline',
            class: 'network-tabs',
            ariaLabel: 'Friend view',
            value: State.activeTab,
            options: [
              { id: 'details', label: 'Details View' },
              { id: 'chat', label: 'Chat Conversation' },
              { id: 'graph', label: 'Network Graph', icon: 'project-diagram' },
            ],
            onSelect: (tab) => {
              State.activeTab = tab;
              State.mobilePane = 'detail';
              if (tab === 'chat') {
                markDirectChatRead(State.selectedFriendGpgId);
                const sslId = getOnlineSslId(State.selectedFriendGpgId);
                if (sslId && !State.currentChatPeerId) startDirectChat(sslId);
              }
            },
          }),
          State.activeTab === 'graph'
            ? m('.network-tab-content.network-graph-tab', m(NetworkGraph))
            : selectedFriend
              ? m('.network-tab-content' + (State.activeTab === 'chat' ? '.network-chat-tab-content' : ''), [
                  State.activeTab === 'details' ? m(DetailsTab) : m(ChatTab),
                ])
              : m('.network-pane-placeholder', [
                icon('network-wired'),
                m(
                  'p',
                  'Select a friend for details or chat, or open the Network Graph tab.'
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
                icon('times')
              )
            )
          ),
      ]);
    },
  };
};

module.exports = NetworkLayout;
