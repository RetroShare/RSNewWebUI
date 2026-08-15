const m = require('mithril');
const rs = require('rswebui');
const peopleUtil = require('people/people_util');
const people = require('people/people');
const chatState = require('chat/chat_state');
const chatEmoji = require('chat/chat_emoji');
const HistoryBrowserModal = require('people/people_history');

const {
  sortLobbies,
  getStatusColor,
  getStatusTooltip,
  getSafeAvatar,
  ChatRoomsModel,
  ChatLobbyModel,
  ChatHubState,
} = chatState;

chatEmoji.setDependencies({ ChatHubState });

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
        callback(`<img src="${dataUrl}" />`);
      } else {
        alert('Image file is too large to send over RetroShare chat packet size limit.');
        callback(null);
      }
    };
    img.onerror = () => {
      callback(null);
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

function renderUserTooltip(gxsId, name) {
  const details = ChatHubState.gxsDetails[gxsId];
  if (!details) return null;

  const avatar = getSafeAvatar(details);
  const firstLetter = (name || '?').slice(0, 1).toUpperCase();
  const votes = details.mReputation
    ? (details.mReputation.mFriendsPositiveVotes - details.mReputation.mFriendsNegativeVotes)
    : 0;

  const rect = ChatHubState.hoveredUser ? ChatHubState.hoveredUser.rect : null;
  const tooltipWidth = 280;
  const tooltipGap = 10;
  let left = rect ? rect.left - tooltipWidth - tooltipGap : window.innerWidth - tooltipWidth - tooltipGap;
  if (left < tooltipGap && rect) left = rect.right + tooltipGap;
  let top = rect ? rect.top : 100;
  if (top + 160 > window.innerHeight) top = window.innerHeight - 170;
  if (top < 10) top = 10;

  return m('.user-tooltip', {
    style: {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 10000,
    }
  }, [
    m('.tooltip-avatar', m(peopleUtil.UserAvatar, { avatar, firstLetter, identityId: gxsId, size: 56, isSquare: true })),
    m('.tooltip-details', [
      m('.tooltip-row', [m('span.tooltip-label', 'Identity name: '), m('span.tooltip-value', name)]),
      m('.tooltip-row', [m('span.tooltip-label', 'Identity Id: '), m('span.tooltip-value.tooltip-id', gxsId)]),
      details.mPgpId && details.mPgpId !== '0000000000000000' && m('.tooltip-row', [
        m('span.tooltip-label', 'Node: '),
        m('span.tooltip-value', `${rs.userList.username(details.mPgpId) || name} [${details.mPgpId}]`)
      ]),
      m('.tooltip-row', [
        m('span.tooltip-label', 'Votes: '),
        m('span.tooltip-value', {
          style: {
            color: votes >= 0 ? '#008000' : '#cc0000',
            fontWeight: 'bold'
          }
        }, (votes >= 0 ? '+' : '') + votes)
      ])
    ])
  ]);
}

function pollHashStatus(localpath) {
  rs.rsJsonApiRequest('/rsFiles/ExtraFileStatus', { localpath }, (data) => {
    if (data && data.retval && data.info && data.info.hash && data.info.hash !== '0000000000000000000000000000000000000000') {
      const info = data.info;
      const sizeNum = info.size.xint64 || parseInt(info.size.xstr64) || info.size;
      const fileLink = `<a href="retroshare://file?name=${encodeURIComponent(info.name)}&size=${sizeNum}&hash=${info.hash}">${info.name}</a> (${rs.formatBytes(sizeNum)})`;

      const textarea = document.querySelector('.chat-hub-textarea');
      if (textarea) {
        const val = textarea.value;
        textarea.value = val ? val + '\n' + fileLink : fileLink;
      }

      ChatHubState.showAttachModal = false;
      ChatHubState.isHashing = false;
      ChatHubState.attachPath = '';
      m.redraw();
    } else {
      if (ChatHubState.isHashing) {
        setTimeout(() => pollHashStatus(localpath), 1000);
      }
    }
  });
}

// ************************* views ****************************

// ************************* Chat Hub Sub-Components ****************************

const ChatRoomHeader = () => {
  return {
    view: (vnode) => {
      const room = vnode.attrs.room;
      const lobbyHexId = rs.idToHex(room.lobby_id);
      const isDistant = room.chatType === 2;
      return m('.chat-hub-header-bar', [
        m('.chat-header-info', [
          m('.chat-header-name-container', { style: 'display: flex; align-items: center; gap: 0.5rem;' }, [
            m('.chat-header-name', room.lobby_name || '<unnamed>'),
            isDistant && m('i.fas.fa-circle', {
              style: {
                color: getStatusColor(ChatLobbyModel.distantChatStatus ? ChatLobbyModel.distantChatStatus.status : 0),
                fontSize: '0.85rem',
                transition: 'color 0.3s ease',
              },
              title: getStatusTooltip(ChatLobbyModel.distantChatStatus ? ChatLobbyModel.distantChatStatus.status : 0),
            })
          ]),
          m('.chat-header-topic', room.lobby_topic || 'No topic'),
        ]),
        m('.chat-header-actions', [
          isDistant
            ? [
                m(
                  'button.blue',
                  {
                    title: 'View distant chat history',
                    style: 'margin-right: 0.75rem;',
                    onclick: () => {
                      ChatHubState.showHistoryModal = true;
                    }
                  },
                  [m('i.fas.fa-history'), ' History']
                ),
                m(
                  'button.red',
                  {
                    title: 'Leave Distant Chat',
                    onclick: () => {
                      if (confirm('Are you sure you want to leave this distant chat conversation?')) {
                        rs.rsJsonApiRequest(
                          '/rsChats/closeDistantChatConnexion',
                          {
                            pid: lobbyHexId,
                          },
                          (data, success) => {
                            if (success) {
                              ChatLobbyModel.stopStatusPolling();
                              ChatHubState.selectedRoom = null;
                              ChatHubState.selectedRoomId = null;
                              ChatHubState.selectedRoomType = null;
                              m.route.set('/chat');
                            }
                          }
                        );
                      }
                    },
                  },
                  [m('i.fas.fa-sign-out-alt'), ' Leave Chat']
                )
              ]
            : [
                m(
                  'button',
                  {
                    title: 'Invite friends to this room',
                    style: 'margin-right: 0.75rem;',
                    onclick: () => {
                      ChatHubState.showInviteModal = true;
                      loadFriendsForInvite();
                    }
                  },
                  [m('i.fas.fa-user-plus'), ' Invite']
                ),
                m(
                  'button.blue',
                  {
                    title: 'View chat room history',
                    style: 'margin-right: 0.75rem;',
                    onclick: () => {
                      ChatHubState.showHistoryModal = true;
                    }
                  },
                  [m('i.fas.fa-history'), ' History']
                ),
                m(
                  'button.red',
                  {
                    title: 'Leave Room',
                    onclick: () => {
                      ChatLobbyModel.unsubscribeChatLobby(lobbyHexId, () => {
                        ChatHubState.selectedRoom = null;
                        ChatHubState.selectedRoomId = null;
                        ChatHubState.selectedRoomType = null;
                        m.route.set('/chat');
                      });
                    },
                  },
                  [m('i.fas.fa-sign-out-alt'), ' Leave']
                )
              ],
        ]),
      ]);
    },
  };
};

const ChatConversationView = () => {
  function onDocClick(e) {
    if (ChatHubState.showEmojiPicker && !e.target.closest('.emoji-picker-wrapper')) {
      ChatHubState.showEmojiPicker = false;
      m.redraw();
    }
  }
  return {
    oninit: () => {
      scrollChatToBottom();
    },
    oncreate: () => {
      document.addEventListener('click', onDocClick, true);
    },
    onremove: () => {
      document.removeEventListener('click', onDocClick, true);
    },
    view: () => {
      const chatType = ChatLobbyModel.currentLobby && ChatLobbyModel.currentLobby.chatType;
      const isRoom = chatType === 3;
      const isDistant = chatType === 2;
      const canTalk = !isDistant || (ChatLobbyModel.distantChatStatus && ChatLobbyModel.distantChatStatus.status === 2);
      return m('.chat-hub-conversation-layout', [
        m('.chat-hub-conversation-main', [
          m(
            '.chat-hub-messages' + (isRoom ? '.compact-container' : ''),
            {
              oncreate: () => scrollChatToBottom(),
              onupdate: () => scrollChatToBottom(),
            },
            ChatLobbyModel.messages
          ),
          m(
            '.chat-hub-input-area',
            [
              m(
                'button.chat-hub-action-btn',
                {
                  disabled: !canTalk,
                  style: !canTalk ? 'opacity: 0.5; cursor: not-allowed;' : '',
                  title: 'Attach file',
                  onclick: () => {
                    ChatHubState.showAttachModal = true;
                    ChatHubState.showEmojiPicker = false;
                  }
                },
                m('i.fas.fa-paperclip')
              ),
              m('.emoji-picker-wrapper', [
                m(
                  'button.chat-hub-action-btn',
                  {
                    disabled: !canTalk,
                    style: !canTalk ? 'opacity: 0.5; cursor: not-allowed;' : '',
                    title: 'Insert emoji',
                    onclick: (e) => {
                      e.stopPropagation();
                      ChatHubState.showEmojiPicker = !ChatHubState.showEmojiPicker;
                    },
                  },
                  m('i.fas.fa-smile')
                ),
                ChatHubState.showEmojiPicker && m(chatEmoji.EmojiPicker),
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
                    const textarea = e.target.closest('.chat-hub-input-area').querySelector('textarea');
                    formatChatImage(file, (imgTag) => {
                      if (imgTag && textarea) {
                        const start = textarea.selectionStart || 0;
                        const end = textarea.selectionEnd || 0;
                        const val = textarea.value;
                        textarea.value = val.substring(0, start) + imgTag + val.substring(end);
                        m.redraw();
                      }
                    });
                    e.target.value = '';
                  }
                })
              ]),
              m('textarea.chat-hub-textarea', {
                placeholder: 'Type a message...',
                disabled: !canTalk,
                enterkeyhint: 'send',
                onpaste: (e) => {
                  if (!canTalk) return;
                  const items = (e.clipboardData || (e.originalEvent && e.originalEvent.clipboardData))?.items;
                  if (!items) return;
                  for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                      e.preventDefault();
                      const blob = items[i].getAsFile();
                      const textarea = e.target;
                      formatChatImage(blob, (imgTag) => {
                        if (imgTag && textarea) {
                          const start = textarea.selectionStart || 0;
                          const end = textarea.selectionEnd || 0;
                          const val = textarea.value;
                          textarea.value = val.substring(0, start) + imgTag + val.substring(end);
                          m.redraw();
                        }
                      });
                      break;
                    }
                  }
                },
                onkeydown: (e) => {
                  if ((e.key === 'Enter' || e.keyCode === 13) && !e.shiftKey) {
                    if (!canTalk) return false;
                    const msg = e.target.value;
                    if (msg.trim() === '') return false;
                    e.target.value = ' sending ... ';
                    ChatLobbyModel.sendMessage(msg, () => {
                      e.target.value = '';
                      scrollChatToBottom();
                    });
                    return false;
                  }
                },
              }),
              m(
                'button.chat-hub-send-btn',
                {
                  disabled: !canTalk,
                  style: !canTalk ? 'opacity: 0.5; cursor: not-allowed;' : '',
                  onclick: (e) => {
                    if (!canTalk) return;
                    const textarea = e.target.closest('.chat-hub-input-area').querySelector('textarea');
                    const msg = textarea.value;
                    if (msg.trim() === '') return;
                    textarea.value = ' sending ... ';
                    ChatLobbyModel.sendMessage(msg, () => {
                      textarea.value = '';
                      scrollChatToBottom();
                    });
                  },
                },
                m('i.fas.fa-paper-plane')
              ),
            ]
          ),
          ChatHubState.showAttachModal && m('.attach-modal-overlay', {
            onclick: (e) => {
              if (e.target === e.currentTarget && !ChatHubState.isHashing) {
                ChatHubState.showAttachModal = false;
                ChatHubState.attachPath = '';
                ChatHubState.attachBrowseHint = false;
                ChatHubState.hashingError = '';
              }
            }
          }, [
            m('.attach-modal', [
              m('.attach-modal-header', [
                m('i.fas.fa-paperclip.attach-modal-icon'),
                m('h4', 'Attach File to Chat'),
              ]),
              m('p', 'Browse for a file or type the absolute path on your local system:'),
              m('input#attach-file-picker[type=file]', {
                style: 'display:none',
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
                  [m('i.fas.fa-folder-open'), m('span', ' Browse…')]
                ),
              ]),
              ChatHubState.attachBrowseHint && m('.attach-path-hint', [
                m('i.fas.fa-info-circle'),
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
                m('i.fas.fa-spinner.fa-spin'),
                m('span', ' Hashing file... Please wait.')
              ]),
              !ChatHubState.attachBrowseHint && ChatHubState.hashingError && m('p.error-text', ChatHubState.hashingError),
              m('.modal-buttons', [
                m('button.btn.blue', {
                  disabled: ChatHubState.isHashing || !ChatHubState.attachPath.trim() || ChatHubState.attachBrowseHint,
                  onclick: () => {
                    const path = ChatHubState.attachPath.trim();
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
                }, [m('i.fas.fa-link'), m('span', ' Attach')]),
                m('button.btn.red', {
                  disabled: ChatHubState.isHashing,
                  onclick: () => {
                    ChatHubState.showAttachModal = false;
                    ChatHubState.attachPath = '';
                    ChatHubState.attachBrowseHint = false;
                    ChatHubState.hashingError = '';
                  }
                }, 'Cancel')
              ])
            ])
          ]),
          m(HistoryBrowserModal, { isRoom: true }),
        ]),
        m('.chat-hub-rightbar', [
          m('.rightbar-title', 'Participants'),
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

              let statusColor = '#22c55e';
              let statusTooltip = 'Active';

              if (isMuted) {
                statusColor = '#ef4444';
                statusTooltip = 'Muted';
              } else if (isOwn) {
                statusColor = '#3ba4d7';
                statusTooltip = 'You';
              } else if (tLastAct + 600 < now) {
                statusColor = '#cbd5e1';
                statusTooltip = 'Inactive';
              } else if (tLastAct + 300 < now) {
                statusColor = '#eab308';
                statusTooltip = 'Away';
              }

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
                  ChatHubState.activeMenu = null;
                  m.redraw();
                },
                oncontextmenu: (e) => {
                  e.preventDefault();
                  e.stopPropagation();
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
                }
              }, [
                m(peopleUtil.UserAvatar, { avatar, firstLetter, identityId: gxsId, size: 32 }),
                m('span.user-name', name),
                (() => {
                  if (isBanned) {
                    return m('i.fas.fa-ban', {
                      style: {
                        color: '#ef4444',
                        fontSize: '0.85rem',
                        marginLeft: 'auto',
                        flexShrink: 0,
                      },
                      title: 'Banned'
                    });
                  }
                  if (isMuted) {
                    return m('i.fas.fa-volume-mute', {
                      style: {
                        color: '#ef4444',
                        fontSize: '0.85rem',
                        marginLeft: 'auto',
                        flexShrink: 0,
                      },
                      title: 'Muted'
                    });
                  }
                  if (statusColor !== '#22c55e') {
                    return m('i.fas.fa-circle', {
                      style: {
                        color: statusColor,
                        fontSize: '0.65rem',
                        marginLeft: 'auto',
                        flexShrink: 0,
                        transition: 'color 0.3s ease',
                      },
                      title: statusTooltip
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
                style: {
                  position: 'fixed',
                  inset: 0,
                  zIndex: 9998,
                },
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
                m('i.fas.fa-circle', {
                  style: {
                    color: '#000',
                    marginRight: '0.5rem',
                    fontSize: '0.4rem',
                    width: '18px',
                    textAlign: 'center',
                    visibility: ChatHubState.userSortMethod === 'activity' ? 'visible' : 'hidden'
                  }
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
                m('i.fas.fa-circle', {
                  style: {
                    color: '#000',
                    marginRight: '0.5rem',
                    fontSize: '0.4rem',
                    width: '18px',
                    textAlign: 'center',
                    visibility: ChatHubState.userSortMethod === 'name' ? 'visible' : 'hidden'
                  }
                }),
                'Sort by Name'
              ]),
              m('hr', { style: 'margin: 0.25rem 0; border: none; border-top: 1px solid #e2e8f0;' }),
              !isOwn && m('.menu-item', {
                onclick: () => {
                  ChatHubState.activeMenu = null;
                  people.setSelectedId(menu.gxsId, 'chat');
                }
              }, [
                m('i.fas.fa-comments', { style: 'color: #3b82f6; margin-right: 0.5rem; width: 18px; text-align: center;' }),
                'Start private chat'
              ]),
              !isOwn && m('.menu-item', {
                onclick: () => {
                  ChatHubState.activeMenu = null;
                  people.setSelectedId(menu.gxsId, 'details', true);
                }
              }, [
                m('i.fas.fa-envelope', { style: 'color: #10b981; margin-right: 0.5rem; width: 18px; text-align: center;' }),
                'Send Message'
              ]),
              !isOwn && m('hr', { style: 'margin: 0.25rem 0; border: none; border-top: 1px solid #e2e8f0;' }),
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
                m('i', {
                  class: isMuted ? 'fas fa-volume-up' : 'fas fa-volume-mute',
                  style: {
                    color: isMuted ? '#22c55e' : '#ef4444',
                    marginRight: '0.5rem',
                    fontSize: '0.95rem',
                    width: '18px',
                    textAlign: 'center'
                  }
                }),
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
                m('span', { style: 'background-color: #22c55e; border-radius: 50%; width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; margin-right: 0.5rem; font-size: 0.7rem; color: #ffffff;' }, m('i.fas.fa-thumbs-up')),
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
                m('span', { style: 'background-color: #f59e0b; border-radius: 50%; width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; margin-right: 0.5rem; font-size: 0.7rem; color: #ffffff;' }, m('i.fas.fa-hand-paper')),
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
                m('span', { style: 'background-color: #ef4444; border-radius: 50%; width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; margin-right: 0.5rem; font-size: 0.7rem; color: #ffffff;' }, m('i.fas.fa-thumbs-down')),
                'Ban this person (Sets negative opinion)'
              ]),
              m('.menu-item', {
                onclick: () => {
                  ChatHubState.activeMenu = null;
                  people.setSelectedId(menu.gxsId, 'details');
                }
              }, [
                m('i.fas.fa-user', { style: 'color: #8b5cf6; margin-right: 0.5rem; width: 18px; text-align: center;' }),
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
      const participantNames = participants.map((p) => p.name).sort((a, b) => a.localeCompare(b));

      const lobbyHexId = rs.idToHex(room.lobby_id);
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
            m('.info-value', participantCount + ' users'),
            m('.info-label', 'Your Identity'),
            m('.info-value', rs.userList.username(room.gxs_id) || room.gxs_id || '???'),
            m('.info-label', 'Lobby ID'),
            m('.info-value', lobbyHexId),
          ]),
        ]),

        m('.detail-section', [
          m('h3', 'Participants (' + participantCount + ')'),
          participantNames.length > 0
            ? m(
                '.participants-grid',
                participantNames.map((name) =>
                  m('.participant-card', m('.participant-name', name))
                )
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
            m('.info-value', participantCount + ' users'),
          ]),
        ]),


        m('.detail-section', [
          m('h3', 'Join Room'),
          m('p.join-description', 'Select an identity to join this chat room:'),
          m(
            '.identities-grid',
            ownIds.map((nick) =>
              m(
                '.identity-card',
                { onclick: () => ChatLobbyModel.enterPublicLobby(lobbyHexId, nick) },
                [
                  m('.identity-name', rs.userList.username(nick) || nick),
                  m('i.fas.fa-sign-in-alt'),
                ]
              )
            )
          ),
        ]),
      ]);
    },
  };
};

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
      ChatLobbyModel.loadLobby(lobbyId);
    } else if (!lobbyId) {
      ChatHubState.mobilePane = 'list';
    }
  },
  onremove: () => {
    ChatLobbyModel.stopStatusPolling();
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
            m('i.fas.fa-comments', { style: { fontSize: '1.5rem', color: '#3ba4d7' } }),
            m('.profile-info', [
              m('.profile-name', 'Chat rooms'),
            ]),
          ]),
          m('button.chat-create-lobby-btn', {
            onclick: () => {
              ChatHubState.showCreateRoomModal = true;
            }
          }, [
            m('i.fas.fa-plus'),
            ' Create'
          ])
        ]),

        m('.chat-rooms-list-container', [
          m('.searchbar-container', [
            m('input.searchbar', {
              type: 'text',
              placeholder: 'Search chat rooms...',
              value: ChatHubState.searchString,
              oninput: (e) => {
                ChatHubState.searchString = e.target.value;
              },
            }),
          ]),
          m('.rooms-scroll', [
            subscribedRooms.length > 0 && [
              m('.rooms-section-title', [
                m('i.fas.fa-bookmark'),
                m('span', 'Subscribed (' + subscribedRooms.length + ')'),
              ]),
              subscribedRooms.map((info) => {
                const hexId = rs.idToHex(info.lobby_id);
                let count = 0;
                let hasOwn = false;
                if (info.gxs_ids) {
                  if (Array.isArray(info.gxs_ids)) {
                    count = info.gxs_ids.length;
                    hasOwn = info.gxs_ids.some((u) => u.key === info.gxs_id);
                  } else if (typeof info.gxs_ids === 'object') {
                    count = Object.keys(info.gxs_ids).length;
                    hasOwn = info.gxs_ids[info.gxs_id] !== undefined;
                  }
                }
                if (!hasOwn && info.gxs_id && info.gxs_id !== '00000000000000000000000000000000') {
                  count++;
                }
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
                    m('.room-icon', m('i.fas.fa-comments')),
                    m('.room-meta', [
                      m('.room-name', info.lobby_name || '<unnamed>'),
                      m('.room-topic', info.lobby_topic || 'No topic'),
                    ]),
                    count > 0 && m('.room-badge', count),
                  ]
                );
              }),
            ],

            publicRooms.length > 0 && [
              m('.rooms-section-title', [
                m('i.fas.fa-globe'),
                m('span', 'Public (' + publicRooms.length + ')'),
              ]),
              publicRooms.map((info) => {
                const hexId = rs.idToHex(info.lobby_id);
                const count = info.total_number_of_peers || 0;
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
                    m('.room-icon', m('i.fas.fa-globe')),
                    m('.room-meta', [
                      m('.room-name', info.lobby_name || '<unnamed>'),
                      m('.room-topic', info.lobby_topic || 'No topic'),
                    ]),
                    count > 0 && m('.room-badge', count),
                  ]
                );
              }),
            ],

            subscribedRooms.length === 0 &&
              publicRooms.length === 0 &&
              m('p.no-rooms', 'No chat rooms found'),
          ]),
        ]),
      ]),
      ChatHubState.showCreateRoomModal && m('.attach-modal-overlay', [
        m('.attach-modal', [
          m('h4', 'Create New Chat Room'),

          m('.form-field', { style: 'display: flex; flex-direction: column; gap: 0.25rem;' }, [
            m('label', { style: 'font-weight: bold; font-size: 0.9rem; color: #475569;' }, 'Room Name:'),
            m('input[type=text]', {
              value: ChatHubState.newRoomName,
              oninput: (e) => { ChatHubState.newRoomName = e.target.value; },
              placeholder: 'Enter room name',
              style: 'padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.25rem; font-size: 0.9rem;'
            })
          ]),

          m('.form-field', { style: 'display: flex; flex-direction: column; gap: 0.25rem; margin-top: 0.5rem;' }, [
            m('label', { style: 'font-weight: bold; font-size: 0.9rem; color: #475569;' }, 'Topic:'),
            m('input[type=text]', {
              value: ChatHubState.newRoomTopic,
              oninput: (e) => { ChatHubState.newRoomTopic = e.target.value; },
              placeholder: 'Enter room topic',
              style: 'padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.25rem; font-size: 0.9rem;'
            })
          ]),

          m('.form-field', { style: 'display: flex; flex-direction: column; gap: 0.25rem; margin-top: 0.5rem;' }, [
            m('label', { style: 'font-weight: bold; font-size: 0.9rem; color: #475569;' }, 'Admin Identity:'),
            m('select', {
              value: ChatHubState.newRoomIdentity,
              onchange: (e) => { ChatHubState.newRoomIdentity = e.target.value; },
              style: 'padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.25rem; font-size: 0.9rem; background-color: #ffffff;'
            }, [
              ChatHubState.ownGxsIdentities && ChatHubState.ownGxsIdentities.map((id) => {
                const details = ChatHubState.gxsDetails[id];
                const name = details ? (details.mNickname || details.mGroupName) : id;
                return m('option', { value: id }, name);
              })
            ])
          ]),

          m('.form-field', { style: 'display: flex; gap: 0.5rem; align-items: center; margin-top: 0.75rem;' }, [
            m('label', { style: 'display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: #475569; cursor: pointer; user-select: none;' }, [
              m('input[type=checkbox]', {
                checked: ChatHubState.newRoomPublic,
                onclick: (e) => { ChatHubState.newRoomPublic = e.target.checked; }
              }),
              'Public Room'
            ])
          ]),

          m('.form-field', { style: 'display: flex; gap: 0.5rem; align-items: center; margin-top: 0.5rem;' }, [
            m('label', { style: 'display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: #475569; cursor: pointer; user-select: none;' }, [
              m('input[type=checkbox]', {
                checked: ChatHubState.newRoomSigned,
                onclick: (e) => { ChatHubState.newRoomSigned = e.target.checked; }
              }),
              'PGP signed identities'
            ])
          ]),

          ChatHubState.createRoomError && m('p.error-text', { style: 'color: #ef4444; font-size: 0.85rem; margin: 0.5rem 0 0 0;' }, ChatHubState.createRoomError),

          m('.modal-buttons', { style: 'display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem;' }, [
            m('button', {
              disabled: !ChatHubState.newRoomName.trim() || !ChatHubState.newRoomIdentity,
              onclick: () => {
                const name = ChatHubState.newRoomName.trim();
                const topic = ChatHubState.newRoomTopic.trim();
                const identity = ChatHubState.newRoomIdentity;
                const isPublic = ChatHubState.newRoomPublic;
                const isSigned = ChatHubState.newRoomSigned;
                let flags = 0;
                if (isPublic) flags |= 4;
                if (isSigned) flags |= 8;

                rs.rsJsonApiRequest('/rsChats/createChatLobby', {
                  lobby_name: name,
                  lobby_identity: identity,
                  lobby_topic: topic,
                  invited_friends: [],
                  lobby_privacy_type: flags
                }, (data, success) => {
                  if (success) {
                    ChatHubState.showCreateRoomModal = false;
                    ChatHubState.newRoomName = '';
                    ChatHubState.newRoomTopic = '';
                    ChatHubState.newRoomSigned = false;
                    ChatHubState.createRoomError = '';
                    ChatRoomsModel.loadSubscribedRooms();
                    m.redraw();
                  } else {
                    ChatHubState.createRoomError = 'Failed to create room. Check parameters.';
                    m.redraw();
                  }
                });
              }
            }, 'Create'),
            m('button.red', {
              onclick: () => {
                ChatHubState.showCreateRoomModal = false;
                ChatHubState.newRoomName = '';
                ChatHubState.newRoomTopic = '';
                ChatHubState.newRoomSigned = false;
                ChatHubState.createRoomError = '';
              }
            }, 'Cancel')
          ])
        ])
      ]),
      ChatHubState.showInviteModal && m('.attach-modal-overlay', [
        m('.attach-modal', { style: 'max-width: 450px;' }, [
          m('h4', 'Invite Friends to ' + (ChatHubState.selectedRoom ? ChatHubState.selectedRoom.lobby_name : '')),
          m('.friends-invite-list', { style: 'max-height: 250px; overflow-y: auto; margin-top: 1rem; border: 1px solid #e2e8f0; border-radius: 0.375rem; padding: 0.5rem;' }, [
            ChatHubState.friendsList.length === 0
              ? m('p', { style: 'text-align: center; color: #64748b; font-style: italic; margin: 1rem 0;' }, 'No friends available')
              : ChatHubState.friendsList.map((friend) => {
                  const isChecked = ChatHubState.selectedFriendsToInvite.has(friend.id);
                  return m('.friend-invite-item', {
                    style: 'display: flex; align-items: center; justify-content: space-between; padding: 0.5rem; border-bottom: 1px solid #f1f5f9; cursor: pointer;',
                    onclick: () => {
                      if (isChecked) {
                        ChatHubState.selectedFriendsToInvite.delete(friend.id);
                      } else {
                        ChatHubState.selectedFriendsToInvite.add(friend.id);
                      }
                    }
                  }, [
                    m('div', { style: 'display: flex; align-items: center; gap: 0.5rem;' }, [
                      m('.status-bullet', { style: { backgroundColor: friend.online ? '#22c55e' : '#94a3b8', width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' } }),
                      m('span', { style: 'font-weight: 500;' }, friend.name)
                    ]),
                    m('input[type=checkbox]', {
                      checked: isChecked,
                      onclick: (e) => {
                        e.stopPropagation();
                        if (e.target.checked) {
                          ChatHubState.selectedFriendsToInvite.add(friend.id);
                        } else {
                          ChatHubState.selectedFriendsToInvite.delete(friend.id);
                        }
                      }
                    })
                  ]);
                })
          ]),
          m('.modal-buttons', { style: 'display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem;' }, [
            m('button.blue', {
              disabled: ChatHubState.selectedFriendsToInvite.size === 0,
              onclick: () => {
                const lobbyHexId = rs.idToHex(ChatHubState.selectedRoom.lobby_id);
                const invitePromises = [];
                ChatHubState.selectedFriendsToInvite.forEach((friendId) => {
                  invitePromises.push(
                    new Promise((resolve) => {
                      rs.rsJsonApiRequest('/rsChats/invitePeerToLobby', {
                        lobby_id: lobbyHexId,
                        peer_id: friendId
                      }, () => resolve());
                    })
                  );
                });
                Promise.all(invitePromises).then(() => {
                  ChatHubState.showInviteModal = false;
                  ChatHubState.selectedFriendsToInvite.clear();
                  m.redraw();
                });
              }
            }, 'Invite'),
            m('button.red', {
              onclick: () => {
                ChatHubState.showInviteModal = false;
                ChatHubState.selectedFriendsToInvite.clear();
              }
            }, 'Cancel')
          ])
        ])
      ]),

      m('.chat-hub-right-pane', [
        m('.mobile-pane-header', [
          m('button.mobile-back-button', {
            type: 'button',
            onclick: () => {
              ChatHubState.mobilePane = 'list';
              m.route.set('/chat');
            },
          }, [m('i.fas.fa-chevron-left'), ' Chats']),
          m('strong', ChatHubState.selectedRoom ? (ChatHubState.selectedRoom.lobby_name || 'Conversation') : 'Conversation'),
        ]),
        ChatHubState.selectedRoom
          ? [
              ChatHubState.selectedRoomType === 'subscribed'
                ? [
                    m(ChatRoomHeader, { room: ChatHubState.selectedRoom }),
                    m('.chat-hub-tabs-container', [
                      m('.chat-hub-tabs', [
                        m(
                          'button.tab-btn' +
                            (ChatHubState.activeTab === 'chat' ? '.active' : ''),
                          {
                            onclick: () => {
                              ChatHubState.activeTab = 'chat';
                              scrollChatToBottom();
                            },
                          },
                          [m('i.fas.fa-comments'), ' Chat']
                        ),
                        m(
                          'button.tab-btn' +
                            (ChatHubState.activeTab === 'details' ? '.active' : ''),
                          {
                            onclick: () => {
                              ChatHubState.activeTab = 'details';
                            },
                          },
                          [m('i.fas.fa-info-circle'), ' Details']
                        ),
                      ]),
                    ]),
                    m('.chat-hub-tab-content', { style: { padding: ChatHubState.activeTab === 'chat' ? '0' : '1.5rem' } }, [
                      ChatHubState.activeTab === 'chat'
                        ? m(ChatConversationView)
                        : m(ChatRoomDetailView),
                    ]),
                  ]
                : [
                    m('.chat-hub-tab-content', m(ChatRoomJoinView)),
                  ],
            ]
          : m('.chat-pane-placeholder', [
              m('i.fas.fa-comments'),
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
          style: 'padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 0.6rem; cursor: pointer; transition: background 0.15s ease;',
          onmouseenter: (e) => (e.currentTarget.style.background = '#f1f5f9'),
          onmouseleave: (e) => (e.currentTarget.style.background = 'transparent'),
          onclick: () => {
            const { username, messageText } = ChatHubState.messageContextMenu;
            const quoteHeader = `> [${username}]: ${messageText}\n`;
            const textarea = document.querySelector('.chat-hub-input-area textarea') || document.querySelector('#msginput');
            if (textarea) {
              textarea.value = (textarea.value ? textarea.value.trim() + '\n' : '') + quoteHeader;
              textarea.focus();
            }
            ChatHubState.messageContextMenu.show = false;
            m.redraw();
          },
        }, [
          m('i.fas.fa-quote-right', { style: 'color: #3b82f6;' }),
          'Quote Message'
        ]),
        ChatHubState.messageContextMenu.gxsId &&
          ChatHubState.messageContextMenu.gxsId !== '00000000000000000000000000000000' &&
          m('.context-menu-item', {
            style: 'padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 0.6rem; cursor: pointer; transition: background 0.15s ease;',
            onmouseenter: (e) => (e.currentTarget.style.background = '#f1f5f9'),
            onmouseleave: (e) => (e.currentTarget.style.background = 'transparent'),
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
            m('i.fas.fa-user-circle', { style: 'color: #0ea5e9;' }),
            'Show Author in People'
          ]),
        m('.context-menu-item', {
          style: 'padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 0.6rem; cursor: pointer; transition: background 0.15s ease;',
          onmouseenter: (e) => (e.currentTarget.style.background = '#f1f5f9'),
          onmouseleave: (e) => (e.currentTarget.style.background = 'transparent'),
          onclick: () => {
            const { messageText } = ChatHubState.messageContextMenu;
            navigator.clipboard.writeText(messageText);
            ChatHubState.messageContextMenu.show = false;
            m.redraw();
          },
        }, [
          m('i.fas.fa-copy', { style: 'color: #64748b;' }),
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
