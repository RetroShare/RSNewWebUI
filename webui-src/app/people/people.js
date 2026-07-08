const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const Data = require('network/network_data');
const peopleUtil = require('people/people_util');
const compose = require('mail/mail_compose');
const ownIdsLayout = require('people/people_ownids');
const { CreateIdentity, EditIdentity, DeleteIdentity } = ownIdsLayout;

// State variables for People Page
const State = {
  searchString: '',
  selectedId: null, // GXS ID of the selected identity
  activeFilter: 'contacts', // 'all' | 'contacts' | 'own'
  gxsIdToDetailsMap: {},
  ownGxsIds: [],
  gpgToGxsIdMap: {},
  showMailCompose: false,
  activeTab: 'details',
  selectedOwnGxsIdForChat: '',
  chatPid: null,
  chatMessages: [],
  chatInputMsg: '',
  distantChatStatus: null,
  statusPollInterval: null,
  chatDisconnected: false,
  activeMenu: null,
};
// Build map GPG ID -> GXS ID for all known identities
function fetchIdDetails(gxsId) {
  if (!gxsId) return;
  if (State.gxsIdToDetailsMap[gxsId] === undefined) {
    State.gxsIdToDetailsMap[gxsId] = null; // Mark as loading
    rs.rsJsonApiRequest('/rsIdentity/getIdDetails', { id: gxsId }, (detData) => {
      if (detData && detData.details) {
        State.gxsIdToDetailsMap[gxsId] = detData.details;
        const pgpId = detData.details.mPgpId;
        if (pgpId && pgpId !== '0000000000000000') {
          State.gpgToGxsIdMap[pgpId.toLowerCase()] = gxsId;
        }
        m.redraw();
      }
    });
  }
}

// Build map GPG ID -> GXS ID for all known identities
function loadGxsIdentities() {
  rs.rsJsonApiRequest('/rsIdentity/getIdentitiesSummaries', {}, (data) => {
    if (data && data.ids) {
      m.redraw();
    }
  });
}

function loadOwnGxsIds() {
  return new Promise((resolve) => {
    peopleUtil.ownIds((ids) => {
      State.ownGxsIds = ids || [];
      if (State.ownGxsIds.length > 0 && !State.selectedOwnGxsIdForChat) {
        State.selectedOwnGxsIdForChat = State.ownGxsIds[0];
      }
      m.redraw();
      resolve();
    });
  });
}

function get64Num(val) {
  if (!val) return 0;
  if (typeof val === 'object') {
    return val.xint64 || parseInt(val.xstr64) || 0;
  }
  return Number(val) || 0;
}

function getServiceName(serviceId) {
  switch (serviceId) {
    case 1: return 'Channels';
    case 2: return 'Forums';
    case 3: return 'Boards';
    case 4: return 'Chat';
    case 5: return 'GxsCircles';
    case 6: return 'GxsMail';
    case 7: return 'GxsCircles';
    case 8: return 'Wire';
    default: return 'Unknown (' + serviceId + ')';
  }
}

function createUsageString(u) {
  if (!u) return '[Unknown]';
  const serviceName = getServiceName(u.mServiceId);
  const usageCode = u.mUsageCode;

  switch (usageCode) {
    case 0:
      return '[Unknown]';
    case 1:
      return `Admin signature in service ${serviceName}`;
    case 2:
      return `Admin signature verification in service ${serviceName}`;
    case 3:
      return `Creation of author signature in service ${serviceName}`;
    case 4:
    case 7:
      return `Group author for group ${u.mGrpId || 'Unknown'} in service ${serviceName}`;
    case 5:
      return `Message signature creation in group ${u.mGrpId || 'Unknown'} of service ${serviceName}`;
    case 6:
    case 8:
      return `Vote/comment in ${serviceName} service (Group: ${u.mGrpId || 'Unknown'}, Msg: ${u.mMsgId || 'Unknown'})`;
    case 9:
      return `Message in chat room (Id: ${get64Num(u.mAdditionalId)})`;
    case 10:
      return 'Distant message signature validation.';
    case 11:
      return 'Distant message signature creation.';
    case 12:
      return 'Signature validation in distant tunnel system.';
    case 13:
      return 'Signature in distant tunnel system.';
    case 14:
      return 'Received from GXS sync.';
    case 15:
      return 'Received from GXS discovery.';
    case 16:
      return 'Explicit request to friend.';
    case 17:
      return 'Generic signature validation.';
    case 18:
      return 'Generic signature creation.';
    case 19:
      return 'Generic encryption.';
    case 20:
      return 'Generic decryption.';
    case 21:
      return 'Circle membership check.';
    default:
      return `Usage code ${usageCode} in service ${serviceName}`;
  }
}

