const m = require('mithril');
const rs = require('rswebui');
const peopleState = require('people/people_state');
const icon = require('icon');
const widget = require('widgets');

const HistoryBrowserModal = () => {
  //  This modal is mounted with its page and draws nothing until it is asked
  //  for, so oninit is the moment the *conversation* opens, not the moment the
  //  browser does. Loading there meant every chat opening ran "give me every
  //  message ever stored" -- loadCount 0 -- for a panel nobody had asked for.
  let wasOpen = false;

  const loadOnOpen = (vnode) => {
    const chatState = require('chat/chat_state');
    const isRoom = vnode.attrs && vnode.attrs.isRoom;
    const externalState = vnode.attrs && vnode.attrs.state;

    if (externalState) {
      externalState.historySearchQuery = '';
      return;
    }
    if (isRoom) {
      chatState.ChatHubState.historySearchQuery = '';
      const lobbyId = chatState.ChatLobbyModel.currentLobby
        ? rs.idToHex(chatState.ChatLobbyModel.currentLobby.lobby_id)
        : null;
      if (lobbyId) chatState.ChatLobbyModel.loadAllHistoryForRoom(lobbyId);
      return;
    }
    peopleState.State.historySearchQuery = '';
    peopleState.loadAllHistoryForSelectedPeer();
  };

  return {
    view: (vnode) => {
      const chatState = require('chat/chat_state');
      const isRoom = vnode.attrs && vnode.attrs.isRoom;
      const externalState = vnode.attrs && vnode.attrs.state;
      const stateObj = externalState || (isRoom ? chatState.ChatHubState : peopleState.State);

      if (!stateObj.showHistoryModal) {
        wasOpen = false;
        return null;
      }
      if (!wasOpen) {
        wasOpen = true;
        loadOnOpen(vnode);
      }

      let name = (vnode.attrs && vnode.attrs.name) || 'Chat History';
      if (!externalState && isRoom) {
        const lobby = chatState.ChatLobbyModel.currentLobby;
        name = lobby ? lobby.lobby_name : 'Chat Room';
      } else if (!externalState) {
        const details = peopleState.State.selectedId ? peopleState.State.gxsIdToDetailsMap[peopleState.State.selectedId] : null;
        name = details ? (details.mNickname || details.mGroupName || 'Contact') : 'Contact';
      }

      const query = (stateObj.historySearchQuery || '').toLowerCase();
      const filteredHistory = (stateObj.fullHistoryMessages || []).filter((msg) => {
        if (!query) return true;
        const text = (msg.msg || msg.message || '').toLowerCase();
        return text.includes(query);
      });

      return m('.attach-modal-overlay', {
        onclick: (e) => {
          if (e.target === e.currentTarget) stateObj.showHistoryModal = false;
        }
      }, [
        m('.modal-content.modal--titled.history-modal', {
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': 'Chat history',
        }, [
          m('button.modal__close[type=button][aria-label=Close]', {
            onclick: () => (stateObj.showHistoryModal = false),
          }, icon('times')),

          m('.modal__head', [
            m('h2.modal__title', 'Chat history'),
            m('p.modal__lead', `Every message stored for ${name}.`),
          ]),

          m('.history-toolbar', [
            m(widget.SearchField, {
              placeholder: 'Search past messages or keywords',
              value: stateObj.historySearchQuery || '',
              oninput: (e) => (stateObj.historySearchQuery = e.target.value),
              onclear: () => (stateObj.historySearchQuery = ''),
            }),
            m('span.history-count',
              `${filteredHistory.length} message${filteredHistory.length === 1 ? '' : 's'}`
            ),
          ]),

          m('.modal__body.history-list', [
            stateObj.isHistoryLoading
              ? m('.history-placeholder', [
                  icon('spinner', { spin: true, class: 'history-placeholder__icon' }),
                  m('p', 'Fetching chat history…'),
                ])
              : filteredHistory.length === 0
                ? m('.history-placeholder', [
                    icon('comments', { class: 'history-placeholder__icon' }),
                    m('p', query
                      ? 'No messages match that search.'
                      : 'No past messages stored for this conversation.'),
                  ])
                : filteredHistory.map((msg) => {
                    const isIncoming = msg.incoming;
                    let senderName = msg.peerName || (isIncoming ? name : 'You');
                    if (!isIncoming && externalState) {
                      senderName = (vnode.attrs && vnode.attrs.ownName) || 'You';
                    } else if (!isIncoming) {
                      const ownId = isRoom ? (chatState.ChatLobbyModel.currentLobby ? chatState.ChatLobbyModel.currentLobby.gxs_id : '') : peopleState.State.selectedOwnGxsIdForChat;
                      senderName = rs.userList.username(ownId) || 'You';
                    }
                    const timeStr = new Date((msg.sendTime || msg.recvTime || 0) * 1000).toLocaleString();

                    return m('.history-item', [
                      m('.history-item__head', [
                        m('span.history-item__sender', {
                          class: isIncoming ? 'is-incoming' : 'is-own',
                        }, senderName),
                        m('span.history-item__time', timeStr),
                      ]),
                      m('.history-item__body',
                        chatState.renderChatMessage(msg.msg || msg.message || '')
                      ),
                    ]);
                  })
          ]),
        ])
      ]);
    },
  };
};

module.exports = HistoryBrowserModal;
