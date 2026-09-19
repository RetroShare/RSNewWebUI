const m = require('mithril');
const widget = require('widgets');
const rs = require('rswebui');
const {
  State,
  fetchIdDetails,
  getStatusColor,
  getStatusTooltip,
  initializeDistantChat,
  sendDistantChatMessage,
  leaveDistantChat,
  loadOlderChatHistory,
  setChatDraft,
  switchChatIdentity,
  getDistantChatSession,
} = require('people/people_state');
const { startAttachHash, stopAttachHash } = require('people/people_attach');
const { renderChatMessage, openChatImageViewer } = require('chat/chat_state');
const { ChatComposer } = require('chat/chat_composer');
const peopleUtil = require('people/people_util');
const HistoryBrowserModal = require('people/people_history');
const icon = require('icon');
const toast = require('toast');

//  Distant chat has no size limit of its own -- getMaxMessageSecuritySize()
//  answers 0 for it and the core slices anything past 15000 characters -- but a
//  photo straight from a phone is several megabytes of base64 crawling through a
//  turtle tunnel. So the picture is scaled into a 800x600 box and its quality
//  stepped down until it fits in a couple of hundred kilobytes.
const MAX_IMAGE_CHARS = 200000;

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
      while (dataUrl.length > MAX_IMAGE_CHARS * 0.95 && quality > 0.20) {
        quality -= 0.10;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      if (dataUrl.length <= MAX_IMAGE_CHARS) {
        callback(`<img src="${dataUrl}" />`, dataUrl);
      } else {
        toast.error('Picture too large to send', {
          description: 'It stays too heavy once compressed for a distant chat tunnel.',
        });
        callback(null, null);
      }
    };
    img.onerror = () => callback(null, null);
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