// Helpers
function getSafeAvatar(details) {
  return details && details.mAvatar ? details.mAvatar : undefined;
}

function getOnlineSslId(gpgId) {
  if (!gpgId) return null;
  const friend = Data.gpgDetails[gpgId.toLowerCase()];
  if (friend && friend.locations) {
    const onlineLoc = friend.locations.find((loc) => loc.isOnline);
    return onlineLoc ? onlineLoc.id : null;
  }
  return null;
}

function isIdentityOnline(gxsId) {
  fetchIdDetails(gxsId);
  const details = State.gxsIdToDetailsMap[gxsId];
  if (details && details.mPgpId && details.mPgpId !== '0000000000000000') {
    const friend = Data.gpgDetails[details.mPgpId.toLowerCase()];
    return friend ? friend.isOnline : false;
  }
  return false;
}

function syncFilter(tab) {
  let newFilter = 'all';
  if (tab === 'OwnIdentity') {
    newFilter = 'own';
  } else if (tab === 'MyContacts') {
    newFilter = 'contacts';
  }

  if (State.activeFilter !== newFilter) {
    State.activeFilter = newFilter;
    State.selectedId = null;
    State.chatPid = null;
    State.chatMessages = [];
    State.chatInputMsg = '';
    State.activeTab = 'details';
  }
}

function getStatusColor(status) {
  switch (status) {
    case 1: return '#eab308'; // Yellow
    case 2: return '#22c55e'; // Green
    case 3: return '#ef4444'; // Red
    default: return '#94a3b8'; // Grey
  }
}

function getStatusTooltip(status) {
  switch (status) {
    case 1: return 'Tunnel is pending. Please wait...';
    case 2: return 'End-to-end encrypted conversation established. You can talk!';
    case 3: return 'Your partner closed the conversation.';
    default: return 'Remote status unknown.';
  }
}

function pollDistantChatStatus() {
  if (!State.chatPid) return;
  rs.rsJsonApiRequest(
    '/rsChats/getDistantChatStatus',
    {
      pid: State.chatPid,
    },
    (detail, success) => {
      if (success && detail.retval) {
        const oldStatus = State.distantChatStatus ? State.distantChatStatus.status : null;
        State.distantChatStatus = detail.info;

        if (oldStatus !== null && oldStatus !== detail.info.status) {
          if (detail.info.status === 2) {
            const text = 'Tunnel is secured. You can talk!';
            const exists = State.chatMessages.some(m => m.isSystem && m.msg === text);
            if (!exists) {
              State.chatMessages.push({
                incoming: true,
                isSystem: true,
                msg: text,
                sendTime: Math.floor(Date.now() / 1000)
              });
              State.chatMessages.sort((a, b) => a.sendTime - b.sendTime);
            }
          } else if (detail.info.status === 3) {
            const text = 'Your partner closed the conversation.';
            const exists = State.chatMessages.some(m => m.isSystem && m.msg === text);
            if (!exists) {
              State.chatMessages.push({
                incoming: true,
                isSystem: true,
                msg: text,
                sendTime: Math.floor(Date.now() / 1000)
              });
              State.chatMessages.sort((a, b) => a.sendTime - b.sendTime);
            }
          }
        }
        m.redraw();
      }
    }
  );
}

