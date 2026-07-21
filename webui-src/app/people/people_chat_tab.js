const m = require('mithril');
const rs = require('rswebui');
const {
  State,
  fetchIdDetails,
  getStatusColor,
  getStatusTooltip,
  initializeDistantChat,
  sendDistantChatMessage,
  stopStatusPolling,
} = require('people/people_state');

const ChatTab = () => {
  return {
    view: () => {
      fetchIdDetails(State.selectedId);
      const details = State.selectedId ? State.gxsIdToDetailsMap[State.selectedId] : null;
      if (!details) return null;

      const name = details.mNickname || details.mGroupName || 'Unknown';

      if (State.ownGxsIds.length === 0) {
        return m('.chat-warning', [
          m('i.fas.fa-exclamation-triangle'),
          m('h4', 'No Identities Found'),
          m('p', 'You need to create a GXS identity in the "My Identities" tab before you can start distant chats.'),
        ]);
      }

      if (State.chatDisconnected) {
        return m('.chat-warning', [
          m('i.fas.fa-unlink', { style: 'font-size: 2rem; color: #ef4444; margin-bottom: 1rem;' }),
          m('h4', 'Conversation Ended'),
          m('p', 'You have closed the distant chat tunnel. Click below to reconnect.'),
          m('button.blue', {
            style: 'margin-top: 1rem; padding: 0.5rem 1.5rem; border-radius: 0.375rem; border: none; font-weight: 600; cursor: pointer;',
            onclick: () => initializeDistantChat(),
          }, 'Reconnect'),
        ]);
      }

      if (!State.chatPid) {
        return m('.chat-warning', [
          m('i.fas.fa-spinner.fa-spin'),
          m('h4', 'Connecting...'),
          m('p', 'Initiating distant chat tunnel to the peer identity...'),
        ]);
      }

      const canTalk = State.distantChatStatus && State.distantChatStatus.status === 2;

      return m('.network-chat-view', [
        m('.chat-identity-select-container', {
          style: 'padding: 0.5rem 1rem; background-color: #ffffff; border-bottom: 1px solid #cbd5e1; display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem;',
        }, [
          m('.chat-tunnel-status', { style: 'display: flex; align-items: center; gap: 0.5rem;' }, [
            m('span', { style: 'color: #64748b; font-weight: 500;' }, 'Distant Chat Tunnel'),
            m('i.fas.fa-circle', {
              style: {
                color: getStatusColor(State.distantChatStatus ? State.distantChatStatus.status : 0),
                fontSize: '0.85rem',
                transition: 'color 0.3s ease',
              },
              title: getStatusTooltip(State.distantChatStatus ? State.distantChatStatus.status : 0),
            }),
          ]),
          m('.chat-actions', { style: 'display: flex; align-items: center; gap: 1rem;' }, [
            m('.select-own-profile', [
              m('span', { style: 'margin-right: 0.5rem; color: #64748b;' }, 'Chatting as:'),
              m('select', {
                style: 'padding: 0.25rem 0.5rem; border-radius: 0.25rem; border: 1px solid #cbd5e1; outline: none; background: #f8fafc; font-weight: 600;',
                value: State.selectedOwnGxsIdForChat,
                onchange: (e) => {
                  State.selectedOwnGxsIdForChat = e.target.value;
                  initializeDistantChat();
                },
              }, State.ownGxsIds.map((id) => m('option', { value: id }, rs.userList.username(id)))),
            ]),
            m('button.red.leave-btn', {
              style: 'padding: 0.25rem 0.75rem; border-radius: 0.25rem; font-size: 0.85rem; display: flex; align-items: center; gap: 0.25rem; border: none; cursor: pointer; background-color: #ef4444; color: #ffffff;',
              onclick: () => {
                if (confirm('Are you sure you want to leave this distant chat conversation?')) {
                  rs.rsJsonApiRequest(
                    '/rsChats/closeDistantChatConnexion',
                    {
                      pid: State.chatPid,
                    },
                    (data, success) => {
                      if (success) {
                        State.chatPid = null;
                        State.chatMessages = [];
                        State.distantChatStatus = null;
                        State.chatDisconnected = true;
                        stopStatusPolling();
                        m.redraw();
                      }
                    }
                  );
                }
              },
            }, [
              m('i.fas.fa-sign-out-alt'),
              'Leave Chat',
            ]),
          ]),
        ]),

        m('.chat-messages', [
          State.chatMessages.length === 0
            ? m('.chat-warning', [
                m('i.fas.fa-comments'),
                m('h4', 'No Messages'),
                m('p', 'Distant chats are secure and encrypted. Start the conversation by typing a message below.'),
              ])
            : State.chatMessages.map((msg) => {
                if (msg.isSystem) {
                  const text = msg.msg || msg.message;
                  const isSecured = text.includes('secured') || text.includes('talk');
                  const bgColor = isSecured ? '#fffbeb' : '#f8fafc';
                  const borderColor = isSecured ? '#fcd34d' : '#cbd5e1';
                  const textColor = isSecured ? '#b45309' : '#475569';
                  const borderStyle = isSecured ? 'solid' : 'dashed';

                  return m('.chat-bubble-container.incoming', [
                    m('.chat-sender', 'Chat status'),
                    m('.chat-bubble', {
                      style: {
                        backgroundColor: bgColor,
                        border: `1px ${borderStyle} ${borderColor}`,
                        color: textColor,
                      },
                    }, text),
                    m('.chat-time', new Date(msg.sendTime * 1000).toLocaleTimeString()),
                  ]);
                }
                const isIncoming = msg.incoming;
                const senderName = isIncoming ? name : rs.userList.username(State.selectedOwnGxsIdForChat);
                
                return m('.chat-bubble-container' + (isIncoming ? '.incoming' : '.outgoing'), [
                  m('.chat-sender', senderName),
                  m('.chat-bubble', msg.msg || msg.message),
                  m('.chat-time', new Date(msg.sendTime * 1000).toLocaleTimeString()),
                ]);
              }),
        ]),

        m('.chat-input-area', [
          m('textarea.chat-textarea', {
            placeholder: canTalk ? 'Type your encrypted message here...' : 'Waiting for tunnel to be secured...',
            disabled: !canTalk,
            value: State.chatInputMsg,
            oninput: (e) => {
              State.chatInputMsg = e.target.value;
            },
            onkeydown: (e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (canTalk) sendDistantChatMessage();
              }
            },
          }),
          m(
            'button.send-btn.blue',
            {
              disabled: !canTalk,
              style: !canTalk ? 'opacity: 0.5; cursor: not-allowed;' : '',
              onclick: () => {
                if (canTalk) sendDistantChatMessage();
              },
            },
            [m('i.fas.fa-paper-plane'), ' Send']
          ),
        ]),
      ]);
    },
  };
};

module.exports = ChatTab;
