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
  loadAllHistoryForSelectedPeer,
} = require('people/people_state');
const { renderChatMessage } = require('chat/chat_state');
const chatEmoji = require('chat/chat_emoji');
const peopleUtil = require('people/people_util');
const HistoryBrowserModal = require('people/people_history');

// Mirroring C++ Distant Chat packet size limit (200KB)
function formatChatImage(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const img = new Image();
    img.onload = () => {
      // Bounding box for Distant Chat images: 800x600 max
      const maxWidth = 800;
      const maxHeight = 600;
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Dynamically step down JPEG quality until base64 string is under 190,000 characters (190KB)
      let quality = 0.85;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrl.length > 190000 && quality > 0.20) {
        quality -= 0.10;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      if (dataUrl.length <= 200000) {
        callback(`<img src="${dataUrl}" />`);
      } else {
        alert('Image file is too large to send over Distant Chat 200KB packet size limit.');
        callback(null);
      }
    };
    img.onerror = () => callback(null);
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

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

      // Filter history by search query for history modal
      const query = (State.historySearchQuery || '').toLowerCase();
      const filteredHistory = (State.fullHistoryMessages || []).filter((msg) => {
        if (!query) return true;
        const text = (msg.msg || msg.message || '').toLowerCase();
        return text.includes(query);
      });

      return m('.network-chat-view', [
        m('.chat-identity-select-container', {
          style: 'padding: 0.5rem 1rem; background-color: #ffffff; border-bottom: 1px solid #cbd5e1; display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem;',
        }, [
          m('.chat-tunnel-status', { style: 'display: flex; align-items: center; gap: 0.5rem;' }, [
            m('span.tunnel-label', { style: 'color: #64748b; font-weight: 500;' }, 'Distant Chat Tunnel'),
            m('i.fas.fa-circle', {
              style: {
                color: getStatusColor(State.distantChatStatus ? State.distantChatStatus.status : 0),
                fontSize: '0.85rem',
                transition: 'color 0.3s ease',
              },
              title: getStatusTooltip(State.distantChatStatus ? State.distantChatStatus.status : 0),
            }),
          ]),
          m('.chat-actions', { style: 'display: flex; align-items: center; gap: 0.75rem;' }, [
            m('.select-own-profile', { style: 'display: flex; align-items: center; gap: 0.5rem;' }, [
              m('span.chatting-as-label', { style: 'color: #64748b;' }, 'Chatting as:'),
              (() => {
                const ownId = State.selectedOwnGxsIdForChat;
                if (ownId) fetchIdDetails(ownId);
                const ownDetails = State.gxsIdToDetailsMap[ownId];
                return m('.own-profile-badge', { style: 'display: flex; align-items: center; gap: 0.4rem;' }, [
                  m(peopleUtil.UserAvatar, {
                    avatar: ownDetails ? ownDetails.mAvatar : null,
                    identityId: ownId,
                    size: 24,
                  }),
                  m('select', {
                    style: 'padding: 0.25rem 0.5rem; border-radius: 0.25rem; border: 1px solid #cbd5e1; outline: none; background: #f8fafc; font-weight: 600;',
                    value: ownId,
                    onchange: (e) => {
                      State.selectedOwnGxsIdForChat = e.target.value;
                      initializeDistantChat(true);
                    },
                  }, State.ownGxsIds.map((id) => m('option', { value: id }, rs.userList.username(id)))),
                ]);
              })(),
            ]),
            m('button.blue.history-btn', {
              style: 'padding: 0.25rem 0.75rem; border-radius: 0.25rem; font-size: 0.85rem; display: flex; align-items: center; gap: 0.35rem; border: none; cursor: pointer; background-color: #3b82f6; color: #ffffff; font-weight: 600;',
              title: 'View all past chat history with this contact',
              onclick: () => {
                State.showHistoryModal = true;
                State.historySearchQuery = '';
                loadAllHistoryForSelectedPeer();
              },
            }, [
              m('i.fas.fa-history', { style: 'color: #ffffff;' }),
              'History',
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
                        if (State.selectedId && State.activeDistantChats[State.selectedId]) {
                          delete State.activeDistantChats[State.selectedId];
                        }
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
                const rawText = msg.msg || msg.message || '';

                return m('.chat-bubble-container' + (isIncoming ? '.incoming' : '.outgoing'), [
                  m('.chat-sender', senderName),
                  m('.chat-bubble', renderChatMessage(rawText)),
                  m('.chat-time', new Date(msg.sendTime * 1000).toLocaleTimeString()),
                ]);
              }),
        ]),

        m('.chat-input-area', { style: 'display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem; background: #ffffff; border-top: 1px solid #cbd5e1;' }, [
          m('button.chat-hub-action-btn', {
            disabled: !canTalk,
            style: !canTalk ? 'opacity: 0.5; cursor: not-allowed;' : '',
            title: 'Attach file link',
            onclick: () => {
              const path = prompt('Enter file path to attach as Retroshare link:');
              if (path && path.trim()) {
                const val = State.chatInputMsg || '';
                State.chatInputMsg = val ? val + '\n' + path.trim() : path.trim();
                m.redraw();
              }
            }
          }, m('i.fas.fa-paperclip')),

          m('.emoji-picker-wrapper', { style: 'position: relative;' }, [
            m('button.chat-hub-action-btn', {
              disabled: !canTalk,
              style: !canTalk ? 'opacity: 0.5; cursor: not-allowed;' : '',
              title: 'Insert emoji',
              onclick: (e) => {
                e.stopPropagation();
                State.showEmojiPicker = !State.showEmojiPicker;
              }
            }, m('i.fas.fa-smile')),
            State.showEmojiPicker && m(chatEmoji.EmojiPicker, {
              onSelect: (emoji) => {
                State.chatInputMsg = (State.chatInputMsg || '') + emoji;
                State.showEmojiPicker = false;
                m.redraw();
              }
            }),
          ]),

          m('label.chat-hub-action-btn', {
            title: 'Send image',
            style: `cursor: ${canTalk ? 'pointer' : 'not-allowed'}; opacity: ${canTalk ? 1 : 0.5};`,
          }, [
            m('i.fas.fa-image'),
            m('input[type=file][accept=image/*]', {
              style: 'display: none;',
              disabled: !canTalk,
              onchange: (e) => {
                if (!e.target.files || !e.target.files[0]) return;
                const file = e.target.files[0];
                formatChatImage(file, (imgTag) => {
                  if (imgTag) {
                    State.chatInputMsg = (State.chatInputMsg || '') + imgTag;
                    m.redraw();
                  }
                });
                e.target.value = '';
              }
            })
          ]),

          m('textarea.chat-textarea', {
            placeholder: canTalk ? 'Type your encrypted message here... (or paste image)' : 'Waiting for tunnel to be secured...',
            disabled: !canTalk,
            value: State.chatInputMsg,
            style: 'flex: 1; resize: none; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.5rem; font-family: inherit; font-size: 0.9rem; outline: none; min-height: 40px; max-height: 120px;',
            oninput: (e) => {
              State.chatInputMsg = e.target.value;
            },
            onpaste: (e) => {
              if (!canTalk) return;
              const items = (e.clipboardData || (e.originalEvent && e.originalEvent.clipboardData))?.items;
              if (!items) return;
              for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                  e.preventDefault();
                  const blob = items[i].getAsFile();
                  formatChatImage(blob, (imgTag) => {
                    if (imgTag) {
                      State.chatInputMsg = (State.chatInputMsg || '') + imgTag;
                      m.redraw();
                    }
                  });
                  break;
                }
              }
            },
            onkeydown: (e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (canTalk) sendDistantChatMessage();
              }
            },
          }),

          m('button.send-btn.blue', {
            disabled: !canTalk,
            style: !canTalk ? 'opacity: 0.5; cursor: not-allowed; height: 38px;' : 'height: 38px;',
            onclick: () => {
              if (canTalk) sendDistantChatMessage();
            },
          }, [m('i.fas.fa-paper-plane'), ' Send']),
        ]),

        // Chat History Browser Modal
        m(HistoryBrowserModal),
      ]);
    },
  };
};

module.exports = ChatTab;