function startStatusPolling() {
  stopStatusPolling();
  pollDistantChatStatus();
  State.statusPollInterval = setInterval(pollDistantChatStatus, 3000);
}

function stopStatusPolling() {
  if (State.statusPollInterval) {
    clearInterval(State.statusPollInterval);
    State.statusPollInterval = null;
  }
  State.distantChatStatus = null;
}

function initializeDistantChat() {
  if (!State.selectedId || !State.selectedOwnGxsIdForChat) return;

  State.chatPid = null;
  State.chatMessages = [];
  State.chatDisconnected = false;
  m.redraw();

  rs.rsJsonApiRequest(
    '/rsChats/initiateDistantChatConnexion',
    {
      to_pid: State.selectedId,
      from_pid: State.selectedOwnGxsIdForChat,
      notify: true,
    },
    (res) => {
      if (res && res.pid) {
        State.chatPid = rs.idToHex(res.pid);
        State.distantChatStatus = null;
        loadChatMessages();
        pollDistantChatStatus();
        startStatusPolling();
      }
    }
  );
}

function loadChatMessages() {
  if (!State.chatPid) return;

  const chatPeerId = {
    broadcast_status_peer_id: '00000000000000000000000000000000',
    type: 2, // DISTANT
    peer_id: '00000000000000000000000000000000',
    distant_chat_id: State.chatPid,
    lobby_id: { xstr64: '0' },
  };

  rs.rsJsonApiRequest(
    '/rsHistory/getMessages',
    {
      chatPeerId: chatPeerId,
      loadCount: 50,
    },
    (data, success) => {
      if (success && data.msgs) {
        State.chatMessages = data.msgs;
        m.redraw();
        // Scroll to bottom
        setTimeout(() => {
          const element = document.querySelector('.chat-messages');
          if (element) element.scrollTop = element.scrollHeight;
        }, 100);
      }
    }
  );
}

function sendDistantChatMessage() {
  if (!State.chatInputMsg.trim() || !State.chatPid) return;

  const cid = {
    broadcast_status_peer_id: '00000000000000000000000000000000',
    type: 2, // DISTANT
    peer_id: '00000000000000000000000000000000',
    distant_chat_id: State.chatPid,
    lobby_id: { xstr64: '0' },
  };

  const text = State.chatInputMsg;
  State.chatInputMsg = '';

  // Optimistic echo
  const echoMsg = {
    chat_id: cid,
    msg: text,
    sendTime: Math.floor(Date.now() / 1000),
    incoming: false,
    lobby_peer_gxs_id: State.selectedOwnGxsIdForChat,
  };
  State.chatMessages.push(echoMsg);
  m.redraw();
  setTimeout(() => {
    const element = document.querySelector('.chat-messages');
    if (element) element.scrollTop = element.scrollHeight;
  }, 100);

  rs.rsJsonApiRequest(
    '/rsChats/sendChat',
    {
      id: cid,
      msg: text,
    },
    (data, success) => {
      if (!success) {
        console.error('[RS] Failed to send distant chat message');
      }
    }
  );
}

