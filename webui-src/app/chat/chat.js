const m = require('mithril');
const widget = require('widgets');
const rs = require('rswebui');
const peopleUtil = require('people/people_util');
const people = require('people/people');
const chatState = require('chat/chat_state');
const { ChatComposer } = require('chat/chat_composer');
const HistoryBrowserModal = require('people/people_history');
const renderIdentityTooltip = require('mail/mail_identity_tooltip');
const icon = require('icon');
const toast = require('toast');

const {
  sortLobbies,
  getStatusColor,
  getStatusTooltip,
  getSafeAvatar,
  ChatRoomsModel,
  ChatLobbyModel,
  ChatHubState,
  openChatImageViewer,
} = chatState;


// Mirroring C++ RsHtml::makeEmbeddedImage for resizing chat images to fit RetroShare max packet limit (~30KB)
function formatChatImage(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const img = new Image();
    img.onload = () => {
      // Bounding box for chat images: 420x320 max
      const maxWidth = 420;
      const maxHeight = 320;
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

      // Dynamically step down JPEG quality until base64 string is under 28,000 characters (28KB)
      let quality = 0.70;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrl.length > 28000 && quality > 0.15) {
        quality -= 0.10;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      if (dataUrl.length <= 32000) {
        callback(`<img src="${dataUrl}" />`, dataUrl);
      } else {
        toast.error('Image too large to send', {
          description: 'It exceeds the RetroShare chat packet size limit.',
        });
        callback(null, null);
      }
    };
    img.onerror = () => {
      callback(null, null);
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

function loadOwnChatProfile() {
  rs.rsJsonApiRequest('/rsConfig/getConfigNetStatus', {}, (data) => {
    if (data && data.status) {
      ChatHubState.ownProfile.name = data.status.ownName || 'Unknown';
      m.redraw();
    }
  });
}

function loadFriendsForInvite() {
  ChatHubState.friendsList = [];
  rs.rsJsonApiRequest('/rsPeers/getFriendList', {}, (data) => {
    if (data && data.sslIds) {
      data.sslIds.forEach((sslId) => {
        rs.rsJsonApiRequest('/rsPeers/getPeerDetails', { sslId }, (detData) => {
          if (detData && detData.det) {
            rs.rsJsonApiRequest('/rsPeers/isOnline', { sslId }, (onlineData) => {
              ChatHubState.friendsList.push({
                id: sslId,
                name: detData.det.name,
                online: onlineData ? onlineData.retval : false
              });
              ChatHubState.friendsList.sort((a, b) => {
                if (a.online !== b.online) return a.online ? -1 : 1;
                return a.name.localeCompare(b.name);
              });
              m.redraw();
            });
          }
        });
      });
    }
  });
}

function scrollChatToBottom() {
  setTimeout(() => {
    const element = document.querySelector('.chat-hub-messages');
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, 50);
}

//  Whether the conversation is still pinned to its last message. It starts
//  pinned, follows the user's own scrolling, and decides whether a redraw is
//  allowed to jump back down -- without it, reading anything older is
//  impossible: the pane redraws on every event and every poll answer, and each
//  one dragged the reader back to the bottom a few tens of milliseconds later.
let chatStickToBottom = true;

//  A little slack, because a reader who stops one line short of the end still
//  means "keep following", and because scrollTop is fractional on zoomed or
//  high-density displays.
const CHAT_STICK_SLACK_PX = 80;

function updateChatStickToBottom(element) {
  if (!element) return;
  chatStickToBottom =
    element.scrollHeight - element.scrollTop - element.clientHeight <= CHAT_STICK_SLACK_PX;
}

//  Far enough from the top to have the next slice ready before the reader gets
//  there, close enough not to fire on the first flick of a long conversation.
const CHAT_LOAD_OLDER_AT_PX = 120;

function loadOlderWhenAtTop(element) {
  if (!element || element.scrollTop > CHAT_LOAD_OLDER_AT_PX) return;

  //  Older messages are inserted above the ones on screen, which pushes
  //  everything down by exactly the height they add. Put that height back into
  //  scrollTop and the reader does not move at all -- without it the pane jumps
  //  to a different part of the conversation each time a slice lands.
  const previousHeight = element.scrollHeight;
  const previousTop = element.scrollTop;

  ChatLobbyModel.loadOlderHistory(() => {
    requestAnimationFrame(() => {
      const pane = document.querySelector('.chat-hub-messages');
      if (!pane) return;
      pane.scrollTop = previousTop + (pane.scrollHeight - previousHeight);
    });
  });
}

function renderUserTooltip(gxsId, name) {
  const details = ChatHubState.gxsDetails[gxsId];
  const rect = ChatHubState.hoveredUser ? ChatHubState.hoveredUser.rect : null;
  return renderIdentityTooltip({ details, gxsId, name, rect });
}

//  Hashing a large file takes minutes, so there is no deadline to enforce here.
//  What the poll must not do is keep asking at full speed: it backs off from one
//  second towards ten, which is still prompt for a small file and costs a
//  request every ten seconds for a big one -- each of them a fresh connection,
//  the JSON API answers `Connection: close`.
const HASH_POLL_START_MS = 1000;
const HASH_POLL_MAX_MS = 10000;

function pollHashStatus(localpath, delay = HASH_POLL_START_MS) {
  rs.rsJsonApiRequest('/rsFiles/ExtraFileStatus', { localpath }, (data) => {
    //  Give up quietly if the user cancelled or left in the meantime: this
    //  chain lives in a setTimeout, not in the component.
    if (!ChatHubState.isHashing || ChatHubState.attachPath !== localpath) return;

    if (data && data.retval && data.info && data.info.hash && data.info.hash !== '0000000000000000000000000000000000000000') {
      const info = data.info;
      const sizeNum = info.size.xint64 || parseInt(info.size.xstr64) || info.size;
      const fileLink = `<a href="retroshare://file?name=${encodeURIComponent(info.name)}&size=${sizeNum}&hash=${info.hash}">${info.name}</a> (${rs.formatBytes(sizeNum)})`;

      const roomId = ChatHubState.selectedRoomId;
      const draft = ChatHubState.drafts[roomId] || '';
      ChatHubState.drafts[roomId] = draft ? draft + '\n' + fileLink : fileLink;

      ChatHubState.showAttachModal = false;
      ChatHubState.isHashing = false;
      ChatHubState.attachPath = '';
      m.redraw();
    } else {
      setTimeout(
        () => pollHashStatus(localpath, Math.min(delay * 2, HASH_POLL_MAX_MS)),
        delay
      );
    }
  });
}

//  The core has no way of telling us that hashing failed -- ftExtraList drops
//  the file silently -- so a file that exists but cannot be read leaves this
//  poll running for ever. Hence: stopping must always be possible from the
//  dialog, and this is the single place that does it.
function stopHashing() {
  ChatHubState.isHashing = false;
  ChatHubState.attachPath = '';
  ChatHubState.attachBrowseHint = false;
  ChatHubState.hashingError = '';
}

// ************************* views ****************************

// ************************* Chat Hub Sub-Components ****************************

const ChatRoomHeader = () => {
  return {
    view: (vnode) => {
      const room = vnode.attrs.room;
      const lobbyHexId = rs.idToHex(room.lobby_id);
      const isDistant = room.chatType === 2;
      const showHistory = () => { ChatHubState.showHistoryModal = true; };
      const leaveDistant = () => widget.confirmMessage({
        title: 'Leave conversation',
        message: 'You will stop receiving messages from this distant chat.',
        confirmLabel: 'Leave',
        danger: true,
        onConfirm: () => {
          rs.rsJsonApiRequest(
            '/rsChats/closeDistantChatConnexion',
            { pid: lobbyHexId },
            (data, success) => {
              if (!success) return;
              ChatLobbyModel.stopStatusPolling();
              ChatHubState.selectedRoom = null;
              ChatHubState.selectedRoomId = null;
              ChatHubState.selectedRoomType = null;
              m.route.set('/chat');
            }
          );
        },
      });
      const toggleParticipants = () => {
        ChatHubState.showParticipants = !ChatHubState.showParticipants;
        ChatHubState.activeMenu = null;
        ChatHubState.hoveredUser = null;
      };
      const toggleDetails = () => {
        const toChat = ChatHubState.activeTab === 'details';
        ChatHubState.activeTab = toChat ? 'chat' : 'details';
        if (toChat) scrollChatToBottom();
      };
      const inviteFriends = () => {
        ChatHubState.showInviteModal = true;
        loadFriendsForInvite();
      };
      const leaveRoom = () => {
        ChatLobbyModel.unsubscribeChatLobby(lobbyHexId, () => {
          ChatHubState.selectedRoom = null;
          ChatHubState.selectedRoomId = null;
          ChatHubState.selectedRoomType = null;
          m.route.set('/chat');
        });
      };
      const menuItems = isDistant
        ? [
            { label: 'View history', icon: 'history', onclick: showHistory },
            { label: 'Leave chat', icon: 'sign-out-alt', danger: true, onclick: leaveDistant },
          ]
        : [
            {
              label: ChatHubState.showParticipants ? 'Hide participants' : 'Show participants',
              icon: 'users', selected: Boolean(ChatHubState.showParticipants),
              onclick: toggleParticipants,
            },
            {
              label: ChatHubState.activeTab === 'details' ? 'Back to conversation' : 'Room details',
              icon: ChatHubState.activeTab === 'details' ? 'comments' : 'info-circle',
              selected: ChatHubState.activeTab === 'details', onclick: toggleDetails,
            },
            { label: 'Invite friends', icon: 'user-plus', onclick: inviteFriends },
            { label: 'View history', icon: 'history', onclick: showHistory },
            { label: 'Leave room', icon: 'sign-out-alt', danger: true, onclick: leaveRoom },
          ];
      return m('.chat-hub-header-bar', [
        vnode.attrs.onBack && m('.chat-header-back', m(widget.BackButton, {
          label: 'Back to Chats',
          onclick: vnode.attrs.onBack,
        })),
        m('.chat-header-info', [
          m('.chat-header-name-container', [
            m('.chat-header-name', room.lobby_name || '<unnamed>'),
            isDistant && icon('circle', {
              class: 'chat-tunnel-dot',
              style: {
                color: getStatusColor(ChatLobbyModel.distantChatStatus ? ChatLobbyModel.distantChatStatus.status : 0),
              },
              title: getStatusTooltip(ChatLobbyModel.distantChatStatus ? ChatLobbyModel.distantChatStatus.status : 0),
            })
          ]),
          m('.chat-header-topic', room.lobby_topic || 'No topic'),
        ]),
        !vnode.attrs.hideActions && m('.chat-header-actions', [
          isDistant
            ? [
                m(
                  'button.blue',
                  {
                    title: 'View distant chat history',
                    onclick: showHistory,
                  },
                  [icon('history'), m('span.btn-text', ' History')]
                ),
                m(
                  'button.red',
                  {
                    title: 'Leave Distant Chat',
                    onclick: leaveDistant,
                  },
                  [icon('sign-out-alt'), m('span.btn-text', ' Leave Chat')]
                )
              ]
            : [
                //  Below 900px the participants column is not laid out; this
                //  opens it as a sheet. Desktop hides the button (see
                //  pages/_chat.scss), the column being always visible there.
                m(
                  'button.participants-toggle',
                  {
                    title: ChatHubState.showParticipants ? 'Hide participants' : 'Show participants',
                    'aria-pressed': String(Boolean(ChatHubState.showParticipants)),
                    class: ChatHubState.showParticipants ? 'is-on' : '',
                    onclick: toggleParticipants,
                  },
                  [icon('users'), m('span.btn-text', ' ' + ChatLobbyModel.users.length)]
                ),
                m(
                  'button.chat-details-toggle',
                  {
                    title: ChatHubState.activeTab === 'details' ? 'Back to conversation' : 'Room details',
                    'aria-pressed': String(ChatHubState.activeTab === 'details'),
                    class: ChatHubState.activeTab === 'details' ? 'is-on' : '',
                    onclick: toggleDetails,
                  },
                  ChatHubState.activeTab === 'details'
                    ? [icon('comments'), m('span.btn-text', ' Chat')]
                    : [icon('info-circle'), m('span.btn-text', ' Details')]
                ),
                m('button.is-primary',
                  {
                    title: 'Invite friends to this room',
                    onclick: inviteFriends,
                  },
                  [icon('user-plus'), m('span.btn-text', ' Invite')]
                ),
                m(
                  'button.blue',
                  {
                    title: 'View chat room history',
                    onclick: showHistory,
                  },
                  [icon('history'), m('span.btn-text', ' History')]
                ),
                m(
                  'button.red',
                  {
                    title: 'Leave Room',
                    onclick: leaveRoom,
                  },
                  [icon('sign-out-alt'), m('span.btn-text', ' Leave')]
                )
              ],
        ]),
        !vnode.attrs.hideActions && m(widget.Menu, {
          class: 'chat-header-actions-menu',
          mark: 'ellipsis-v',
          title: 'Actions',
          items: menuItems,
        }),
      ]);
    },
  };
};

const ChatConversationView = () => {
  return {
    oninit: () => {
      //  The column is part of the layout on a wide screen and a sheet over
      //  the messages on a narrow one, so "open" is the right default only on
      //  the first. One flag, seeded from the viewport it opens in.
      if (ChatHubState.showParticipants === null) {
        ChatHubState.showParticipants = window.innerWidth >= 900;
      }
      scrollChatToBottom();
    },
    onremove: () => {
      //  The poll writes its file link into the textarea of this very view, so
      //  once the view is gone the answer has nowhere to land: leaving it
      //  running would only keep asking for a result nobody can use.
      if (ChatHubState.isHashing) {
        ChatHubState.showAttachModal = false;
        stopHashing();
      }
    },
    view: () => {
      const chatType = ChatLobbyModel.currentLobby && ChatLobbyModel.currentLobby.chatType;
      const isRoom = chatType === 3;
      const isDistant = chatType === 2;
      const canTalk = !isDistant || (ChatLobbyModel.distantChatStatus && ChatLobbyModel.distantChatStatus.status === 2);
      return m('.chat-hub-conversation-layout' + (ChatHubState.showParticipants ? '.show-participants' : ''), [
        m('.chat-hub-conversation-main', [
          m(
            '.chat-hub-messages' + (isRoom ? '.compact-container' : ''),
            {
              oncreate: () => {
                chatStickToBottom = true;
                scrollChatToBottom();
              },
              onupdate: () => {
                if (chatStickToBottom) scrollChatToBottom();
              },
              onscroll: (event) => {
                //  A scroll must not trigger a redraw: mithril redraws after
                //  every handler by default, and this one fires continuously
                //  while the reader drags the pane.
                event.redraw = false;
                updateChatStickToBottom(event.target);
                loadOlderWhenAtTop(event.target);
              },
            },
            ChatLobbyModel.messages
          ),
          m(ChatComposer, {
            value: ChatHubState.drafts[ChatHubState.selectedRoomId] || '',
            attachment: ChatHubState.attachedImage,
            disabled: !canTalk,
            onInput: (text) => {
              ChatHubState.drafts[ChatHubState.selectedRoomId] = text;
            },
            onSend: () => {
              if (!canTalk) return;
              const roomId = ChatHubState.selectedRoomId;
              const msg = (ChatHubState.drafts[roomId] || '').trim();
              const attached = ChatHubState.attachedImage;
              if (!msg && !attached) return;

              const fullMsg = attached
                ? (msg ? `${msg}\n${attached.imgTag}` : attached.imgTag)
                : msg;

              ChatHubState.drafts[roomId] = '';
              ChatHubState.attachedImage = null;
              ChatLobbyModel.sendMessage(fullMsg, () => {
                scrollChatToBottom();
                m.redraw();
              });
            },
            onAttachFile: () => {
              ChatHubState.showAttachModal = true;
              ChatHubState.showEmojiPicker = false;
            },
            onImage: (file) => formatChatImage(file, (imgTag, dataUrl) => {
              if (imgTag && dataUrl) {
                ChatHubState.attachedImage = { imgTag, dataUrl, name: file.name || 'Image' };
                m.redraw();
              }
            }),
            onRemoveAttachment: () => { ChatHubState.attachedImage = null; },
            onViewAttachment: openChatImageViewer,
          }),

          ChatHubState.showAttachModal && m('.attach-modal-overlay', {
            onclick: (e) => {
              if (e.target === e.currentTarget) {
                ChatHubState.showAttachModal = false;
                stopHashing();
              }
            }
          }, [
            m('.modal-content.modal--titled', {
              role: 'dialog',
              'aria-modal': 'true',
              'aria-label': 'Attach a file',
            }, [
              m('button.modal__close[type=button][aria-label=Close]', {
                onclick: () => { ChatHubState.showAttachModal = false; stopHashing(); },
              }, icon('times')),
              m('.modal__head', [
                m('h2.modal__title', 'Attach a file'),
                m('p.modal__lead', 'Browse for a file or type its absolute path on this machine.'),
              ]),
              m('.modal__body', [
              m('input#attach-file-picker[type=file]', {
                hidden: true,
                onchange: (e) => {
                  const file = e.target.files && e.target.files[0];
                  if (file) {
                    const fullPath = file.path;
                    const hasFullPath = fullPath && (fullPath.includes('/') || fullPath.includes('\\')) && fullPath !== file.name;
                    if (hasFullPath) {
                      ChatHubState.attachPath = fullPath;
                      ChatHubState.attachBrowseHint = false;
                    } else {
                      ChatHubState.attachPath = file.name;
                      ChatHubState.attachBrowseHint = true;
                    }
                    e.target.value = '';
                    ChatHubState.hashingError = '';
                    m.redraw();
                  }
                },
              }),
              m('.attach-path-row', [
                m('input[type=text]', {
                  placeholder: 'e.g. C:\\Downloads\\file.zip',
                  value: ChatHubState.attachPath,
                  oninput: (e) => {
                    ChatHubState.attachPath = e.target.value;
                    ChatHubState.attachBrowseHint = false;
                  },
                  disabled: ChatHubState.isHashing,
                }),
                m('button.attach-browse-btn', {
                  type: 'button',
                  disabled: ChatHubState.isHashing,
                  title: 'Browse for file',
                  onclick: () => {
                    const picker = document.getElementById('attach-file-picker');
                    if (picker) picker.click();
                  },
                },
                  [icon('folder-open'), m('span', ' Browse…')]
                ),
              ]),
              ChatHubState.attachBrowseHint && m('.attach-path-hint', [
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
              ChatHubState.isHashing && m('.hashing-spinner', [
                icon('spinner', { spin: true }),
                m('span', ' Hashing file... Please wait.')
              ]),
              !ChatHubState.attachBrowseHint && ChatHubState.hashingError && m('p.error-text', ChatHubState.hashingError),
              m('.modal__foot', [
                m('button[type=button]', {
                  onclick: () => {
                    ChatHubState.showAttachModal = false;
                    stopHashing();
                  }
                }, [icon('ban'), ChatHubState.isHashing ? 'Stop' : 'Cancel']),
                m('button.is-primary[type=button]', {
                  disabled: ChatHubState.isHashing || !ChatHubState.attachPath.trim() || ChatHubState.attachBrowseHint,
                  onclick: () => {
                    const path = ChatHubState.attachPath.trim();
                    //  Normalised, because the poll below identifies its own run
                    //  by comparing this against the path it was started with.
                    ChatHubState.attachPath = path;
                    ChatHubState.isHashing = true;
                    ChatHubState.hashingError = '';
                    m.redraw();

                    rs.rsJsonApiRequest('/rsFiles/ExtraFileHash', {
                      localpath: path,
                      period: 86400 * 7,
                      flags: 0
                    }, (data, success) => {
                      if (success && data.retval) {
                        pollHashStatus(path);
                      } else {
                        ChatHubState.isHashing = false;
                        ChatHubState.hashingError = 'Failed to initiate file hashing. Check the path and try again.';
                        m.redraw();
                      }
                    });
                  }
                }, [icon('link'), 'Attach']),
              ]),
              ]),
            ])
          ]),
          m(HistoryBrowserModal, { isRoom: true }),
        ]),
        m('.chat-hub-rightbar', [
          m('.rightbar-title', [
            'Participants',
            m('button.rightbar-close', {
              type: 'button',
              title: 'Close',
              'aria-label': 'Close participants',
              onclick: () => {
                ChatHubState.showParticipants = false;
                ChatHubState.activeMenu = null;
              },
            }, icon('times')),
          ]),
          m('.rightbar-users-list', (() => {
            const sortedUsers = [...ChatLobbyModel.users];
            if (ChatHubState.userSortMethod === 'activity') {
              sortedUsers.sort((a, b) => b.lastAct - a.lastAct);
            } else {
              sortedUsers.sort((a, b) => a.name.localeCompare(b.name));
            }
            return sortedUsers.map((user) => {
              const gxsId = user.key;
              const name = user.name;

              if (gxsId && ChatHubState.gxsDetails[gxsId] === undefined) {
                ChatHubState.gxsDetails[gxsId] = null;
                rs.rsJsonApiRequest('/rsIdentity/getIdDetails', { id: gxsId }, (data) => {
                  if (data && data.details) {
                    ChatHubState.gxsDetails[gxsId] = data.details;
                    m.redraw();
                  }
                });
              }

              const details = ChatHubState.gxsDetails[gxsId];
              const avatar = getSafeAvatar(details);
              const firstLetter = (name || '?').slice(0, 1).toUpperCase();

              const opinion = details && details.mReputation ? details.mReputation.mOwnOpinion : 1;
              const isBanned = opinion === 0;
              if (isBanned) return null;

              const now = Math.floor(Date.now() / 1000);
              const tLastAct = user.lastAct || 0;
              const isOwn = gxsId === rs.idToHex(ChatLobbyModel.currentLobby.gxs_id || '');
              const isMuted = ChatHubState.mutedUsers && ChatHubState.mutedUsers.has(gxsId);

              //  A participant reports a state, not a colour; `active` draws
              //  no marker at all, since a room of active people does not need
              //  a dot beside every name.
              let statusTone = 'active';
              let statusTooltip = 'Active';

              if (isMuted) {
                statusTone = 'muted';
                statusTooltip = 'Muted';
              } else if (isOwn) {
                statusTone = 'own';
                statusTooltip = 'You';
              } else if (tLastAct + 600 < now) {
                statusTone = 'inactive';
                statusTooltip = 'Inactive';
              } else if (tLastAct + 300 < now) {
                statusTone = 'away';
                statusTooltip = 'Away';
              }

              const openUserMenu = (e) => {
                  ChatHubState.hoveredUser = null;

                  const rect = e.currentTarget.getBoundingClientRect();
                  const rightbar = document.querySelector('.chat-hub-rightbar');
                  if (rightbar) {
                    const parentRect = rightbar.getBoundingClientRect();
                    const itemBottom = rect.bottom - parentRect.top;
                    const estimatedMenuHeight = 310;
                    let top = itemBottom;
                    if (itemBottom + estimatedMenuHeight > parentRect.height) {
                      top = rect.top - parentRect.top - estimatedMenuHeight;
                      if (top < 10) top = 10;
                    }
                    ChatHubState.activeMenu = { gxsId, name, top };
                    m.redraw();
                  }
              };

              return m('.user', {
                onmouseenter: (e) => {
                  if (ChatHubState.activeMenu) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  ChatHubState.hoveredUser = { gxsId, name, rect };
                },
                onmouseleave: () => {
                  ChatHubState.hoveredUser = null;
                },
                onclick: (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  ChatHubState.hoveredUser = null;
                  //  A phone has no right click: a tap on a participant is the
                  //  only way to reach "Start private chat" and the rest of
                  //  the menu. Same media query as the sheet in _chat.scss.
                  if (window.matchMedia('(max-width: 899px), (hover: none)').matches) {
                    openUserMenu(e);
                    return;
                  }
                  ChatHubState.activeMenu = null;
                  m.redraw();
                },
                oncontextmenu: (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openUserMenu(e);
                },
              }, [
                m(peopleUtil.UserAvatar, { avatar, firstLetter, identityId: gxsId, size: 32 }),
                m('span.user-name', name),
                (() => {
                  if (isBanned) {
                    return icon('ban', { class: 'user-mark is-bad', title: 'Banned' });
                  }
                  if (isMuted) {
                    return icon('volume-mute', { class: 'user-mark is-bad', title: 'Muted' });
                  }
                  if (statusTone !== 'active') {
                    return m('span.user-mark.user-mark--dot', {
                      class: `is-${statusTone}`,
                      title: statusTooltip,
                    });
                  }
                  return null;
                })(),
              ]);
            });
          })()),
          ChatHubState.hoveredUser && renderUserTooltip(ChatHubState.hoveredUser.gxsId, ChatHubState.hoveredUser.name),
          ChatHubState.activeMenu && (() => {
            const menu = ChatHubState.activeMenu;
            const isOwn = menu.gxsId === rs.idToHex(ChatLobbyModel.currentLobby.gxs_id || '');
            const isMuted = ChatHubState.mutedUsers && ChatHubState.mutedUsers.has(menu.gxsId);

            return [
              m('.menu-backdrop', {
                onclick: (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  ChatHubState.activeMenu = null;
                  m.redraw();
                },
                oncontextmenu: (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  ChatHubState.activeMenu = null;
                  m.redraw();
                },
              }),
              m('.rightbar-context-menu', {
                style: {
                  top: `${menu.top}px`,
                },
                onclick: (e) => {
                  e.stopPropagation();
                }
              }, [
              m('.menu-item', {
                onclick: () => {
                  ChatHubState.userSortMethod = 'activity';
                  ChatHubState.activeMenu = null;
                  m.redraw();
                }
              }, [
                m('span.menu-tick', {
                  class: ChatHubState.userSortMethod === 'activity' ? 'is-on' : '',
                }),
                'Sort by Activity'
              ]),
              m('.menu-item', {
                onclick: () => {
                  ChatHubState.userSortMethod = 'name';
                  ChatHubState.activeMenu = null;
                  m.redraw();
                }
              }, [
                m('span.menu-tick', {
                  class: ChatHubState.userSortMethod === 'name' ? 'is-on' : '',
                }),
                'Sort by Name'
              ]),
              m('hr.menu-rule'),
              !isOwn && m('.menu-item', {
                onclick: () => {
                  ChatHubState.activeMenu = null;
                  people.setSelectedId(menu.gxsId, 'chat');
                }
              }, [
                icon('comments'),
                'Start private chat'
              ]),
              !isOwn && m('.menu-item', {
                onclick: () => {
                  ChatHubState.activeMenu = null;
                  people.setSelectedId(menu.gxsId, 'details', true);
                }
              }, [
                icon('envelope'),
                'Send Message'
              ]),
              !isOwn && m('hr.menu-rule'),
              !isOwn && m('.menu-item', {
                onclick: () => {
                  if (isMuted) {
                    ChatHubState.mutedUsers.delete(menu.gxsId);
                  } else {
                    ChatHubState.mutedUsers.add(menu.gxsId);
                  }
                  ChatHubState.activeMenu = null;
                  m.redraw();
                }
              }, [
                icon(isMuted ? 'volume-up' : 'volume-mute'),
                isMuted ? 'Unmute participant' : 'Mute participant'
              ]),
              !isOwn && m('.menu-item', {
                onclick: () => {
                  ChatHubState.activeMenu = null;
                  rs.rsJsonApiRequest('/rsreputations/setOwnOpinion', { id: menu.gxsId, op: 2 }, (data, success) => {
                    if (success) {
                      if (!ChatHubState.gxsDetails[menu.gxsId]) ChatHubState.gxsDetails[menu.gxsId] = { mReputation: {} };
                      if (!ChatHubState.gxsDetails[menu.gxsId].mReputation) ChatHubState.gxsDetails[menu.gxsId].mReputation = {};
                      ChatHubState.gxsDetails[menu.gxsId].mReputation.mOwnOpinion = 2;
                      m.redraw();
                      rs.rsJsonApiRequest('/rsIdentity/getIdDetails', { id: menu.gxsId }, (d) => {
                        if (d && d.details) {
                          ChatHubState.gxsDetails[menu.gxsId] = d.details;
                          m.redraw();
                        }
                      });
                    }
                  });
                }
              }, [
                m('span.opinion-mark.is-up', icon('thumbs-up')),
                'Give positive opinion'
              ]),
              !isOwn && m('.menu-item', {
                onclick: () => {
                  ChatHubState.activeMenu = null;
                  rs.rsJsonApiRequest('/rsreputations/setOwnOpinion', { id: menu.gxsId, op: 1 }, (data, success) => {
                    if (success) {
                      if (!ChatHubState.gxsDetails[menu.gxsId]) ChatHubState.gxsDetails[menu.gxsId] = { mReputation: {} };
                      if (!ChatHubState.gxsDetails[menu.gxsId].mReputation) ChatHubState.gxsDetails[menu.gxsId].mReputation = {};
                      ChatHubState.gxsDetails[menu.gxsId].mReputation.mOwnOpinion = 1;
                      m.redraw();
                      rs.rsJsonApiRequest('/rsIdentity/getIdDetails', { id: menu.gxsId }, (d) => {
                        if (d && d.details) {
                          ChatHubState.gxsDetails[menu.gxsId] = d.details;
                          m.redraw();
                        }
                      });
                    }
                  });
                }
              }, [
                m('span.opinion-mark.is-warn', icon('hand-paper')),
                'Give neutral opinion'
              ]),
              !isOwn && m('.menu-item', {
                onclick: () => {
                  ChatHubState.activeMenu = null;
                  rs.rsJsonApiRequest('/rsreputations/setOwnOpinion', { id: menu.gxsId, op: 0 }, (data, success) => {
                    if (success) {
                      if (!ChatHubState.gxsDetails[menu.gxsId]) ChatHubState.gxsDetails[menu.gxsId] = { mReputation: {} };
                      if (!ChatHubState.gxsDetails[menu.gxsId].mReputation) ChatHubState.gxsDetails[menu.gxsId].mReputation = {};
                      ChatHubState.gxsDetails[menu.gxsId].mReputation.mOwnOpinion = 0;
                      m.redraw();
                      rs.rsJsonApiRequest('/rsIdentity/getIdDetails', { id: menu.gxsId }, (d) => {
                        if (d && d.details) {
                          ChatHubState.gxsDetails[menu.gxsId] = d.details;
                          m.redraw();
                        }
                      });
                    }
                  });
                }
              }, [
                m('span.opinion-mark.is-down', icon('thumbs-down')),
                'Ban this person (Sets negative opinion)'
              ]),
              m('.menu-item', {
                onclick: () => {
                  ChatHubState.activeMenu = null;
                  people.setSelectedId(menu.gxsId, 'details');
                }
              }, [
                icon('user'),
                'Show author in people tab'
              ])
            ])];
          })()
        ])
      ]);
    },
  };
};

// ***************************** Page Layouts ******************************

function getLobbyPrivacyInfo(room) {
  if (!room) return { type: 'Public', security: 'Anonymous IDs accepted' };

  const flags =
    room.lobby_privacy_type !== undefined
      ? room.lobby_privacy_type
      : room.lobby_privacy_level !== undefined
      ? room.lobby_privacy_level
      : room.privacy_type !== undefined
      ? room.privacy_type
      : room.lobby_privacy !== undefined
      ? room.lobby_privacy
      : room.privacy_level !== undefined
      ? room.privacy_level
      : room.lobby_flags !== undefined
      ? room.lobby_flags
      : 0;

  let isPublic =
    (flags & 4) !== 0 ||
    (flags & 1) !== 0 ||
    ChatHubState.selectedRoomType === 'public' ||
    room.is_public === true;

  if (flags === 1 || flags === 2) {
    if ((flags & 1) === 1 && (flags & 4) === 0 && ChatHubState.selectedRoomType !== 'public') {
      isPublic = false;
    }
  }

  const typeStr = isPublic ? 'Public' : 'Private';
  const isAuthOnly = (flags & 8) !== 0;
  const securityStr = isAuthOnly ? 'No anonymous IDs' : 'Anonymous IDs accepted';

  return {
    type: typeStr,
    security: securityStr,
  };
}

const ChatRoomDetailView = () => {
  let activeParticipantId = null;

  return {
    view: () => {
      const room = ChatHubState.selectedRoom;
      if (!room) return null;

      let participants = [];

      if (room.gxs_ids) {
        if (Array.isArray(room.gxs_ids)) {
          participants = room.gxs_ids.map((u) => ({
            key: u.key,
            name: rs.userList.username(u.key) || u.key
          }));
        } else if (typeof room.gxs_ids === 'object') {
          participants = Object.keys(room.gxs_ids).map((key) => ({
            key,
            name: rs.userList.username(key) || key
          }));
        }
      }

      const ownId = room.gxs_id;
      if (ownId && ownId !== '00000000000000000000000000000000') {
        const hasOwn = participants.some((p) => p.key === ownId);
        if (!hasOwn) {
          participants.push({
            key: ownId,
            name: rs.userList.username(ownId) || ownId
          });
        }
      }

      const participantCount = participants.length;
      const sortedParticipants = participants.sort((a, b) => a.name.localeCompare(b.name));

      const lobbyHexId = rs.idToHex(room.lobby_id);
      const privacy = getLobbyPrivacyInfo(room);


      return m('.chat-room-detail-view', [
        m('.detail-section', [
          m('h3', 'Room info'),
          m('.info-grid', [
            m('.info-cell', [
              m('.info-label', 'Type'),
              m('.info-value', privacy.type),
            ]),
            m('.info-cell', [
              m('.info-label', 'Security'),
              m('.info-value', privacy.security),
            ]),
            m('.info-cell', [
              m('.info-label', 'You are'),
              m('.info-value', rs.userList.username(room.gxs_id) || room.gxs_id || '???'),
            ]),
            //  The id is a fixed-length number and fits a column; a topic is a
            //  sentence someone wrote, so it gets the wide row.
            m('.info-cell', [
              m('.info-label', 'Lobby ID'),
              m('.info-value.info-value--id', lobbyHexId),
            ]),
            m('.info-cell.info-cell--wide', [
              m('.info-label', 'Topic'),
              m('.info-value', room.lobby_topic || 'None'),
            ]),
          ]),
        ]),

        m('.detail-section', [
          m('h3', 'Participants (' + participantCount + ')'),
          sortedParticipants.length > 0
            ? m(
                '.participants-grid',
                sortedParticipants.map((participant) => {
                  if (participant.key && ChatHubState.gxsDetails[participant.key] === undefined) {
                    ChatHubState.gxsDetails[participant.key] = null;
                    rs.rsJsonApiRequest('/rsIdentity/getIdDetails', { id: participant.key }, (data) => {
                      if (data && data.details) {
                        ChatHubState.gxsDetails[participant.key] = data.details;
                        m.redraw();
                      }
                    });
                  }

                  const details = ChatHubState.gxsDetails[participant.key];
                  const avatar = getSafeAvatar(details);
                  const firstLetter = (participant.name || '?').slice(0, 1).toUpperCase();
                  const isOwn = participant.key === rs.idToHex(room.gxs_id || '');
                  const actionsOpen = activeParticipantId === participant.key;

                  return m('.participant-card' + (!isOwn ? '.has-actions' : '') + (actionsOpen ? '.actions-open' : ''), {
                    role: !isOwn ? 'button' : undefined,
                    tabindex: !isOwn ? 0 : undefined,
                    'aria-expanded': !isOwn ? String(actionsOpen) : undefined,
                    onclick: !isOwn ? () => {
                      activeParticipantId = actionsOpen ? null : participant.key;
                    } : undefined,
                    onkeydown: !isOwn ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        activeParticipantId = actionsOpen ? null : participant.key;
                      }
                    } : undefined,
                  }, [
                    m(peopleUtil.UserAvatar, {
                      avatar,
                      firstLetter,
                      identityId: participant.key,
                      size: 32,
                    }),
                    m('.participant-name', participant.name),
                    !isOwn && icon('chevron-down', { class: 'participant-more',  'aria-hidden': 'true' }),
                    !isOwn && actionsOpen && m('.participant-actions', [
                      m('button.participant-action', {
                        type: 'button',
                        title: `Start a private chat with ${participant.name}`,
                        onclick: (e) => {
                          e.stopPropagation();
                          people.setSelectedId(participant.key, 'chat');
                        },
                      }, [icon('comments'), m('span', 'Chat')]),
                      m('button.participant-action', {
                        type: 'button',
                        title: `Send mail to ${participant.name}`,
                        onclick: (e) => {
                          e.stopPropagation();
                          people.setSelectedId(participant.key, 'details', true);
                        },
                      }, [icon('envelope'), m('span', 'Mail')]),
                      m('button.participant-action', {
                        type: 'button',
                        title: `View details for ${participant.name}`,
                        onclick: (e) => {
                          e.stopPropagation();
                          people.setSelectedId(participant.key, 'details');
                        },
                      }, [icon('user'), m('span', 'Details')]),
                    ]),
                  ]);
                })
              )
            : m('p.no-participants', 'No participant information available'),
        ]),
      ]);
    },
  };
};

const ChatRoomJoinView = () => {
  let ownIds = [];
  let stopWatching;
  return {
    oninit: () => {
      stopWatching = peopleUtil.watchOwnIds((data) => {
        ownIds = data;
        m.redraw();
      });
    },
    onremove: () => stopWatching && stopWatching(),
    view: () => {
      const room = ChatHubState.selectedRoom;
      if (!room) return null;

      const lobbyHexId = rs.idToHex(room.lobby_id);
      const isInvitation = ChatRoomsModel.invitationIds.has(lobbyHexId);
      //  ChatLobbyInvite has no total_number_of_peers -- the field only exists
      //  on the records the nearby-lobby list returns -- so an invited room
      //  would always claim it has nobody in it.
      const participantCount = room.total_number_of_peers || 0;
      const privacy = getLobbyPrivacyInfo(room);

      return m('.chat-room-detail-view', [
        m('.detail-section', [
          m('h3', 'Room Info'),
          m('.info-grid', [
            m('.info-label', 'Room Name'),
            m('.info-value', room.lobby_name || '<unnamed>'),
            m('.info-label', 'Topic'),
            m('.info-value', room.lobby_topic || 'None'),
            m('.info-label', 'Type'),
            m('.info-value', privacy.type),
            m('.info-label', 'Security'),
            m('.info-value', privacy.security),
            m('.info-label', 'Participants'),
            m('.info-value', isInvitation ? 'Unknown until you join' : participantCount + ' users'),
          ]),
        ]),


        m('.detail-section', [
          m('h3', isInvitation ? 'Invitation' : 'Join Room'),
          m('p.join-description', 'Select an identity to join this chat room:'),
          ChatRoomsModel.joiningLobbyId === lobbyHexId &&
            m('p.join-description', [icon('spinner', { spin: true }), ' Joining…']),
          ChatRoomsModel.joinError && m('p.error', ChatRoomsModel.joinError),
          m(
            '.identities-grid',
            ownIds.map((nick) =>
              m(
                '.identity-card',
                {
                  class: ChatRoomsModel.joiningLobbyId === lobbyHexId ? 'disabled' : '',
                  onclick: () => ChatRoomsModel.invitationIds.has(lobbyHexId)
                    ? ChatRoomsModel.acceptInvitation(lobbyHexId, nick)
                    : ChatLobbyModel.enterPublicLobby(lobbyHexId, nick),
                },
                [
                  m('.identity-card__identity', [
                    m(peopleUtil.IdentityAvatar, {
                      identityId: nick,
                      name: rs.userList.username(nick) || nick,
                      size: 36,
                    }),
                    m('.identity-name', rs.userList.username(nick) || nick),
                  ]),
                  icon('sign-in-alt'),
                ]
              )
            )
          ),
          //  Without this an invitation can only be accepted: it stays in the
          //  room list and keeps the Chat badge lit, since invitationCount()
          //  feeds it and nothing else ever clears the entry.
          isInvitation && m(
            'button.chat-invite-decline',
            {
              disabled: ChatRoomsModel.joiningLobbyId === lobbyHexId,
              onclick: () => ChatRoomsModel.declineInvitation(lobbyHexId),
            },
            [icon('times'), ' Decline invitation']
          ),
        ]),
      ]);
    },
  };
};

//  Create-room modal. The submit and the dismiss both reset the form, so they
//  live here rather than inline in the view.
function closeCreateRoomModal() {
  ChatHubState.showCreateRoomModal = false;
  ChatHubState.newRoomName = '';
  ChatHubState.newRoomTopic = '';
  ChatHubState.newRoomSigned = false;
  ChatHubState.createRoomError = '';
}

function createChatRoom() {
  const name = ChatHubState.newRoomName.trim();
  if (!name || !ChatHubState.newRoomIdentity) return;

  //  4 is public, 8 is PGP-signed identities only.
  let flags = 0;
  if (ChatHubState.newRoomPublic) flags |= 4;
  if (ChatHubState.newRoomSigned) flags |= 8;

  rs.rsJsonApiRequest('/rsChats/createChatLobby', {
    lobby_name: name,
    lobby_identity: ChatHubState.newRoomIdentity,
    lobby_topic: ChatHubState.newRoomTopic.trim(),
    invited_friends: [],
    lobby_privacy_type: flags,
  }, (data, success) => {
    if (success) {
      closeCreateRoomModal();
      ChatRoomsModel.loadSubscribedRooms();
    } else {
      ChatHubState.createRoomError = 'Failed to create room. Check parameters.';
    }
    m.redraw();
  });
}

//  Invite modal.
function closeInviteModal() {
  ChatHubState.showInviteModal = false;
  ChatHubState.selectedFriendsToInvite.clear();
}

function inviteSelectedFriends() {
  const lobbyHexId = rs.idToHex(ChatHubState.selectedRoom.lobby_id);
  const invites = [];
  ChatHubState.selectedFriendsToInvite.forEach((friendId) => {
    invites.push(new Promise((resolve) => {
      rs.rsJsonApiRequest('/rsChats/invitePeerToLobby', {
        lobby_id: lobbyHexId,
        peer_id: friendId,
      }, () => resolve());
    }));
  });
  Promise.all(invites).then(() => {
    closeInviteModal();
    m.redraw();
  });
}

const Layout = {
  dismissMenu: () => {
    let redraw = false;
    if (ChatHubState.activeMenu) {
      ChatHubState.activeMenu = null;
      redraw = true;
    }
    if (ChatHubState.messageContextMenu && ChatHubState.messageContextMenu.show) {
      ChatHubState.messageContextMenu.show = false;
      redraw = true;
    }
    if (redraw) m.redraw();
  },
  oninit: () => {
    ChatHubState.activeTab = 'chat';
    const lobbyId = m.route.param('lobby');
    ChatHubState.mobilePane = lobbyId ? 'detail' : 'list';
    if (lobbyId) {
      ChatHubState.selectedRoomId = lobbyId;
      ChatLobbyModel.loadLobby(lobbyId);
    }
    window.addEventListener('click', Layout.dismissMenu);

    peopleUtil.ownIds((ids) => {
      ChatHubState.ownGxsIdentities = ids || [];
      if (ChatHubState.ownGxsIdentities.length > 0) {
        ChatHubState.newRoomIdentity = ChatHubState.ownGxsIdentities[0];
      }
      ChatHubState.ownGxsIdentities.forEach((id) => {
        if (ChatHubState.gxsDetails[id] === undefined) {
          rs.rsJsonApiRequest('/rsIdentity/getIdDetails', { id }, (data) => {
            if (data && data.details) {
              ChatHubState.gxsDetails[id] = data.details;
              m.redraw();
            }
          });
        }
      });
      m.redraw();
    });
  },
  onupdate: () => {
    const lobbyId = m.route.param('lobby');
    if (lobbyId && ChatHubState.selectedRoomId !== lobbyId) {
      ChatHubState.mobilePane = 'detail';
      ChatHubState.selectedRoomId = lobbyId;
      //  Another room, another conversation: it opens on its last message,
      //  whatever the reader had scrolled to in the previous one. The pane
      //  itself is reused rather than recreated, so its oncreate does not run.
      chatStickToBottom = true;
      ChatLobbyModel.loadLobby(lobbyId);
    } else if (!lobbyId) {
      ChatHubState.mobilePane = 'list';
    }
  },
  onremove: () => {
    ChatLobbyModel.stopStatusPolling();
    ChatLobbyModel.stopParticipantPolling();
    window.removeEventListener('click', Layout.dismissMenu);
  },
  view: () => {
    const search = ChatHubState.searchString.toLowerCase();

    const subscribedRooms = sortLobbies(
      Object.values(ChatRoomsModel.subscribedRooms)
    ).filter((info) => (info.lobby_name || '').toLowerCase().includes(search));

    const publicRooms = (ChatRoomsModel.allRooms || [])
      .filter((info) => !ChatRoomsModel.subscribed(info))
      .filter((info) => (info.lobby_name || '').toLowerCase().includes(search));

    const invitedRooms = publicRooms.filter((info) =>
      ChatRoomsModel.invitationIds.has(rs.idToHex(info.lobby_id))
    );
    const discoverableRooms = publicRooms.filter((info) =>
      !ChatRoomsModel.invitationIds.has(rs.idToHex(info.lobby_id))
    );

    const isSelected = (info, type) =>
      ChatHubState.selectedRoomId === rs.idToHex(info.lobby_id);

    const lobbyId = ChatHubState.selectedRoomId;
    let selectedRoom = null;
    let selectedRoomType = null;

    if (lobbyId) {
      if (ChatRoomsModel.subscribedRooms[lobbyId]) {
        selectedRoom = ChatRoomsModel.subscribedRooms[lobbyId];
        selectedRoomType = 'subscribed';
      } else {
        selectedRoom = ChatRoomsModel.allRooms.find(
          (r) => rs.idToHex(r.lobby_id) === lobbyId
        );
        if (selectedRoom) {
          selectedRoomType = 'public';
        } else if (
          ChatLobbyModel.currentLobby &&
          rs.idToHex(ChatLobbyModel.currentLobby.lobby_id || '') === lobbyId
        ) {
          selectedRoom = ChatLobbyModel.currentLobby;
          selectedRoomType = 'subscribed';
        }
      }
    }

    if (selectedRoom) {
      ChatHubState.selectedRoom = selectedRoom;
      ChatHubState.selectedRoomType = selectedRoomType;
    } else if (!m.route.param('lobby')) {
      ChatHubState.selectedRoom = null;
      ChatHubState.selectedRoomId = null;
      ChatHubState.selectedRoomType = null;
    }

    return m('.chat-hub-container' + (ChatHubState.mobilePane === 'detail' ? '.mobile-detail-open' : ''), [
      m('.chat-hub-left-pane', [
        m('.chat-own-profile-card', [
          m('.profile-header', [
            icon('comments'),
            m('.profile-info', [
              m('.profile-name', 'Chat rooms'),
            ]),
          ]),
          m('button.chat-create-room-btn.is-primary', {
            title: 'Create room',
            'aria-label': 'Create room',
            onclick: () => {
              ChatHubState.showCreateRoomModal = true;
            }
          }, [
            icon('plus'),
            m('span.btn-text', 'Create')
          ])
        ]),

        m('.chat-rooms-list-container', [
          m('.searchbar-container', [
            m(widget.SearchField, {
              placeholder: 'Search chat rooms',
              value: ChatHubState.searchString,
              oninput: (e) => {
                ChatHubState.searchString = e.target.value;
              },
              onclear: () => {
                ChatHubState.searchString = '';
              },
            }),
          ]),
          m('.rooms-scroll', [
            subscribedRooms.length > 0 && [
              m('.rooms-section-title', [
                icon('bookmark'),
                m('span', 'Subscribed (' + subscribedRooms.length + ')'),
              ]),
              subscribedRooms.map((info) => {
                const hexId = rs.idToHex(info.lobby_id);
                return m(
                  '.chat-room-list-item' +
                    (isSelected(info, 'subscribed') ? '.selected' : ''),
                  {
                    key: hexId,
                    onclick: () => {
                      ChatHubState.mobilePane = 'detail';
                      m.route.set('/chat/:lobby', { lobby: hexId });
                    },
                  },
                  [
                    m('.room-icon', icon('comments')),
                    m('.room-meta', [
                      m('.room-name', info.lobby_name || '<unnamed>'),
                      m('.room-topic', info.lobby_topic || 'No topic'),
                    ]),
                    (ChatRoomsModel.unreadCount[hexId] || 0) > 0
                      && m('.room-badge', ChatRoomsModel.unreadCount[hexId]),
                  ]
                );
              }),
            ],

            invitedRooms.length > 0 && [
              m('.rooms-section-title.invited-rooms-title', [
                icon('envelope'),
                m('span', 'Invitations (' + invitedRooms.length + ')'),
              ]),
              invitedRooms.map((info) => {
                const hexId = rs.idToHex(info.lobby_id);
                return m(
                  '.chat-room-list-item.public-room.invited-room' +
                    (isSelected(info, 'public') ? '.selected' : ''),
                  {
                    key: hexId,
                    onclick: () => {
                      ChatHubState.mobilePane = 'detail';
                      m.route.set('/chat/:lobby', { lobby: hexId });
                    },
                  },
                  [
                    m('.room-icon', icon('envelope-open-text')),
                    m('.room-meta', [
                      m('.room-name', info.lobby_name || '<unnamed>'),
                      m('.room-topic', info.lobby_topic || 'You were invited to join'),
                    ]),
                    m('.room-badge', { title: 'Chat room invitation' }, '!'),
                  ]
                );
              }),
            ],

            discoverableRooms.length > 0 && [
              m('.rooms-section-title', [
                icon('globe'),
                m('span', 'Public (' + discoverableRooms.length + ')'),
              ]),
              discoverableRooms.map((info) => {
                const hexId = rs.idToHex(info.lobby_id);
                const participantCount = info.total_number_of_peers || 0;
                return m(
                  '.chat-room-list-item.public-room' +
                    (isSelected(info, 'public') ? '.selected' : ''),
                  {
                    key: hexId,
                    onclick: () => {
                      ChatHubState.mobilePane = 'detail';
                      m.route.set('/chat/:lobby', { lobby: hexId });
                    },
                  },
                  [
                    m('.room-icon', icon('globe')),
                    m('.room-meta', [
                      m('.room-name', info.lobby_name || '<unnamed>'),
                      m('.room-topic', info.lobby_topic || 'No topic'),
                    ]),
                    participantCount > 0 && m('.room-badge', {
                      title: `${participantCount} participant${participantCount === 1 ? '' : 's'}`,
                    }, participantCount),
                  ]
                );
              }),
            ],

            subscribedRooms.length === 0 &&
              invitedRooms.length === 0 &&
              discoverableRooms.length === 0 &&
              m('p.no-rooms', 'No chat rooms found'),
          ]),
        ]),
      ]),
      ChatHubState.showCreateRoomModal && m('.attach-modal-overlay', {
        onclick: (e) => { if (e.target === e.currentTarget) closeCreateRoomModal(); },
      }, [
        m('.modal-content.modal--titled', {
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': 'New chat room',
        }, [
          m('button.modal__close[type=button][aria-label=Close]', {
            onclick: closeCreateRoomModal,
          }, icon('times')),

          m('.modal__head', [
            m('h2.modal__title', 'New chat room'),
            m('p.modal__lead', 'A public room is announced to your friends; a private one is invitation only.'),
          ]),

          m('.modal__body', [
            m('form', {
              onsubmit: (e) => { e.preventDefault(); createChatRoom(); },
            }, [
              m('.form-field', [
                m('label[for=new-room-name]', 'Room name'),
                m('input#new-room-name[type=text]', {
                  value: ChatHubState.newRoomName,
                  oninput: (e) => { ChatHubState.newRoomName = e.target.value; },
                  placeholder: 'Enter room name',
                }),
              ]),

              m('.form-field', [
                m('label[for=new-room-topic]', 'Topic'),
                m('input#new-room-topic[type=text]', {
                  value: ChatHubState.newRoomTopic,
                  oninput: (e) => { ChatHubState.newRoomTopic = e.target.value; },
                  placeholder: 'Enter room topic',
                }),
              ]),

              m('.form-field', [
                m('label[for=new-room-identity]', 'Admin identity'),
                m('select#new-room-identity', {
                  value: ChatHubState.newRoomIdentity,
                  onchange: (e) => { ChatHubState.newRoomIdentity = e.target.value; },
                }, [
                  ChatHubState.ownGxsIdentities && ChatHubState.ownGxsIdentities.map((id) => {
                    const details = ChatHubState.gxsDetails[id];
                    const name = details ? (details.mNickname || details.mGroupName) : id;
                    return m('option', { value: id }, name);
                  })
                ]),
              ]),

              m('.form-field.form-field--check', [
                m('input#new-room-public[type=checkbox]', {
                  checked: ChatHubState.newRoomPublic,
                  onclick: (e) => { ChatHubState.newRoomPublic = e.target.checked; },
                }),
                m('label[for=new-room-public]', 'Public room'),
              ]),

              m('.form-field.form-field--check', [
                m('input#new-room-signed[type=checkbox]', {
                  checked: ChatHubState.newRoomSigned,
                  onclick: (e) => { ChatHubState.newRoomSigned = e.target.checked; },
                }),
                m('label[for=new-room-signed]', 'Require PGP-signed identities'),
              ]),

              ChatHubState.createRoomError && m('p.error-text', ChatHubState.createRoomError),

              m('.modal__foot', [
                m('button[type=button]', { onclick: closeCreateRoomModal }, [icon('times'), 'Cancel']),
                m('button.is-primary[type=submit]', {
                  disabled: !ChatHubState.newRoomName.trim() || !ChatHubState.newRoomIdentity,
                }, [icon('plus'), 'Create room']),
              ]),
            ]),
          ]),
        ]),
      ]),
      ChatHubState.showInviteModal && m('.attach-modal-overlay', {
        onclick: (e) => { if (e.target === e.currentTarget) closeInviteModal(); },
      }, [
        m('.modal-content.modal--titled', {
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': 'Invite friends',
        }, [
          m('button.modal__close[type=button][aria-label=Close]', {
            onclick: closeInviteModal,
          }, icon('times')),

          m('.modal__head', [
            m('h2.modal__title', 'Invite friends'),
            m('p.modal__lead', ChatHubState.selectedRoom
              ? `They will be asked to join ${ChatHubState.selectedRoom.lobby_name}.`
              : 'They will be asked to join this room.'),
          ]),

          m('.modal__body', [
            m('.friends-invite-list', [
              ChatHubState.friendsList.length === 0
                ? m('p.friends-invite-empty', 'No friends available')
                : ChatHubState.friendsList.map((friend) => {
                    const isChecked = ChatHubState.selectedFriendsToInvite.has(friend.id);
                    return m('label.friend-invite-item', [
                      m('input[type=checkbox]', {
                        checked: isChecked,
                        onclick: (e) => {
                          if (e.target.checked) {
                            ChatHubState.selectedFriendsToInvite.add(friend.id);
                          } else {
                            ChatHubState.selectedFriendsToInvite.delete(friend.id);
                          }
                        },
                      }),
                      m('span.status-bullet', { class: friend.online ? 'is-online' : 'is-offline' }),
                      m('span.friend-invite-name', friend.name),
                    ]);
                  })
            ]),

            m('.modal__foot', [
              m('button[type=button]', { onclick: closeInviteModal }, [icon('times'), 'Cancel']),
              m('button.is-primary[type=button]', {
                disabled: ChatHubState.selectedFriendsToInvite.size === 0,
                onclick: inviteSelectedFriends,
              }, [icon('user-plus'), 'Send invitations']),
            ]),
          ]),
        ]),
      ]),

      m('.chat-hub-right-pane', [
        ChatHubState.selectedRoom
          ? [
              m(ChatRoomHeader, {
                room: ChatHubState.selectedRoom,
                hideActions: ChatHubState.selectedRoomType !== 'subscribed',
                onBack: () => {
                  ChatHubState.mobilePane = 'list';
                  m.route.set('/chat');
                },
              }),
              ChatHubState.selectedRoomType === 'subscribed'
                ? [
                    //  Two tabs where one of them is the whole point of the
                    //  screen: the conversation is the room, and Details is a
                    //  thing you go and look at. It is a header button now, so
                    //  the chat opens with nothing above it.
                    m('.chat-hub-tab-content' + (ChatHubState.activeTab === 'details' ? '.details-content' : ''), [
                      ChatHubState.activeTab === 'chat'
                        ? m(ChatConversationView)
                        : m(ChatRoomDetailView),
                    ]),
                  ]
                : [
                    m('.chat-hub-tab-content.details-content', m(ChatRoomJoinView)),
                  ],
            ]
          : m('.chat-pane-placeholder', [
              icon('comments'),
              m(
                'p',
                'Select a chat room from the left panel to view details or join a conversation.'
              ),
            ]),
        ]),
      ChatHubState.messageContextMenu.show && m('.chat-msg-context-menu', {
        style: {
          top: `${Math.max(8, Math.min(ChatHubState.messageContextMenu.y, window.innerHeight - 132))}px`,
          left: `${Math.max(8, Math.min(ChatHubState.messageContextMenu.x, window.innerWidth - 228))}px`,
        },
        onclick: (e) => e.stopPropagation(),
      }, [
        m('.context-menu-item', {
          onclick: () => {
            const { username, messageText } = ChatHubState.messageContextMenu;
            const quoteHeader = `> [${username}]: ${messageText}\n`;
            const roomId = ChatHubState.selectedRoomId;
            const draft = ChatHubState.drafts[roomId] || '';
            ChatHubState.drafts[roomId] = (draft ? draft.trim() + '\n' : '') + quoteHeader;
            const field = document.querySelector('.chat-composer__field');
            if (field) field.focus();
            ChatHubState.messageContextMenu.show = false;
            m.redraw();
          },
        }, [
          icon('quote-right'),
          'Quote Message'
        ]),
        ChatHubState.messageContextMenu.gxsId &&
          ChatHubState.messageContextMenu.gxsId !== '00000000000000000000000000000000' &&
          m('.context-menu-item', {
            onclick: () => {
              const { gxsId } = ChatHubState.messageContextMenu;
              const peopleState = require('people/people_state');
              peopleState.State.selectedId = gxsId;
              peopleState.State.activeFilter = 'all';
              peopleState.fetchIdDetails(gxsId);
              ChatHubState.messageContextMenu.show = false;
              m.route.set('/people/All');
            },
          }, [
            icon('user-circle'),
            'Show Author in People'
          ]),
        m('.context-menu-item', {
          onclick: () => {
            const { messageText } = ChatHubState.messageContextMenu;
            navigator.clipboard.writeText(messageText);
            ChatHubState.messageContextMenu.show = false;
            m.redraw();
          },
        }, [
          icon('copy'),
          'Copy Text'
        ]),
      ])
    ]);
  },
};

/*
    /rsChats/initiateDistantChatConnexion
   * @param[in] to_pid RsGxsId to start the connection
   * @param[in] from_pid owned RsGxsId who start the connection
   * @param[out] pid distant chat id
   * @param[out] error_code if the connection can't be stablished
   * @param[in] notify notify remote that the connection is stablished
*/
const LayoutCreateDistant = () => {
  let ownIds = [];
  let stopWatching;
  return {
    oninit: () => {
      stopWatching = peopleUtil.watchOwnIds((data) => {
        ownIds = data;
        m.redraw();
      });
    },
    onremove: () => stopWatching && stopWatching(),
    view: (vnode) =>
      m('.node-panel.chat-panel.chat-room', [
        m('.createDistantChat', [
          'choose identitiy to chat with ',
          rs.userList.username(m.route.param('lobby')),
          ownIds.map((id) =>
            m(
              '.identity',
              {
                onclick: () =>
                  rs.rsJsonApiRequest(
                    '/rsChats/initiateDistantChatConnexion',
                    {
                      to_pid: m.route.param('lobby'),
                      from_pid: id,
                      notify: true,
                    },
                    (res) => {
                      m.route.set('/chat/:lobby', { lobby: rs.idToHex(res.pid) });
                    }
                  ),
              },
              rs.userList.username(id)
            )
          ),
        ]),
      ]),
  };
};

module.exports = {
  oninit: () => {
    ChatRoomsModel.loadSubscribedRooms();
    loadOwnChatProfile();
  },
  view: (vnode) => {
    if (m.route.param('subaction') === 'createdistantchat') {
      return m(LayoutCreateDistant);
    } else {
      return m(Layout);
    }
  },
};
