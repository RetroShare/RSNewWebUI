const m = require('mithril');
const rs = require('rswebui');
const Data = require('network/network_data');
const compose = require('mail/mail_compose');
const peopleUtil = require('people/people_util');
const {
  State,
  fetchIdDetails,
  loadGxsIdentities,
  loadOwnGxsIds,
  preloadAllChatHistory,
  syncFilter,
  startStatusPolling,
  stopStatusPolling,
  initializeDistantChat,
} = require('people/people_state');

const PeopleSidebar = require('people/people_sidebar');
const DetailsTab = require('people/people_details_tab');
const ChatTab = require('people/people_chat_tab');

const PeopleLayout = () => {
  let stopWatchingOwnIds;
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
      loadOwnGxsIds().then(() => preloadAllChatHistory());
      stopWatchingOwnIds = peopleUtil.watchOwnIds((ids) => {
        State.ownGxsIds = ids || [];
        if (!peopleUtil.isUsableIdentityId(State.selectedId)) {
          State.selectedId = State.ownGxsIds[0] || null;
          State.mobilePane = State.selectedId ? State.mobilePane : 'list';
        }
        if (!State.selectedOwnGxsIdForChat && State.ownGxsIds.length) {
          State.selectedOwnGxsIdForChat = State.ownGxsIds[0];
        }
        m.redraw();
      });
      preloadAllChatHistory();
      window.addEventListener('click', dismissMenu);

      // Register for chatEvents to receive live incoming messages
      rs.events[15].notify = (chatMessage) => {
        const msgCid = chatMessage.chat_id;
        if (msgCid && msgCid.type === 2) {
          const msgPid = rs.idToHex(msgCid.distant_chat_id);

          // Find active session matching this distant chat PID
          let session = null;
          let targetGxsId = null;
          Object.keys(State.activeDistantChats || {}).forEach((id) => {
            if (State.activeDistantChats[id] && State.activeDistantChats[id].pid === msgPid) {
              session = State.activeDistantChats[id];
              targetGxsId = id;
            }
          });

          if (session) {
            const isNearDuplicate = session.messages.some(
              (m) => (m.msg || m.message) === chatMessage.msg && Math.abs(m.sendTime - chatMessage.sendTime) < 5
            );
            if (!isNearDuplicate) {
              session.messages.push(chatMessage);
              session.messages.sort((a, b) => a.sendTime - b.sendTime);
              if (targetGxsId) {
                State.chatHistoryMap[targetGxsId] = {
                  lastMsg: chatMessage.msg || chatMessage.message || '',
                  lastTime: chatMessage.sendTime || Math.floor(Date.now() / 1000),
                };
              }
              m.redraw();
              if (State.selectedId === targetGxsId) {
                setTimeout(() => {
                  const element = document.querySelector('.chat-messages');
                  if (element) element.scrollTop = element.scrollHeight;
                }, 100);
              }
            }
          } else if (State.chatPid && msgPid === State.chatPid) {
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

      if (State.chatPid && !State.chatDisconnected) {
        startStatusPolling();
      }
    },
    onremove: () => {
      if (rs.events[15]) {
        rs.events[15].notify = () => {};
      }
      stopStatusPolling();
      if (stopWatchingOwnIds) stopWatchingOwnIds();
      window.removeEventListener('click', dismissMenu);
    },

    onupdate: (vnode) => {
      syncFilter(vnode.attrs.tab);
    },
    view: () => {
      fetchIdDetails(State.selectedId);
      const details = State.selectedId ? State.gxsIdToDetailsMap[State.selectedId] : null;
      const name = details ? details.mNickname || details.mGroupName || 'Unknown' : '';

      return m('.people-container' + (State.mobilePane === 'detail' ? '.mobile-detail-open' : ''), [
        // Left Side Panel
        m(PeopleSidebar),

        // Right Side Details / Actions Pane
        m('.people-right-pane', [
          m('.mobile-pane-header', [
            m('button.mobile-back-button', {
              type: 'button',
              onclick: () => { State.mobilePane = 'list'; },
            }, [m('i.fas.fa-chevron-left'), State.mainTab === 'chats' ? ' Chats' : ' People']),
            m('strong', name || 'Profile'),
          ]),
          State.selectedId && details
            ? [
                m('.network-tabs', [
                  m(
                    'button.tab-btn' + (State.activeTab === 'details' ? '.active' : ''),
                    {
                      onclick: () => {
                        State.activeTab = 'details';
                        State.mobilePane = 'detail';
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
                        State.mobilePane = 'detail';
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
  State.mobilePane = 'detail';
  if (showCompose) {
    State.showMailCompose = true;
  }

  m.route.set(route);
};

module.exports = PeopleLayout;
