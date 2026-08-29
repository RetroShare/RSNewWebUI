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
  selectChatContact,
  getDistantChatSession,
  drainBufferedChatMessages,
  markDistantChatRead,
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
      //  The friend list carries the locations the direct chat history is keyed
      //  by, so the preload only has its full candidate set once it landed.
      Data.refreshGpgDetails().then(() => {
        preloadAllChatHistory();
        m.redraw();
      });
      loadGxsIdentities();
      loadOwnGxsIds().then(() => {
        preloadAllChatHistory();
        //  "Start private chat" from a chat room routes here with the chat tab
        //  preselected, but nothing ever opened the tunnel: the pane sat on its
        //  Connecting spinner for good. That intent is explicit, so it is
        //  honoured -- once the own identities needed to open a tunnel are in.
        if (State.pendingChatOpen && State.pendingChatOpen === State.selectedId) {
          State.pendingChatOpen = null;
          initializeDistantChat();
        } else {
          State.pendingChatOpen = null;
        }
      });
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
      window.addEventListener('click', dismissMenu);

      //  Only poll a tunnel that is the selected contact's own; anything
      //  else is left over from a previous selection.
      const selectedSession = State.selectedId ? getDistantChatSession(State.selectedId) : null;
      if (State.chatPid && !State.chatDisconnected && selectedSession && selectedSession.pid === State.chatPid) {
        //  Messages received while the tab was unmounted sit in the event
        //  queue buffer: pick them up before the first redraw.
        drainBufferedChatMessages(selectedSession);
        startStatusPolling();
      }
    },
    onremove: () => {
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
                        markDistantChatRead(State.selectedId);
                        initializeDistantChat();
                      },
                    },
                    'Chat Conversation'
                  ),
                ]),
                m('.network-tab-content' + (State.activeTab === 'chat' ? '.network-chat-tab-content' : ''), [
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
  selectChatContact(id);
  State.activeTab = activeTab;
  State.pendingChatOpen = activeTab === 'chat' ? id : null;
  State.mobilePane = 'detail';
  if (showCompose) {
    State.showMailCompose = true;
  }

  m.route.set(route);
};

module.exports = PeopleLayout;