const DetailsTab = () => {
  return {
    view: () => {
      fetchIdDetails(State.selectedId);
      const details = State.selectedId ? State.gxsIdToDetailsMap[State.selectedId] : null;
      if (!details) return null;

      const name = details.mNickname || details.mGroupName || 'Unknown';
      const isOwn = State.ownGxsIds.includes(State.selectedId);
      const entry = rs.userList.userMap[State.selectedId];
      const isContact = entry && entry.isContact;
      const pgpId = details.mPgpId;

      return m('.network-detail-view', [
        m('.detail-header', [
          m('.avatar-container', {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              marginRight: '1rem',
            }
          }, [
            m('.friend-avatar', m(peopleUtil.UserAvatar, {
              avatar: getSafeAvatar(details),
              firstLetter: (name || '?').slice(0, 1).toUpperCase(),
              identityId: State.selectedId,
              size: 128,
              isSquare: true,
            })),
            m('.identity-votes', {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                marginTop: '0.5rem',
              }
            }, [
              m('.vote-positive', {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  color: '#22c55e',
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                }
              }, [
                m('i.fas.fa-thumbs-up'),
                m('span', details.mReputation ? details.mReputation.mFriendsPositiveVotes : 0),
              ]),
              m('.vote-negative', {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  color: '#ef4444',
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                }
              }, [
                m('i.fas.fa-thumbs-down'),
                m('span', details.mReputation ? details.mReputation.mFriendsNegativeVotes : 0),
              ]),
            ])
          ]),
          m('.detail-title', [
            m('h2', name),
            m('.detail-subtitle', [
              m('i.fas.fa-id-card'),
              m('span', isOwn ? 'My Identity' : isContact ? 'Saved Contact' : 'Discovered Identity'),
            ]),
          ]),
          m('.detail-actions', [
            isOwn
              ? [
                  m(
                    'button.btn',
                    {
                      onclick: () =>
                        widget.popupMessage(
                          m(EditIdentity, {
                            details,
                          })
                        ),
                    },
                    [m('i.fas.fa-edit'), ' Edit']
                  ),
                  m(
                    'button.btn.red',
                    {
                      onclick: () =>
                        widget.popupMessage(
                          m(DeleteIdentity, {
                            id: details.mId,
                            name: details.mNickname,
                          })
                        ),
                    },
                    [m('i.fas.fa-trash-alt'), ' Delete']
                  ),
                ]
              : [
                  m(
                    'button.btn.blue',
                    {
                      onclick: () => {
                        State.activeTab = 'chat';
                        initializeDistantChat();
                      },
                    },
                    [m('i.fas.fa-comment-alt'), ' Start Chat']
                  ),
                  m(
                    'button.btn',
                    {
                      onclick: () => {
                        State.showMailCompose = true;
                      },
                    },
                    [m('i.fas.fa-envelope'), ' Send Mail']
                  ),
                  m(
                    'button.btn' + (isContact ? '.red' : '.blue'),
                    {
                      onclick: () => {
                        rs.rsJsonApiRequest(
                          '/rsIdentity/setAsRegularContact',
                          { id: State.selectedId, isContact: !isContact },
                          () => {
                            rs.userList.loadUsers();
                            loadGxsIdentities();
                          }
                        );
                      },
                    },
                    isContact
                      ? [m('i.fas.fa-user-minus'), ' Remove Contact']
                      : [m('i.fas.fa-user-plus'), ' Add Contact']
                  ),
                ],
          ]),
        ]),
        m('.detail-section', [
          m('h3', 'Identity Info'),
          m('.info-grid', [
            m('.info-label', 'GXS ID'),
            m('.info-value', details.mId),
            m('.info-label', 'Type'),
            m('.info-value', details.mFlags === 14 ? 'Signed ID' : 'Anonymous ID'),
            m('.info-label', 'Owner Node GPG'),
            m('.info-value', pgpId && pgpId !== '0000000000000000' ? pgpId : 'None'),
            m('.info-label', 'Created On'),
            m(
              '.info-value',
              typeof details.mPublishTS === 'object'
                ? new Date(details.mPublishTS.xint64 * 1000).toLocaleString()
                : 'Unknown'
            ),
            m('.info-label', 'Last Used'),
            m(
              '.info-value',
              typeof details.mLastUsageTS === 'object'
                ? new Date(details.mLastUsageTS.xint64 * 1000).toLocaleDateString()
                : 'Unknown'
            ),
            m('.info-label', 'Friend votes'),
            m('.info-value', details.mReputation && (details.mReputation.mFriendsPositiveVotes > 0 || details.mReputation.mFriendsNegativeVotes > 0)
              ? `${details.mReputation.mFriendsPositiveVotes} positive, ${details.mReputation.mFriendsNegativeVotes} negative`
              : 'No votes from friends'),
            m('.info-label', 'Overall'),
            m('.info-value', (() => {
              const pos = details.mReputation ? details.mReputation.mFriendsPositiveVotes : 0;
              const neg = details.mReputation ? details.mReputation.mFriendsNegativeVotes : 0;
              if (pos > neg) return 'Positive';
              if (pos < neg) return 'Negative';
              return 'Neutral';
            })()),
          ]),
        ]),
        m('.detail-section', [
          m('h3', 'Usage Statistics'),
          m('.usage-list', [
            (!details.mUseCases || details.mUseCases.length === 0)
              ? m('p.usage-placeholder', { style: 'font-style: italic; color: #64748b; padding: 0.5rem 0;' }, '[No record in current session]')
              : (() => {
                  const sorted = [...details.mUseCases].sort((a, b) => get64Num(b.value) - get64Num(a.value));
                  return sorted.map((item) => {
                    const usage = item.key;
                    const ts = get64Num(item.value);
                    const dateStr = ts > 0 ? new Date(ts * 1000).toLocaleString() : 'Unknown';
                    return m('.usage-item', {
                      style: {
                        padding: '0.5rem 0',
                        borderBottom: '1px solid #f1f5f9',
                        fontSize: '0.9rem',
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'flex-start',
                      }
                    }, [
                      m('strong.usage-time', { style: 'color: #64748b; flex-shrink: 0; min-width: 150px;' }, dateStr),
                      m('span.usage-desc', createUsageString(usage)),
                    ]);
                  });
                })()
          ])
        ]),
      ]);
    },
  };
};

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
            onclick: () => initializeDistantChat()
          }, 'Reconnect')
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
          style: 'padding: 0.5rem 1rem; background-color: #ffffff; border-bottom: 1px solid #cbd5e1; display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem;'
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
            })
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
              }, State.ownGxsIds.map(id => m('option', { value: id }, rs.userList.username(id)))),
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
              }
            }, [
              m('i.fas.fa-sign-out-alt'),
              'Leave Chat'
            ])
          ])
        ]),

        // Messages area
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
                      }
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

        // Input area
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

