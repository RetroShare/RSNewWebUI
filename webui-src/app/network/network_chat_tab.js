const m = require('mithril');
const rs = require('rswebui');
const Data = require('network/network_data');
const {
  State,
  startDirectChat,
  getOnlineSslId,
  sendDirectChatMessage,
  loadAllDirectChatHistory,
} = require('network/network_state');
const { renderChatMessage, openChatImageViewer } = require('chat/chat_state');
const { ChatComposer } = require('chat/chat_composer');
const HistoryBrowserModal = require('people/people_history');
const icon = require('icon');

// Direct peer-to-peer chat images do NOT require 200KB compression limit
function formatDirectChatImage(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const img = new Image();
    img.onload = () => {
      const maxWidth = 1920;
      const maxHeight = 1080;
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        callback(`<img src="${dataUrl}" />`, dataUrl);
      } else {
        callback(`<img src="${evt.target.result}" />`, evt.target.result);
      }
    };
    img.onerror = () => {
      if (evt.target.result) {
        callback(`<img src="${evt.target.result}" />`, evt.target.result);
      } else {
        callback(null, null);
      }
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

const HASH_TIMEOUT_MS = 5 * 60 * 1000;
let hashJob = null;

function cancelDirectChatHash(error = '') {
  if (hashJob) {
    clearTimeout(hashJob.pollTimer);
    clearTimeout(hashJob.deadlineTimer);
    hashJob = null;
  }
  State.isHashing = false;
  State.hashingError = error;
}

function isActiveHashJob(job) {
  if (hashJob !== job) return false;
  if (State.currentChatPeerId !== job.peerId || State.selectedFriendGpgId !== job.friendId) {
    cancelDirectChatHash();
    return false;
  }
  return true;
}

function pollHashStatusForDirectChat(localpath, job) {
  if (!isActiveHashJob(job)) return;
  rs.rsJsonApiRequest('/rsFiles/ExtraFileStatus', { localpath }, (data, success) => {
    if (!isActiveHashJob(job)) return;
    if (!success) {
      cancelDirectChatHash('Could not check file hashing. Please try again.');
      m.redraw();
      return;
    }
    if (data && data.retval && data.info && data.info.hash && data.info.hash !== '0000000000000000000000000000000000000000') {
      const info = data.info;
      const sizeNum = info.size.xint64 || parseInt(info.size.xstr64) || info.size;
      const fileLink = `<a href="retroshare://file?name=${encodeURIComponent(info.name)}&size=${sizeNum}&hash=${info.hash}">${info.name}</a> (${rs.formatBytes(sizeNum)})`;

      State.chatInputMsg = State.chatInputMsg ? State.chatInputMsg + '\n' + fileLink : fileLink;
      State.showAttachModal = false;
      cancelDirectChatHash();
      State.attachPath = '';
      m.redraw();
    } else {
      job.pollTimer = setTimeout(() => pollHashStatusForDirectChat(localpath, job), 1000);
    }
  });
}

const ChatTab = () => {
  return {
    onremove: () => {
      cancelDirectChatHash();
    },
    view: () => {
      const gpgId = State.selectedFriendGpgId;
      const friend = Data.gpgDetails[gpgId];
      if (!friend) return null;

      const sslId = getOnlineSslId(gpgId);

      if (!sslId) {
        return m('.network-chat-view', [
          m('.chat-warning', [
            icon('exclamation-triangle'),
            m('h4', 'No Location Found'),
            m('p', 'This friend has no known locations to start a direct chat with.'),
          ]),
        ]);
      }

      if (!State.currentChatPeerId) {
        return m('.network-chat-view', [
          m('.chat-warning', [
            icon('comments'),
            m('h4', 'Direct Chat'),
            m('p', 'Click below to start a direct chat with ' + friend.name + '.'),
            m('button.is-primary',
              {
                onclick: () => startDirectChat(sslId),
              }, [icon('comments'), 'Start Chat']),
          ]),
        ]);
      }

      return m('.network-chat-view', [
        (() => {
          const activeLoc = friend.locations.find((loc) => loc.id === State.currentChatPeerId);
          const locName = activeLoc ? activeLoc.name : 'Unknown Location';
          const locOnline = activeLoc ? activeLoc.isOnline : false;
          return m('.chat-header-bar', [
            m('.chat-header-info', [
              m('.chat-header-name', friend.name),
              m('.chat-header-location', [
                m('span', 'Location: ' + locName),
                m('span.status-dot', { class: locOnline ? 'is-online' : 'is-offline' }),
                m('span.chat-header-presence', { class: locOnline ? 'is-online' : 'is-offline' },
                  locOnline ? 'Online' : 'Offline'),
              ])
            ]),
            m('button.history-btn', {
              title: 'View all direct chat history with this friend',
              onclick: () => {
                State.showHistoryModal = true;
                State.historySearchQuery = '';
                loadAllDirectChatHistory();
              },
            }, [icon('history'), 'History'])
          ]);
        })(),
        m(
          '.chat-messages[id=chat-messages-container]',
          State.chatMessages.map((msg) => {
            const isOwn = msg.own === true || msg.incoming === false;
            const senderName = isOwn
              ? (State.ownProfile.name || 'Me')
              : friend.name;
            const time = new Date((msg.sendTime || msg.recvTime || 0) * 1000).toLocaleTimeString();
            const text = msg.msg || msg.message || '';

            return m(
              '.chat-bubble-container' + (isOwn ? '.outgoing' : '.incoming'),
              [
                !isOwn && m('.chat-sender', senderName),
                m('.chat-bubble', renderChatMessage(text)),
                m('.chat-time', time),
              ]
            );
          })
        ),
        m(HistoryBrowserModal, {
          state: State,
          name: friend.name,
          ownName: State.ownProfile.name || 'You',
        }),
        m(ChatComposer, {
          value: State.chatInputMsg,
          attachment: State.attachedImage,
          onInput: (text) => { State.chatInputMsg = text; },
          onSend: () => sendDirectChatMessage(),
          onAttachFile: () => {
            State.showAttachModal = true;
            State.attachPath = '';
            State.attachBrowseHint = false;
            State.hashingError = '';
          },
          onImage: (file) => formatDirectChatImage(file, (imgTag, dataUrl) => {
            if (imgTag && dataUrl) {
              State.attachedImage = { imgTag, dataUrl, name: file.name || 'Image' };
              m.redraw();
            }
          }),
          onRemoveAttachment: () => { State.attachedImage = null; },
          onViewAttachment: openChatImageViewer,
        }),

        State.showAttachModal && m('.attach-modal-overlay', {
          onclick: (e) => {
            if (e.target === e.currentTarget && !State.isHashing) {
              State.showAttachModal = false;
              State.attachPath = '';
              State.attachBrowseHint = false;
              State.hashingError = '';
            }
          }
        }, [
          m('.modal-content.modal--titled', {
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': 'Attach a file',
          }, [
            m('button.modal__close[type=button][aria-label=Close]', {
              onclick: () => {
                cancelDirectChatHash();
                State.showAttachModal = false;
                State.attachPath = '';
                State.attachBrowseHint = false;
                State.hashingError = '';
              },
            }, icon('times')),
            m('.modal__head', [
              m('h2.modal__title', 'Attach a file'),
              m('p.modal__lead', 'Browse for a file or type its absolute path on this machine.'),
            ]),
            m('.modal__body', [
            m('input#direct-attach-file-picker[type=file]', {
              style: 'display:none',
              onchange: (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) {
                  const fullPath = file.path;
                  const hasFullPath = fullPath && (fullPath.includes('/') || fullPath.includes('\\')) && fullPath !== file.name;
                  if (hasFullPath) {
                    State.attachPath = fullPath;
                    State.attachBrowseHint = false;
                  } else {
                    State.attachPath = file.name;
                    State.attachBrowseHint = true;
                  }
                  e.target.value = '';
                  State.hashingError = '';
                  m.redraw();
                }
              },
            }),
            m('.attach-path-row', [
              m('input[type=text]', {
                placeholder: 'e.g. C:\\Downloads\\file.zip',
                value: State.attachPath,
                oninput: (e) => {
                  State.attachPath = e.target.value;
                  State.attachBrowseHint = false;
                },
                disabled: State.isHashing,
              }),
              m('button.attach-browse-btn', {
                type: 'button',
                disabled: State.isHashing,
                title: 'Browse for file',
                onclick: () => {
                  const picker = document.getElementById('direct-attach-file-picker');
                  if (picker) picker.click();
                },
              }, [icon('folder-open'), m('span', ' Browse…')]),
            ]),
            State.attachBrowseHint && m('.attach-path-hint', [
              icon('info-circle'),
              m('span', [
                ' Your browser cannot expose the full file path. ',
                m('strong', 'Edit the path above'),
                ' and add your folder prefix — e.g. change ',
                m('code', 'file.zip'),
                ' to ',
                m('code', 'C:\\Downloads\\file.zip'),
                ' — then click Attach.',
              ]),
            ]),
            State.isHashing && m('.hashing-spinner', [
              icon('spinner', { spin: true }),
              m('span', ' Hashing file... Please wait.')
            ]),
            !State.attachBrowseHint && State.hashingError && m('p.error-text', State.hashingError),
            m('.modal__foot', [
              m('button[type=button]', {
                onclick: () => {
                  cancelDirectChatHash();
                  State.showAttachModal = false;
                  State.attachPath = '';
                  State.attachBrowseHint = false;
                  State.hashingError = '';
                }
              }, [icon('times'), 'Cancel']),
              m('button.is-primary[type=button]', {
                disabled: State.isHashing || !State.attachPath.trim() || State.attachBrowseHint,
                onclick: () => {
                  const path = State.attachPath.trim();
                  cancelDirectChatHash();
                  const job = {
                    peerId: State.currentChatPeerId,
                    friendId: State.selectedFriendGpgId,
                  };
                  hashJob = job;
                  job.deadlineTimer = setTimeout(() => {
                    if (hashJob !== job) return;
                    cancelDirectChatHash('File hashing timed out after 5 minutes. Please try again.');
                    m.redraw();
                  }, HASH_TIMEOUT_MS);
                  State.isHashing = true;
                  State.hashingError = '';
                  m.redraw();

                  rs.rsJsonApiRequest('/rsFiles/ExtraFileHash', {
                    localpath: path,
                    period: 86400 * 7,
                    flags: 0
                  }, (data, success) => {
                    if (!isActiveHashJob(job)) return;
                    if (success && data.retval) {
                      pollHashStatusForDirectChat(path, job);
                    } else {
                      cancelDirectChatHash('Failed to initiate file hashing. Check the path and try again.');
                      m.redraw();
                    }
                  });
                }
              }, [icon('link'), 'Attach']),
            ]),
            ]),
          ])
        ]),
      ]);
    },
  };
};

module.exports = ChatTab;
