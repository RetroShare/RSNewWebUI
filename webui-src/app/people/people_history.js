const m = require('mithril');
const rs = require('rswebui');
const peopleState = require('people/people_state');
const chatState = require('chat/chat_state');

const HistoryBrowserModal = () => {
  return {
    oninit: (vnode) => {
      const isRoom = vnode.attrs && vnode.attrs.isRoom;
      if (isRoom) {
        chatState.ChatHubState.historySearchQuery = '';
        const lobbyId = chatState.ChatLobbyModel.currentLobby ? rs.idToHex(chatState.ChatLobbyModel.currentLobby.lobby_id) : null;
        if (lobbyId) {
          chatState.ChatLobbyModel.loadAllHistoryForRoom(lobbyId);
        }
      } else {
        peopleState.State.historySearchQuery = '';
        peopleState.loadAllHistoryForSelectedPeer();
      }
    },
    view: (vnode) => {
      const isRoom = vnode.attrs && vnode.attrs.isRoom;
      const stateObj = isRoom ? chatState.ChatHubState : peopleState.State;

      if (!stateObj.showHistoryModal) return null;

      let name = 'Chat History';
      if (isRoom) {
        const lobby = chatState.ChatLobbyModel.currentLobby;
        name = lobby ? lobby.lobby_name : 'Chat Room';
      } else {
        const details = peopleState.State.selectedId ? peopleState.State.gxsIdToDetailsMap[peopleState.State.selectedId] : null;
        name = details ? (details.mNickname || details.mGroupName || 'Contact') : 'Contact';
      }

      const query = (stateObj.historySearchQuery || '').toLowerCase();
      const filteredHistory = (stateObj.fullHistoryMessages || []).filter((msg) => {
        if (!query) return true;
        const text = (msg.msg || msg.message || '').toLowerCase();
        return text.includes(query);
      });

      return m('.history-modal-overlay', {
        style: 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(15, 23, 42, 0.4); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 2000;',
        onclick: (e) => {
          if (e.target === e.currentTarget) stateObj.showHistoryModal = false;
        }
      }, [
        m('.history-modal', {
          style: 'background: #ffffff; border-radius: 0.5rem; width: 780px; max-width: 92%; height: 85vh; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); overflow: hidden;'
        }, [
          // Header
          m('.history-modal-header', {
            style: 'padding: 1rem 1.25rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;'
          }, [
            m('.history-title', { style: 'display: flex; align-items: center; gap: 0.5rem;' }, [
              m('i.fas.fa-history', { style: 'color: #3b82f6; font-size: 1.2rem;' }),
              m('h3', { style: 'margin: 0; font-size: 1.1rem; font-weight: 700; color: #1e293b;' }, `Chat History Browser — ${name}`),
            ]),
            m('button.close-btn', {
              style: 'background: transparent; border: none; font-size: 1.25rem; color: #64748b; cursor: pointer; padding: 0.25rem; border-radius: 0.25rem;',
              title: 'Close history browser',
              onclick: () => (stateObj.showHistoryModal = false),
            }, m('i.fas.fa-times')),
          ]),

          // Toolbar
          m('.history-toolbar', {
            style: 'padding: 0.75rem 1.25rem; background: #ffffff; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; gap: 1rem;'
          }, [
            m('.search-input-box', { style: 'position: relative; flex: 1;' }, [
              m('i.fas.fa-search', { style: 'position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 0.85rem;' }),
              m('input[type=text][placeholder=Search past messages or keywords...]', {
                style: 'width: 100%; padding: 0.4rem 0.75rem 0.4rem 2.2rem; border-radius: 0.375rem; border: 1px solid #cbd5e1; outline: none; font-size: 0.85rem;',
                value: stateObj.historySearchQuery || '',
                oninput: (e) => (stateObj.historySearchQuery = e.target.value),
              }),
            ]),
            m('span.history-count', { style: 'font-size: 0.85rem; color: #64748b; font-weight: 600;' },
              `${filteredHistory.length} messages`
            ),
          ]),

          // Message Body
          m('.history-message-list', {
            style: 'flex: 1; overflow-y: auto; padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; background: #f8fafc;'
          }, [
            stateObj.isHistoryLoading
              ? m('.loading-spinner', { style: 'text-align: center; padding: 3rem; color: #64748b;' }, [
                  m('i.fas.fa-spinner.fa-spin', { style: 'font-size: 2rem; margin-bottom: 0.75rem; color: #3b82f6;' }),
                  m('p', { style: 'font-weight: 600;' }, 'Fetching complete chat history from Retroshare database...'),
                ])
              : filteredHistory.length === 0
                ? m('.empty-history', { style: 'text-align: center; padding: 3rem; color: #64748b;' }, [
                    m('i.far.fa-comments', { style: 'font-size: 2.5rem; color: #cbd5e1; margin-bottom: 0.75rem;' }),
                    m('p', 'No past chat messages found matching your query.'),
                  ])
                : filteredHistory.map((msg) => {
                    const isIncoming = msg.incoming;
                    let senderName = msg.peerName || (isIncoming ? name : 'You');
                    if (!isIncoming) {
                      const ownId = isRoom ? (chatState.ChatLobbyModel.currentLobby ? chatState.ChatLobbyModel.currentLobby.gxs_id : '') : peopleState.State.selectedOwnGxsIdForChat;
                      senderName = rs.userList.username(ownId) || 'You';
                    }
                    const timeStr = new Date((msg.sendTime || msg.recvTime || 0) * 1000).toLocaleString();

                    return m('.history-item', {
                      style: 'background: #ffffff; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.75rem 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.03);'
                    }, [
                      m('.history-item-header', { style: 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;' }, [
                        m('span.sender', { style: `font-weight: 700; font-size: 0.85rem; color: ${isIncoming ? '#3b82f6' : '#10b981'};` }, senderName),
                        m('span.time', { style: 'font-size: 0.75rem; color: #94a3b8;' }, timeStr),
                      ]),
                      m('.history-item-body', { style: 'font-size: 0.9rem; color: #334155; word-break: break-word;' },
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