const PeopleLayout = () => {
  const dismissMenu = () => {
    if (State.activeMenu) {
      State.activeMenu = null;
      m.redraw();
    }
  };

  return {
    oninit: (vnode) => {
      syncFilter(vnode.attrs.tab);
      Data.refreshGpgDetails().then(() => m.redraw());
      loadGxsIdentities();
      loadOwnGxsIds();
      window.addEventListener('click', dismissMenu);

      // Register for chatEvents to receive live incoming messages
      rs.events[15].notify = (chatMessage) => {
        const msgCid = chatMessage.chat_id;
        if (msgCid && msgCid.type === 2 && State.chatPid) {
          const msgPid = rs.idToHex(msgCid.distant_chat_id);
          if (msgPid === State.chatPid) {
            const isNearDuplicate = State.chatMessages.some(
              (m) => (m.msg || m.message) === chatMessage.msg && Math.abs(m.sendTime - chatMessage.sendTime) < 5
            );
            if (!isNearDuplicate) {
              State.chatMessages.push(chatMessage);
              State.chatMessages.sort((a, b) => a.sendTime - b.sendTime);
              m.redraw();
              setTimeout(() => {
                const element = document.querySelector('.chat-messages');
                if (element) element.scrollTop = element.scrollHeight;
              }, 100);
            }
          }
        }
      };
    },
    onremove: () => {
      // Clean up notify callback when page is left
      if (rs.events[15]) {
        rs.events[15].notify = () => {};
      }
      stopStatusPolling();
      window.removeEventListener('click', dismissMenu);
    },
    onupdate: (vnode) => {
      syncFilter(vnode.attrs.tab);
    },
    view: () => {
      // 1. Get base list based on filter
      let baseList = [];
      if (State.activeFilter === 'own') {
        baseList = peopleUtil.sortIds(State.ownGxsIds) || [];
      } else if (State.activeFilter === 'contacts') {
        baseList = peopleUtil.contactlist(rs.userList.users) || [];
      } else {
        baseList = peopleUtil.sortUsers(rs.userList.users) || [];
      }

      // 2. Apply search filter
      const filteredList = baseList.filter((item) => {
        let name = '';
        if (State.activeFilter === 'own') {
          name = rs.userList.username(item) || 'Unknown';
        } else {
          name = item.mGroupName || 'Unknown';
        }
        return name.toLowerCase().includes(State.searchString.toLowerCase());
      });

      // Sort alphabetically by name
      filteredList.sort((a, b) => {
        let nameA = '';
        let nameB = '';
        if (State.activeFilter === 'own') {
          nameA = rs.userList.username(a) || '';
          nameB = rs.userList.username(b) || '';
        } else {
          nameA = a.mGroupName || '';
          nameB = b.mGroupName || '';
        }
        return nameA.localeCompare(nameB);
      });

      // 3. Selected details details info
      fetchIdDetails(State.selectedId);
      const details = State.selectedId ? State.gxsIdToDetailsMap[State.selectedId] : null;
      const name = details ? details.mNickname || details.mGroupName || 'Unknown' : '';

      return m('.people-container', [
        // Left Side Panel
        m('.people-left-pane', [
          // Filter Tabs Group
          m('.people-filter-group', [
            m(
              'button.filter-btn' + (State.activeFilter === 'contacts' ? '.active' : ''),
              {
                onclick: () => {
                  m.route.set('/people/MyContacts');
                },
              },
              'Contacts'
            ),
            m(
              'button.filter-btn' + (State.activeFilter === 'own' ? '.active' : ''),
              {
                onclick: () => {
                  m.route.set('/people/OwnIdentity');
                },
              },
              'My Identities'
            ),
            m(
              'button.filter-btn' + (State.activeFilter === 'all' ? '.active' : ''),
              {
                onclick: () => {
                  m.route.set('/people/All');
                },
              },
              'All'
            ),
          ]),

          // Create Identity container (only shown for "My Identities")
          State.activeFilter === 'own' &&
            m('.create-id-container', [
              m(
                'button.create-id-btn.blue',
                {
                  onclick: () => widget.popupMessage(m(CreateIdentity)),
                },
                [m('i.fas.fa-plus-circle'), ' Create New Identity']
              ),
            ]),

          // Search bar
          m('.friends-list-container', [
            m('.searchbar-container', [
              m('input.searchbar[type=text][placeholder=Search Identities...]', {
                value: State.searchString,
                oninput: (e) => {
                  State.searchString = e.target.value;
                },
              }),
            ]),

            // Scrollable list
            m('.friends-scroll', [
              filteredList.length === 0
                ? m('.network-pane-placeholder', { style: 'padding: 2rem 0;' }, 'No identities found')
                : filteredList.map((item) => {
                    let gxsId, displayName;
                    if (State.activeFilter === 'own') {
                      gxsId = item;
                      displayName = rs.userList.username(gxsId) || 'Unknown';
                    } else {
                      gxsId = item.mGroupId;
                      displayName = item.mGroupName || 'Unknown';
                    }

                    fetchIdDetails(gxsId);
                    const itemDetails = State.gxsIdToDetailsMap[gxsId];
                    const itemAvatar = getSafeAvatar(itemDetails);
                    const itemFirstLetter = (displayName || '?').slice(0, 1).toUpperCase();
                    const isSelected = State.selectedId === gxsId;

                    const itemEntry = rs.userList.userMap[gxsId];
                    const itemIsContact = itemEntry && itemEntry.isContact;
                    const itemIsOwn = State.ownGxsIds.includes(gxsId);

                    return m(
                      '.friend-list-item',
                      {
                        class: isSelected ? 'selected' : '',
                        onclick: (e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          const rect = e.currentTarget.getBoundingClientRect();
                          const container = document.querySelector('.friends-list-container');
                          if (container) {
                            const parentRect = container.getBoundingClientRect();
                            const top = rect.bottom - parentRect.top;
                            if (State.activeMenu && State.activeMenu.gxsId === gxsId) {
                              State.activeMenu = null;
                            } else {
                              State.activeMenu = { gxsId, displayName, isContact: itemIsContact, top };
                            }
                          }

                          const idChanged = State.selectedId !== gxsId;
                          State.selectedId = gxsId;
                          if (idChanged) {
                            State.chatPid = null;
                            State.chatMessages = [];
                            stopStatusPolling();
                            if (State.activeTab === 'chat') {
                              initializeDistantChat();
                            }
                          }
                          m.redraw();
                        },
                        oncontextmenu: (e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          const rect = e.currentTarget.getBoundingClientRect();
                          const container = document.querySelector('.friends-list-container');
                          if (container) {
                            const parentRect = container.getBoundingClientRect();
                            const top = rect.bottom - parentRect.top;
                            State.activeMenu = { gxsId, displayName, isContact: itemIsContact, top };
                          }
                          m.redraw();
                        }
                      },
                      [
                        m('.friend-avatar', m(peopleUtil.UserAvatar, {
                          avatar: itemAvatar,
                          firstLetter: itemFirstLetter,
                          identityId: gxsId,
                        })),
                        m('.friend-meta', [
                          m('.friend-name', displayName),
                          m(
                            '.friend-status',
                            itemIsOwn
                              ? 'My Identity'
                              : itemIsContact
                              ? 'Contact'
                              : 'Identity'
                          ),
                        ]),
                      ]
                    );
                  }),
            ]),
            State.activeMenu && (() => {
              const menu = State.activeMenu;
              const isOwn = State.ownGxsIds.includes(menu.gxsId);

              return m('.people-context-menu', {
                style: {
                  top: `${menu.top}px`,
                },
                onclick: (e) => {
                  e.stopPropagation();
                }
              }, [
                !isOwn && m('.menu-item', {
                  onclick: () => {
                    State.activeMenu = null;
                    State.selectedId = menu.gxsId;
                    State.activeTab = 'chat';
                    State.chatPid = null;
                    State.chatMessages = [];
                    initializeDistantChat();
                    m.redraw();
                  }
                }, [
                  m('i.fas.fa-comments', { style: 'color: #3b82f6; margin-right: 0.5rem;' }),
                  'Start chat'
                ]),
                !isOwn && m('.menu-item', {
                  onclick: () => {
                    State.activeMenu = null;
                    State.selectedId = menu.gxsId;
                    State.activeTab = 'details';
                    State.showMailCompose = true;
                    m.redraw();
                  }
                }, [
                  m('i.fas.fa-envelope', { style: 'color: #10b981; margin-right: 0.5rem;' }),
                  'Send mail'
                ]),
                !isOwn && m('.menu-item', {
                  onclick: () => {
                    State.activeMenu = null;
                    rs.rsJsonApiRequest(
                      '/rsIdentity/setAsRegularContact',
                      { id: menu.gxsId, isContact: !menu.isContact },
                      (data, success) => {
                        if (success) {
                          loadGxsIdentities();
                        }
                      }
                    );
                  }
                }, [
                  m('i.fas' + (menu.isContact ? '.fa-user-minus' : '.fa-user-plus'), {
                    style: {
                      color: menu.isContact ? '#ef4444' : '#3b82f6',
                      marginRight: '0.5rem',
                    }
                  }),
                  menu.isContact ? 'Remove from Contacts' : 'Add to Contacts'
                ])
              ]);
            })()
          ]),
        ]),

        // Right Side Details / Actions Pane
        m('.people-right-pane', [
          State.selectedId && details
            ? [
                m('.network-tabs', [
                  m(
                    'button.tab-btn' + (State.activeTab === 'details' ? '.active' : ''),
                    {
                      onclick: () => {
                        State.activeTab = 'details';
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
                        initializeDistantChat();
                      },
                    },
                    'Chat Conversation'
                  ),
                ]),
                m('.network-tab-content', [
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
  State.activeTab = activeTab;
  if (showCompose) {
    State.showMailCompose = true;
  }

  m.route.set(route);
};

module.exports = PeopleLayout;
