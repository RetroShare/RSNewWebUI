const m = require('mithril');
const Data = require('network/network_data');
const { State, startDirectChat, getOnlineSslId, sendDirectChatMessage } = require('network/network_state');

const ChatTab = () => {
  return {
    view: () => {
      const gpgId = State.selectedFriendGpgId;
      const friend = Data.gpgDetails[gpgId];
      if (!friend) return null;

      const sslId = getOnlineSslId(gpgId);

      if (!sslId) {
        return m('.network-chat-view', [
          m('.chat-warning', [
            m('i.fas.fa-exclamation-triangle'),
            m('h4', 'No Location Found'),
            m('p', 'This friend has no known locations to start a direct chat with.'),
          ]),
        ]);
      }

      if (!State.currentChatPeerId) {
        return m('.network-chat-view', [
          m('.chat-warning', [
            m('i.fas.fa-comments'),
            m('h4', 'Direct Chat'),
            m('p', 'Click below to start a direct chat with ' + friend.name + '.'),
            m(
              'button',
              {
                onclick: () => startDirectChat(sslId),
              },
              'Start Chat'
            ),
          ]),
        ]);
      }

      return m('.network-chat-view', [
        (() => {
          const activeLoc = friend.locations.find((loc) => loc.id === State.currentChatPeerId);
          const locName = activeLoc ? activeLoc.name : 'Unknown Location';
          const locOnline = activeLoc ? activeLoc.isOnline : false;
          return m('.chat-header-bar', {
            style: {
              padding: '0.75rem 1rem',
              backgroundColor: '#ffffff',
              borderBottom: '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }
          }, [
            m('.chat-header-info', [
              m('.chat-header-name', { style: { fontWeight: '700', color: '#1e293b' } }, friend.name),
              m('.chat-header-location', { style: { fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', marginTop: '0.25rem' } }, [
                m('span', 'Location: ' + locName),
                m('span.status-dot', {
                  style: {
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: locOnline ? '#10b981' : '#ef4444',
                    marginLeft: '6px',
                    marginRight: '4px'
                  }
                }),
                m('span', { style: { color: locOnline ? '#10b981' : '#ef4444', fontWeight: '500' } }, locOnline ? 'Online' : 'Offline')
              ])
            ])
          ]);
        })(),
        m(
          '.chat-messages[id=chat-messages-container]',
          State.chatMessages.map((msg) => {
            const isOwn = msg.own === true;
            const senderName = isOwn
              ? (State.ownProfile.name || 'Me')
              : friend.name;
            const time = new Date(msg.sendTime * 1000).toLocaleTimeString();
            const text = (msg.msg || '')
              .replaceAll('<br/>', '\n')
              .replace(new RegExp('<style[^<]*</style>|<[^>]*>', 'gm'), '');

            return m(
              '.chat-bubble-container' + (isOwn ? '.outgoing' : '.incoming'),
              [
                !isOwn && m('.chat-sender', senderName),
                m('.chat-bubble', text),
                m('.chat-time', time),
              ]
            );
          })
        ),
        m('.chat-input-area', [
          m('textarea.chat-textarea', {
            placeholder: 'Type your message... Press Enter to send',
            value: State.chatInputMsg,
            oninput: (e) => {
              State.chatInputMsg = e.target.value;
            },
            onkeydown: (e) => {
              if (e.code === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendDirectChatMessage();
              }
            },
          }),
          m(
            'button.send-btn',
            {
              onclick: () => sendDirectChatMessage(),
            },
            [m('i.fas.fa-paper-plane'), ' Send']
          ),
        ]),
      ]);
    },
  };
};

module.exports = ChatTab;