const ChatTab = () => {
  function attachFileLink() {
    if (State.isHashing) return;
    //  The path is read by the RetroShare node, not by the browser, so a file
    //  picker would name something the core cannot open.
    const path = prompt('Path of the file to share, as seen by the RetroShare node:');
    if (path && path.trim()) startAttachHash(path);
  }

  function attachImage(file) {
    if (!file) return;
    formatChatImage(file, (imgTag, dataUrl) => {
      if (imgTag && dataUrl) {
        State.attachedImage = { imgTag, dataUrl, name: file.name || 'Image' };
        const session = getDistantChatSession(State.selectedId);
        if (session) session.attachedImage = State.attachedImage;
        m.redraw();
      }
    });
  }

  return {
    view: () => {
      fetchIdDetails(State.selectedId);
      const details = State.selectedId ? State.gxsIdToDetailsMap[State.selectedId] : null;
      if (!details) return null;

      const name = details.mNickname || details.mGroupName || 'Unknown';

      if (State.ownGxsIds.length === 0) {
        return m('.network-chat-view', m('.chat-warning', [
          icon('exclamation-triangle'),
          m('h4', 'No Identities Found'),
          m('p', 'You need to create a GXS identity in the "My Identities" tab before you can start distant chats.'),
        ]));
      }

      if (State.chatDisconnected) {
        return m('.network-chat-view', m('.chat-warning', [
          icon('unlink'),
          m('h4', 'Conversation Ended'),
          m('p', State.chatCloseFoundNothing
            ? 'The tunnel was already gone: the core had no connection left to close. Click below to open a new one.'
            : State.chatEndedByPoll
              ? 'The tunnel went away: closed by your contact, or dropped by the core. Click below to open a new one.'
              : 'You have closed the distant chat tunnel. Click below to reconnect.'),
          m('button.is-primary[type=button]', {
            onclick: () => initializeDistantChat(),
          }, [icon('sync-alt'), 'Reconnect']),
        ]));
      }

      if (!State.chatPid) {
        return m('.network-chat-view', m('.chat-warning', [
          icon('spinner', { spin: true }),
          m('h4', 'Connecting...'),
          m('p', 'Initiating distant chat tunnel to the peer identity...'),
        ]));
      }

      const canTalk = State.distantChatStatus && State.distantChatStatus.status === 2;

      return m('.network-chat-view', [
        //  The tunnel light on the left, who you are and what you can do on
        //  the right. Both groups were laid out inline in a Tailwind palette,
        //  which is why the identity picker sat on top of the History button.
        m('.chat-identity-bar', [
          m('.chat-tunnel-status', [
            m('span.tunnel-label', 'Distant chat tunnel'),
            icon('circle', {
              class: 'tunnel-dot',
              style: { color: getStatusColor(State.distantChatStatus ? State.distantChatStatus.status : 0) },
              title: getStatusTooltip(State.distantChatStatus ? State.distantChatStatus.status : 0),
            }),
          ]),

          m('.chat-actions', [
            (() => {
              const ownId = State.selectedOwnGxsIdForChat;
              if (ownId) fetchIdDetails(ownId);
              const ownDetails = State.gxsIdToDetailsMap[ownId];
              return m('.select-own-profile', [
                m('span.chatting-as-label', 'Chatting as'),
                m(peopleUtil.UserAvatar, {
                  avatar: ownDetails ? ownDetails.mAvatar : null,
                  identityId: ownId,
                  size: 22,
                }),
                m('select.chat-identity-select', {
                  'aria-label': 'Chatting as',
                  value: ownId,
                  onchange: (e) => switchChatIdentity(e.target.value),
                }, State.ownGxsIds.map((id) => m('option', { value: id }, rs.userList.username(id)))),
              ]);
            })(),

            m('button.history-btn[type=button]', {
              title: 'View all past chat history with this contact',
              //  The modal loads the history when it opens; asking here too
              //  ran the whole "every message ever" query twice.
              onclick: () => {
                State.showHistoryModal = true;
              },
            }, [icon('history'), m('span.btn-text', 'History')]),

            m('button.red.leave-btn[type=button]', {
              onclick: () => {
                widget.confirmMessage({
                  title: 'Leave conversation',
                  message: 'You will stop receiving messages from this distant chat.',
                  confirmLabel: 'Leave',
                  danger: true,
                  onConfirm: () => rs.rsJsonApiRequest(
                    '/rsChats/closeDistantChatConnexion',
                    {
                      pid: State.chatPid,
                    },
                    (data, success) => {
                      //  `success` is the HTTP status, not the answer: the core
                      //  says in retval whether it had anything to close. Taking
                      //  200 for a closed tunnel is how this button could report
                      //  a conversation as ended while the tunnel lived on.
                      leaveDistantChat(Boolean(success && data && data.retval));
                    }
                  ),
                });
              },
            }, [icon('sign-out-alt'), m('span.btn-text', 'Leave chat')]),
          ]),
        ]),

        m('.chat-messages', {
          //  Near the top: ask for an older slice. It is inserted above what is
          //  on screen, so its height is given back to scrollTop and the
          //  reader does not move (same as the chat rooms).
          onscroll: (e) => {
            const element = e.target;
            if (element.scrollTop > 120) return;
            const previousHeight = element.scrollHeight;
            const previousTop = element.scrollTop;
            loadOlderChatHistory(() => {
              requestAnimationFrame(() => {
                const pane = document.querySelector('.chat-messages');
                if (pane) pane.scrollTop = previousTop + (pane.scrollHeight - previousHeight);
              });
            });
          },
        }, [
          State.chatMessages.length === 0
            ? m('.chat-warning', [
                icon('comments'),
                m('h4', 'No Messages'),
                m('p', 'Distant chats are secure and encrypted. Start the conversation by typing a message below.'),
              ])
            : State.chatMessages.map((msg) => {
                if (msg.isSystem) {
                  const text = msg.msg || msg.message;
                  const tone = (text.includes('secured') || text.includes('talk')) ? 'is-secured' : 'is-pending';

                  return m('.chat-bubble-container.incoming', [
                    m('.chat-sender', 'Chat status'),
                    m('.chat-bubble.chat-system-note', { class: tone }, text),
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

        //  Hashing has no deadline and the core never reports a failure, so
        //  the wait must be visible and must always have a way out.
        (State.isHashing || State.attachError) && m('.chat-attach-status', {
          class: State.isHashing ? '' : 'is-error',
        }, State.isHashing
          ? [
              icon('spinner', { spin: true }),
              m('span.chat-attach-status__text', `Hashing ${State.attachPath}…`),
              m('button.red[type=button]', {
                onclick: () => stopAttachHash(),
              }, [icon('ban'), 'Stop']),
            ]
          : [
              icon('exclamation-triangle'),
              m('span.chat-attach-status__text', State.attachError),
              m('button[type=button]', {
                onclick: () => { State.attachError = ''; },
              }, [icon('times'), 'Dismiss']),
            ]),

        m(ChatComposer, {
          value: State.chatInputMsg,
          attachment: State.attachedImage,
          disabled: !canTalk,
          placeholder: canTalk ? 'Type a message here...' : 'Waiting for tunnel to be secured...',
          onInput: (text) => setChatDraft(text),
          onSend: () => sendDistantChatMessage(),
          onAttachFile: attachFileLink,
          onImage: attachImage,
          onRemoveAttachment: () => {
            State.attachedImage = null;
            //  The session keeps its own copy, restored by selectChatContact:
            //  clear it too, or the picture comes back after a contact switch.
            const session = getDistantChatSession(State.selectedId);
            if (session) session.attachedImage = null;
          },
          onViewAttachment: openChatImageViewer,
        }),

        // Chat History Browser Modal
        m(HistoryBrowserModal),
      ]);
    },
  };
};

module.exports = ChatTab;
