const m = require('mithril');
const rs = require('rswebui');
const Data = require('network/network_data');
const compose = require('mail/mail_compose');
const {
  State,
  fetchIdDetails,
  loadGxsIdentities,
  loadOwnGxsIds,
  syncFilter,
  stopStatusPolling,
  initializeDistantChat,
} = require('people/people_state');
const PeopleSidebar = require('people/people_sidebar');
const DetailsTab = require('people/people_details_tab');
const ChatTab = require('people/people_chat_tab');

const PeopleLayout = () => {
  const dismissMenu = () => {
    if (State.activeMenu) {
      State.activeMenu = null;
      m.redraw();
    }
  };

  return {
    oninit: (vnode) => {
      syncFilter(vnode.attrs.tab);
      Data.refreshGpgDetails().then(() => m.redraw());
      loadGxsIdentities();
      loadOwnGxsIds();
      window.addEventListener('click', dismissMenu);

      // Register for chatEvents to receive live incoming messages
      rs.events[15].notify = (chatMessage) => {
        const msgCid = chatMessage.chat_id;
        if (msgCid && msgCid.type === 2 && State.chatPid) {
          const msgPid = rs.idToHex(msgCid.distant_chat_id);
          if (msgPid === State.chatPid) {
            const isNearDuplicate = State.chatMessages.some(
              (m) => (m.msg || m.message) === chatMessage.msg && Math.abs(m.sendTime - chatMessage.sendTime) < 5
            );
            if (!isNearDuplicate) {
              State.chatMessages.push(chatMessage);
              State.chatMessages.sort((a, b) => a.sendTime - b.sendTime);
              m.redraw();
              setTimeout(() => {
                const element = document.querySelector('.chat-messages');
                if (element) element.scrollTop = element.scrollHeight;
              }, 100);
            }
          }
        }
      };
    },
    onremove: () => {
      if (rs.events[15]) {
        rs.events[15].notify = () => {};
      }
      stopStatusPolling();
      window.removeEventListener('click', dismissMenu);
    },
    onupdate: (vnode) => {
      syncFilter(vnode.attrs.tab);
    },
    view: () => {
      fetchIdDetails(State.selectedId);
      const details = State.selectedId ? State.gxsIdToDetailsMap[State.selectedId] : null;
      const name = details ? details.mNickname || details.mGroupName || 'Unknown' : '';

      return m('.people-container', [
        // Left Side Panel
        m(PeopleSidebar),

        // Right Side Details / Actions Pane
        m('.people-right-pane', [
          State.selectedId && details
            ? [
                m('.network-tabs', [
                  m(
                    'button.tab-btn' + (State.activeTab === 'details' ? '.active' : ''),
                    {
                      onclick: () => {
                        State.activeTab = 'details';
                        stopStatusPolling();
                      },
                    },
                    'Profile Details'
                  ),
                  m(
                    'button.tab-btn' + (State.activeTab === 'chat' ? '.active' : ''),
                    {
                      onclick: () => {
                        State.activeTab = 'chat';
                        initializeDistantChat();
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
                m('i.fas.fa-users'),
                m('p', 'Select an identity from the left panel to view profile details or perform actions.'),
              ]),
        ]),

        // Mail composer overlay popup
        State.showMailCompose &&
          State.selectedId &&
          m(
            '.composePopupOverlay#mailComposerPopup',
            { style: { display: 'block' } },
            m(
              '.composePopup',
              m(compose, {
                msgType: 'compose',
                toId: State.selectedId,
                friendName: name,
                isDirectMail: false,
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

PeopleLayout.setSelectedId = (id, activeTab = 'details', showCompose = false) => {
  const isOwn = State.ownGxsIds.includes(id);
  const entry = rs.userList.userMap[id];
  const isContact = entry && entry.isContact;

  let filter = 'all';
  let route = '/people/All';
  if (isOwn) {
    filter = 'own';
    route = '/people/OwnIdentity';
  } else if (isContact) {
    filter = 'contacts';
    route = '/people/MyContacts';
  }

  State.activeFilter = filter;
  State.selectedId = id;
  State.activeTab = activeTab;
  if (showCompose) {
    State.showMailCompose = true;
  }

  m.route.set(route);
};

module.exports = PeopleLayout;
