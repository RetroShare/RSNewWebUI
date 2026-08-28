const m = require('mithril');
const rs = require('rswebui');

// **************** utility functions ********************

function get64Num(val) {
  if (!val) return 0;
  if (typeof val === 'object') {
    return val.xint64 || parseInt(val.xstr64) || 0;
  }
  return Number(val) || 0;
}

function loadLobbyDetails(id, apply) {
  rs.rsJsonApiRequest(
    '/rsChats/getChatLobbyInfo',
    {
      id: { xstr64: id },
    },
    (detail, success) => {
      if (success && detail.retval) {
        detail.info.chatType = 3; // LOBBY
        apply(detail.info);
      } else {
        apply(null);
      }
    },
    true
  );
}

function loadDistantChatDetails(pid, apply) {
  rs.rsJsonApiRequest(
    '/rsChats/getDistantChatStatus',
    {
      pid,
    },
    (detail, success) => {
      if (success && detail.retval) {
        const info = detail.info;
        info.chatType = 2; // DISTANT (matches TYPE_PRIVATE_DISTANT in rschats.h)
        info.lobby_name = rs.userList.username(info.to_id) || 'Distant Chat ' + pid;
        info.lobby_topic = 'Private Encrypted Chat';
        info.gxs_id = info.own_id;
        info.lobby_id = pid; // Distant IDs are 128-bit hex strings, NO xstr64 wrapper
        apply(info);
      } else {
        apply(null);
      }
    },
    true
  );
}

function sortLobbies(lobbies) {
  if (lobbies !== undefined && lobbies !== null) {
    const list = [...lobbies];
    list.sort((a, b) => a.lobby_name.localeCompare(b.lobby_name));
    return list;
  }
  return [];
}

function getNicknameColor(id, name) {
  const hashString = id && id !== '00000000000000000000000000000000' ? id : (name || '');
  let hash = 0;
  for (let i = 0; i < hashString.length; i++) {
    hash = hashString.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 75%, 35%)`;
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

// Chat messages travel as HTML. Stripping the tags is not enough: the entities
// they leave behind are still raw text and end up displayed verbatim, the most
// visible one being the &nbsp; that Qt emits for leading and repeated spaces.
// A textarea decodes them without ever parsing markup, since its content model
// is plain text and nothing in the string can become an element.
function decodeHtmlEntities(text) {
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
}

// Turn the HTML payload of a chat message into the text we display.
function htmlToText(text) {
  return decodeHtmlEntities(
    text
      .replaceAll('<br/>', '\n')
      .replaceAll('<br>', '\n')
      .replace(new RegExp('<style[^<]*</style>|<[^>]*>', 'gm'), '')
  );
}

//  data: covers what the web UI itself sends (a compressed JPEG data URI) and
//  what any other client embeds the same way. Everything else -- http, https,
//  file, anything exotic -- is a fetch to a third party.
function isEmbeddedImageSrc(src) {
  return /^data:image\//i.test(String(src).trim());
}

// Keep chat pictures inside the current page. A blank window opened here can
// strand embedded browsers such as Android WebView without a usable Back entry.
let chatImageViewer = null;
let chatImageViewerPreviousOverflow = '';
let chatImageViewerOpener = null;
let chatImageViewerKeyHandler = null;
const CHAT_IMAGE_VIEWER_HISTORY_KEY = 'chatImageViewer';

function removeChatImageViewer() {
  if (!chatImageViewer) return;
  if (chatImageViewerKeyHandler) {
    document.removeEventListener('keydown', chatImageViewerKeyHandler, true);
    chatImageViewerKeyHandler = null;
  }
  chatImageViewer.remove();
  chatImageViewer = null;
  document.body.style.overflow = chatImageViewerPreviousOverflow;
  //  Put the focus back where it was taken from, so closing the preview does
  //  not leave the caret on <body> with the message list scrolled away.
  if (chatImageViewerOpener && document.contains(chatImageViewerOpener)) {
    chatImageViewerOpener.focus();
  }
  chatImageViewerOpener = null;
}

function closeChatImageViewer() {
  if (history.state && history.state[CHAT_IMAGE_VIEWER_HISTORY_KEY]) {
    history.back();
  } else {
    removeChatImageViewer();
  }
}

window.addEventListener('popstate', () => removeChatImageViewer());

function openChatImageViewer(src) {
  removeChatImageViewer();

  const overlay = document.createElement('div');
  overlay.className = 'chat-image-viewer';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Image preview');

  const image = document.createElement('img');
  image.className = 'chat-image-viewer__image';
  image.src = src;
  image.alt = 'Chat image';

  const closeButton = document.createElement('button');
  closeButton.className = 'chat-image-viewer__close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close image preview');
  closeButton.innerHTML = '&times;';
  closeButton.onclick = (event) => {
    event.stopPropagation();
    closeChatImageViewer();
  };

  overlay.append(image, closeButton);
  overlay.onclick = (event) => {
    if (event.target === overlay) closeChatImageViewer();
  };

  //  The overlay says role=dialog and aria-modal=true, so it has to behave like
  //  one. Listening on the overlay only caught what bubbled through it: tapping
  //  the picture moves the focus to <body> and Escape went dead from then on.
  //  Listening on the document, in the capture phase, means Escape closes the
  //  preview wherever the focus has drifted, and Tab cannot walk out of it into
  //  the page underneath -- the close button is the only thing to land on.
  chatImageViewerKeyHandler = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeChatImageViewer();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      closeButton.focus();
    }
  };
  document.addEventListener('keydown', chatImageViewerKeyHandler, true);

  chatImageViewerPreviousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  //  Captured before the overlay steals the focus, and restored on close.
  chatImageViewerOpener = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  document.body.appendChild(overlay);
  chatImageViewer = overlay;
  history.pushState({ ...(history.state || {}), [CHAT_IMAGE_VIEWER_HISTORY_KEY]: true }, '');
  closeButton.focus();
}

function renderChatMessage(rawText) {
  if (!rawText) return '';

  // 1. Check for <img ... src="..."> HTML tags
  const imgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
  if (imgRegex.test(rawText)) {
    imgRegex.lastIndex = 0;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = imgRegex.exec(rawText)) !== null) {
      if (match.index > lastIndex) {
        const precedingText = rawText.substring(lastIndex, match.index);
        const cleanText = htmlToText(precedingText);
        if (cleanText) {
          parts.push(renderTextWithEmoji(cleanText));
        }
      }

      const src = match[1];
      //  A message is written by whoever is at the other end of the tunnel, and
      //  an <img> pointing at a host of their choosing makes this browser fetch
      //  it: the reader's address handed over, and a read receipt with it, on a
      //  conversation whose whole point is that neither is knowable. Embedded
      //  pictures travel as data: URIs; anything else is shown as the text it is.
      if (src && !isEmbeddedImageSrc(src)) {
        parts.push(renderTextWithEmoji(`[remote image not loaded: ${src}]`));
      } else if (src) {
        parts.push(
          m('img.chat-embedded-image', {
            src,
            style: {
              maxWidth: '100%',
              maxHeight: '300px',
              borderRadius: '0.375rem',
              marginTop: '0.25rem',
              marginBottom: '0.25rem',
              display: 'block',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            },
            onclick: () => openChatImageViewer(src),
          })
        );
      }

      lastIndex = imgRegex.lastIndex;
    }

    if (lastIndex < rawText.length) {
      const trailingText = rawText.substring(lastIndex);
      const cleanText = htmlToText(trailingText);
      if (cleanText) {
        parts.push(renderFormattedMessageText(cleanText));
      }
    }

    return parts.length > 0 ? parts : '';
  }

  // 2. Check for raw data:image/... base64 URLs
  if (isEmbeddedImageSrc(rawText)) {
    const src = rawText.trim();
    return m('img.chat-embedded-image', {
      src,
      style: {
        maxWidth: '100%',
        maxHeight: '300px',
        borderRadius: '0.375rem',
        marginTop: '0.25rem',
        marginBottom: '0.25rem',
        display: 'block',
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      },
      onclick: () => openChatImageViewer(src),
    });
  }

  // 3. Normal text message
  const cleanText = htmlToText(
    rawText
      .replace(/<blockquote[^>]*>/gi, '\n> ')
      .replace(/<\/blockquote>/gi, '\n')
  );

  return renderFormattedMessageText(cleanText);
}

function renderFormattedMessageText(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const elements = [];
  let currentQuoteLines = [];

  const flushQuote = () => {
    if (currentQuoteLines.length > 0) {
      const quoteText = currentQuoteLines.join('\n');
      elements.push(
        m('blockquote.chat-quote-block', {
          style: {
            borderLeft: '3px solid #3b82f6',
            backgroundColor: '#f8fafc',
            color: '#475569',
            padding: '0.35rem 0.65rem',
            margin: '0.35rem 0',
            borderRadius: '0 0.375rem 0.375rem 0',
            fontSize: '0.9em',
            fontStyle: 'italic',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }
        }, renderTextWithEmoji(quoteText))
      );
      currentQuoteLines = [];
    }
  };

  lines.forEach((line, idx) => {
    if (line.trim().startsWith('>')) {
      const lineContent = line.trim().replace(/^>\s?/, '');
      currentQuoteLines.push(lineContent);
    } else {
      flushQuote();
      if (line) {
        elements.push(renderTextWithEmoji(line));
      }
      if (idx < lines.length - 1) {
        elements.push(m('br'));
      }
    }
  });
  flushQuote();

  return elements.length > 0 ? elements : renderTextWithEmoji(text);
}

/**
 * Wraps emoji characters in a span so CSS can size them independently.
 */
function renderTextWithEmoji(text) {
  if (!text) return '';
  const emojiRegex = /(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})(?:[\u{1F3FB}-\u{1F3FF}])?(?:\u{FE0F})?(?:\u{20E3})?(?:(?:\u{200D}(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})(?:[\u{1F3FB}-\u{1F3FF}])?(?:\u{FE0F})?)*)/gu;
  const parts = [];
  let last = 0;
  let match;

  while ((match = emojiRegex.exec(text)) !== null) {
    if (match[0].length === 0) { emojiRegex.lastIndex++; continue; }
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(m('span.chat-emoji', match[0]));
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : text;
}

function getSafeAvatar(details) {
  if (
    details &&
    details.mAvatar &&
    details.mAvatar.mData &&
    details.mAvatar.mData.base64 !== ''
  ) {
    return details.mAvatar;
  }
  return undefined;
}

// ***************************** models ***********************************

const MobileState = {
  showLobbies: false,
  showUsers: false,
  toggleLobbies() {
    this.showLobbies = !this.showLobbies;
    this.showUsers = false;
  },
  toggleUsers() {
    this.showUsers = !this.showUsers;
    this.showLobbies = false;
  },
  closeAll() {
    this.showLobbies = false;
    this.showUsers = false;
  },
};

const ChatRoomsModel = {
  allRooms: [],
  knownSubscrIds: [],
  subscribedRooms: {},
  unreadCount: {},
  invitationIds: new Set(),
  joiningLobbyId: null,
  joinError: '',
  invitationCount() {
    return this.invitationIds.size;
  },
  loadPendingInvitations() {
    rs.rsJsonApiRequest('/rsChats/getPendingChatLobbyInvites', {}, (data) => {
      const invites = data && Array.isArray(data.invites) ? data.invites : [];
      const previousInvitationIds = this.invitationIds;
      this.invitationIds = new Set(invites.map((invite) => rs.idToHex(invite.lobby_id)));
      const inviteIds = this.invitationIds;
      const rooms = this.allRooms.filter((room) => {
        const id = rs.idToHex(room.lobby_id);
        return !previousInvitationIds.has(id) && !inviteIds.has(id);
      });
      this.allRooms = sortLobbies([...rooms, ...invites]);
      m.redraw();
    });
  },
  receiveAdministrativeEvent(event) {
    // RsChatLobbyEventCode::CHAT_LOBBY_INVITE_RECEIVED
    if (event && Number(event.mEventCode) === 4) this.loadPendingInvitations();
  },
  //  An invitation that is neither accepted nor refused keeps the Chat badge
  //  lit for good: it is counted by invitationCount() and nothing else clears
  //  it. denyLobbyInvite() is what the core offers for that.
  declineInvitation(lobbyId) {
    return rs.rsJsonApiRequest(
      '/rsChats/denyLobbyInvite',
      { id: { xstr64: lobbyId } },
      (data, success) => {
        if (!success) {
          //  No answer at all: the core is unreachable or the endpoint is not
          //  in this build. Nothing was decided, so nothing is dropped here.
          this.joinError = 'No answer from RetroShare, the invitation was left alone.';
          m.redraw();
          return;
        }
        if (!data || !data.retval) {
          //  denyLobbyInvite() only returns false for one reason: the id is not
          //  in the core's invite queue (DistributedChatService, "lobby invite
          //  not in cache"). The queue lives in memory only, so a core restart
          //  empties it while this list still shows what it held before.
          //
          //  Either way the invitation is gone as far as the core is concerned,
          //  and keeping it here would leave the Chat badge lit over something
          //  that can never be accepted nor refused. Drop it and re-read the
          //  queue, so the list ends up saying what the core says.
          this.invitationIds.delete(lobbyId);
          this.allRooms = this.allRooms.filter(
            (room) => rs.idToHex(room.lobby_id) !== lobbyId
          );
          if (ChatHubState.selectedRoomId === lobbyId) {
            ChatHubState.selectedRoomId = null;
            ChatHubState.mobilePane = 'list';
          }
          this.joinError = 'RetroShare no longer had this invitation; it has been removed from the list.';
          this.loadPendingInvitations();
          m.redraw();
          return;
        }
        this.invitationIds.delete(lobbyId);
        //  The room came from the invitation, not from the nearby list, so it
        //  has to go with it -- otherwise it stays as a room with no
        //  participants that cannot be joined.
        this.allRooms = this.allRooms.filter(
          (room) => rs.idToHex(room.lobby_id) !== lobbyId
        );
        if (ChatHubState.selectedRoomId === lobbyId) {
          ChatHubState.selectedRoomId = null;
          ChatHubState.mobilePane = 'list';
        }
        this.joinError = '';
        m.redraw();
      }
    );
  },
  acceptInvitation(lobbyId, identity) {
    this.joiningLobbyId = lobbyId;
    this.joinError = '';
    return rs.rsJsonApiRequest(
      '/rsChats/acceptLobbyInvite',
      { id: { xstr64: lobbyId }, identity },
      (data, success) => {
        this.joiningLobbyId = null;
        if (!success || !data || !data.retval) {
          this.joinError = 'RetroShare rejected this identity. This room may require a signed identity.';
          m.redraw();
          return;
        }
        this.invitationIds.delete(lobbyId);
        this.loadSubscribedRooms();
        ChatHubState.selectedRoomType = 'subscribed';
        ChatLobbyModel.loadLobby(lobbyId);
        m.redraw();
      }
    );
  },
  loadPublicRooms() {
    rs.rsJsonApiRequest(
      '/rsChats/getListOfNearbyChatLobbies',
      {},
      (data) => {
        if (data && data.public_lobbies) {
          const seen = new Set();
          const uniqueLobbies = data.public_lobbies.filter((lobby) => {
            const id = rs.idToHex(lobby.lobby_id);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          const inviteIds = ChatRoomsModel.invitationIds;
          const pendingInvites = ChatRoomsModel.allRooms.filter((room) =>
            inviteIds.has(rs.idToHex(room.lobby_id))
          );
          ChatRoomsModel.allRooms = sortLobbies([
            ...uniqueLobbies.filter((room) => !inviteIds.has(rs.idToHex(room.lobby_id))),
            ...pendingInvites,
          ]);
        } else {
          ChatRoomsModel.allRooms = ChatRoomsModel.allRooms.filter((room) =>
            ChatRoomsModel.invitationIds.has(rs.idToHex(room.lobby_id))
          );
        }
      }
    );
  },
  loadSubscribedRooms(after = null) {
    ChatRoomsModel.loadPendingInvitations();
    rs.rsJsonApiRequest(
      '/rsChats/getChatLobbyList',
      {},
      (data) => {
        if (data && data.cl_list) {
          const ids = [...new Set(data.cl_list.map((lid) => rs.idToHex(lid)))];
          ChatRoomsModel.knownSubscrIds = ids;
          ids.forEach((id) => ChatRoomsModel.invitationIds.delete(id));

          Object.keys(ChatRoomsModel.subscribedRooms).forEach((id) => {
            if (!ids.includes(id)) {
              delete ChatRoomsModel.subscribedRooms[id];
            }
          });

          if (ids.length === 0) {
            ChatRoomsModel.loadPublicRooms();
            if (after != null) after();
            m.redraw();
            return;
          }

          //  One getChatLobbyInfo per subscribed room, and each one is a whole
          //  round trip: the JSON API answers `Connection: close`, so nothing is
          //  pipelined and the browser only keeps six sockets open. Waiting for
          //  the last answer before painting anything means the list appears
          //  after N round trips -- invisible over loopback, seconds on a phone.
          //  Paint each room as it lands instead, and ask for the public ones
          //  right away rather than queueing them behind the whole batch.
          ChatRoomsModel.loadPublicRooms();

          let count = 0;
          ids.forEach((id) =>
            loadLobbyDetails(id, (info) => {
              if (info) {
                ChatRoomsModel.subscribedRooms[id] = info;
              }
              count++;
              m.redraw();
              if (count === ids.length && after != null) {
                after();
              }
            })
          );
        } else {
          ChatRoomsModel.loadPublicRooms();
        }
      }
    );
  },
  subscribed(info) {
    return this.knownSubscrIds.includes(rs.idToHex(info.lobby_id));
  },
};

/**
 * Message displays a single Chat-Message
 * currently removes formatting and in consequence inline links
 */
const Message = () => {
  return {
    view: (vnode) => {
      const msg = vnode.attrs;
      const datetime = new Date(msg.sendTime * 1000).toLocaleTimeString();
      if (msg.isSystem) {
        const text = msg.msg || msg.message;
        const isSecured = text.includes('secured') || text.includes('talk');
        const bgColor = isSecured ? '#fffbeb' : '#f8fafc';
        const borderColor = isSecured ? '#fcd34d' : '#cbd5e1';
        const textColor = isSecured ? '#b45309' : '#475569';
        const borderStyle = isSecured ? 'solid' : 'dashed';

        return m(
          '.message.incoming',
          [
            m('span.datetime', datetime),
            m('span.username', 'Chat status'),
            m('.messagetext', {
              style: {
                backgroundColor: bgColor,
                border: `1px ${borderStyle} ${borderColor}`,
                color: textColor,
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                display: 'inline-block',
                marginTop: '0.25rem',
              }
            }, text)
          ]
        );
      }
      const rawGxsId = msg.lobby_peer_gxs_id || msg.peerId;
      let gxsId = rs.idToHex(rawGxsId);

      const isZero = (id) => !id || id === '00000000000000000000000000000000';
      if (isZero(gxsId)) {
        const lobby = ChatLobbyModel.currentLobby;
        if (lobby && (lobby.chatType === 1 || lobby.chatType === 2)) {
          gxsId = msg.incoming ? rs.idToHex(lobby.to_id || lobby.peer_id || lobby.distant_chat_id) : rs.idToHex(lobby.own_id || lobby.gxs_id);
        }
      }

      const isMuted = ChatHubState.mutedUsers && ChatHubState.mutedUsers.has(gxsId);
      const details = ChatHubState.gxsDetails[gxsId];
      const opinion = details && details.mReputation ? details.mReputation.mOwnOpinion : 1;
      const isBanned = opinion === 0;

      if (isMuted || isBanned) {
        return null;
      }

      let username = rs.userList.username(gxsId) || msg.peerName || '???';
      if (username === gxsId && msg.peerName) {
        username = msg.peerName;
      }
      if (username === gxsId && gxsId && gxsId.length > 12) {
        username = gxsId.substring(0, 8) + '...';
      }
      const rawText = msg.msg || msg.message || '';

      const chatType = ChatLobbyModel.currentLobby && ChatLobbyModel.currentLobby.chatType;
      const isRoom = chatType === 3;

      const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const sel = window.getSelection() ? window.getSelection().toString() : '';
        const targetText = sel && sel.trim() ? sel : rawText;

        ChatHubState.messageContextMenu = {
          show: true,
          x: e.clientX,
          y: e.clientY,
          messageText: targetText,
          username,
          gxsId,
        };
        m.redraw();
      };

      if (isRoom) {
        const nickColor = getNicknameColor(gxsId, username);
        return m(
          '.message.compact',
          {
            oncontextmenu: handleContextMenu,
          },
          [
            m('span.datetime', datetime),
            m('span.username', { style: { color: nickColor } }, username + ':'),
            m('span.messagetext', renderChatMessage(rawText)),
          ]
        );
      }

      return m(
        '.message' + (msg.incoming ? '.incoming' : '.outgoing'),
        m('span.datetime', datetime),
        m('span.username', username),
        m('span.messagetext', renderChatMessage(rawText))
      );
    },
  };
};

const ChatLobbyModel = {
  currentLobby: {
    lobby_name: '...',
  },
  lobby_user: '...',
  isSubscribed: false,
  messages: [],
  users: [],
  messageKeys: new Set(),
  lastLobbyId: null,
  distantChatStatus: null,
  statusPollInterval: null,
  participantPollInterval: null,

  updateParticipants(detail) {
    if (!detail) return;
    const byId = new Map();
    if (detail.gxs_ids) {
      if (Array.isArray(detail.gxs_ids)) {
        detail.gxs_ids.forEach((entry) => {
          const key = entry && entry.key;
          if (key) byId.set(key, {
            key,
            name: rs.userList.username(key) || key,
            lastAct: get64Num(entry.value),
          });
        });
      } else if (typeof detail.gxs_ids === 'object') {
        Object.keys(detail.gxs_ids).forEach((key) => byId.set(key, {
          key,
          name: rs.userList.username(key) || key,
          lastAct: get64Num(detail.gxs_ids[key]),
        }));
      }
    }

    const ownId = detail.gxs_id;
    if (ownId && ownId !== '00000000000000000000000000000000' && !byId.has(ownId)) {
      byId.set(ownId, {
        key: ownId,
        name: rs.userList.username(ownId) || ownId,
        lastAct: Math.floor(Date.now() / 1000),
      });
    }
    this.users = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  },

  rememberLiveParticipant(chatMessage) {
    const cid = chatMessage && chatMessage.chat_id;
    if (!cid || cid.type !== 3 || rs.idToHex(cid.lobby_id) !== this.lastLobbyId) return;
    const key = rs.idToHex(chatMessage.lobby_peer_gxs_id || chatMessage.peerId);
    if (!key || /^0+$/.test(key)) return;
    const existing = this.users.find((user) => user.key === key);
    if (existing) {
      existing.lastAct = chatMessage.sendTime || Math.floor(Date.now() / 1000);
    } else {
      this.users.push({
        key,
        name: rs.userList.username(key) || chatMessage.peerName || key,
        lastAct: chatMessage.sendTime || Math.floor(Date.now() / 1000),
      });
    }
  },

  startParticipantPolling(lobbyId) {
    this.stopParticipantPolling();
    const refresh = () => loadLobbyDetails(lobbyId, (detail) => {
      if (!detail || this.lastLobbyId !== lobbyId) return;
      this.currentLobby = { ...this.currentLobby, ...detail, chatType: 3 };
      this.updateParticipants(detail);
      m.redraw();
    });
    refresh();
    this.participantPollInterval = setInterval(refresh, 5000);
  },

  stopParticipantPolling() {
    if (this.participantPollInterval) {
      clearInterval(this.participantPollInterval);
      this.participantPollInterval = null;
    }
  },

  pollDistantChatStatus() {
    if (!this.currentLobby || this.currentLobby.chatType !== 2) return;
    rs.rsJsonApiRequest(
      '/rsChats/getDistantChatStatus',
      {
        pid: this.currentLobby.lobby_id,
      },
      (detail, success) => {
        if (success && detail.retval) {
          const oldStatus = this.distantChatStatus ? this.distantChatStatus.status : null;
          this.distantChatStatus = detail.info;

          if (oldStatus !== null && oldStatus !== detail.info.status) {
            if (detail.info.status === 2) {
              this.addMessages([{
                chat_id: this.chatId(),
                isSystem: true,
                msg: 'Tunnel is secured. You can talk!',
                sendTime: Math.floor(Date.now() / 1000)
              }]);
            } else if (detail.info.status === 3) {
              this.addMessages([{
                chat_id: this.chatId(),
                isSystem: true,
                msg: 'Your partner closed the conversation.',
                sendTime: Math.floor(Date.now() / 1000)
              }]);
            }
          }
          m.redraw();
        }
      }
    );
  },

  startStatusPolling() {
    this.stopStatusPolling();
    this.pollDistantChatStatus();
    this.statusPollInterval = setInterval(() => this.pollDistantChatStatus(), 3000);
  },

  stopStatusPolling() {
    if (this.statusPollInterval) {
      clearInterval(this.statusPollInterval);
      this.statusPollInterval = null;
    }
    this.distantChatStatus = null;
  },

  getMessageKey(msg) {
    if (msg.msgId && msg.msgId !== 0) return 'id_' + msg.msgId;
    const text = msg.msg || msg.message || '';
    return 't_' + msg.sendTime + '_' + text.substring(0, 32);
  },

  addMessages(newMsgs, scroll = false) {
    let added = false;
    newMsgs.forEach((msg) => {
      const key = this.getMessageKey(msg);
      if (!this.messageKeys.has(key)) {
        const text = msg.msg || msg.message || '';
        const isNearDuplicate = this.messages.some((existingMsg) => {
          const eAttrs = existingMsg.attrs;
          const eText = eAttrs.msg || eAttrs.message || '';
          return (
            eText === text &&
            Math.abs(eAttrs.sendTime - msg.sendTime) < 5
          );
        });

        if (!isNearDuplicate) {
          this.messageKeys.add(key);
          this.messages.push(m(Message, msg));
          added = true;
        }
      }
    });

    if (added) {
      this.messages.sort((a, b) => a.attrs.sendTime - b.attrs.sendTime);
      m.redraw();
      if (scroll) {
        setTimeout(() => {
          const element = document.querySelector('.messages');
          if (element) {
            element.scrollTop = element.scrollHeight;
          }
        }, 100);
      }
    }
  },

  //  How much of a conversation is on screen when it opens. Small on purpose:
  //  every room opening pays for it, and on a phone each request is a fresh
  //  connection on a core that answers one at a time.
  HISTORY_PAGE: 20,

  historyChatPeerId(id, type) {
    const chatPeerId = {
      broadcast_status_peer_id: '00000000000000000000000000000000',
      type,
      peer_id: '00000000000000000000000000000000',
      distant_chat_id: '00000000000000000000000000000000',
      lobby_id: { xstr64: '0' },
    };

    if (type === 3) chatPeerId.lobby_id.xstr64 = id;
    else if (type === 2) chatPeerId.distant_chat_id = id;
    else if (type === 1) chatPeerId.peer_id = id;
    return chatPeerId;
  },

  loadHistory(id, type) {
    this.historyLoaded = this.HISTORY_PAGE;
    this.historyExhausted = false;
    this.historyLoading = false;

    rs.rsJsonApiRequest(
      '/rsHistory/getMessages',
      {
        chatPeerId: this.historyChatPeerId(id, type),
        loadCount: this.HISTORY_PAGE,
      },
      (data, success) => {
        if (success && data.msgs) {
          if (data.msgs.length < this.HISTORY_PAGE) this.historyExhausted = true;
          this.addMessages(data.msgs);
        }
      }
    );
  },

  //  Reading further back. p3HistoryMgr::getMessages takes a count and nothing
  //  else -- no cursor, no "before this message" -- and always answers with the
  //  newest ones, so the only way to see older text is to ask for a bigger slice
  //  and let addMessages() drop what is already here. It re-sends what we hold,
  //  which is the price of that API; a page is small and the core keeps ten days
  //  at most anyway (mMaxStorageDurationSeconds).
  loadOlderHistory(done) {
    const detail = this.currentLobby;
    if (!detail || this.historyLoading || this.historyExhausted) return false;

    const id = this.lastLobbyId;
    if (!id) return false;

    this.historyLoading = true;
    const wanted = (this.historyLoaded || this.HISTORY_PAGE) + this.HISTORY_PAGE * 2;

    rs.rsJsonApiRequest(
      '/rsHistory/getMessages',
      {
        chatPeerId: this.historyChatPeerId(id, detail.chatType),
        loadCount: wanted,
      },
      (data, success) => {
        this.historyLoading = false;
        if (!success || !data.msgs) {
          if (done) done();
          return;
        }
        //  Fewer than asked for means the core has nothing older left.
        if (data.msgs.length < wanted) this.historyExhausted = true;
        this.historyLoaded = wanted;
        this.addMessages(data.msgs);
        if (done) done();
      }
    );
    return true;
  },
  loadAllHistoryForRoom(lobbyId, callback) {
    ChatHubState.isHistoryLoading = true;
    ChatHubState.fullHistoryMessages = [];
    m.redraw();

    const chatType = this.currentLobby && this.currentLobby.chatType;
    const isDistant = chatType === 2;

    const chatPeerId = {
      broadcast_status_peer_id: '00000000000000000000000000000000',
      type: isDistant ? 2 : 3,
      peer_id: '00000000000000000000000000000000',
      distant_chat_id: isDistant ? (lobbyId || '') : '00000000000000000000000000000000',
      lobby_id: { xstr64: isDistant ? '0' : (lobbyId || '0') },
    };

    rs.rsJsonApiRequest(
      '/rsHistory/getMessages',
      {
        chatPeerId,
        loadCount: 0,
      },
      (data, success) => {
        const msgs = (success && data && data.msgs) ? data.msgs : [];
        msgs.sort((a, b) => (a.sendTime || a.recvTime) - (b.sendTime || b.recvTime));
        ChatHubState.fullHistoryMessages = msgs;
        ChatHubState.isHistoryLoading = false;
        m.redraw();
        if (callback) callback();
      }
    );
  },
  setupAction: (lobbyId, nick) => { },
  setIdentity(lobbyId, nick) {
    rs.rsJsonApiRequest(
      '/rsChats/setIdentityForChatLobby',
      {
        lobby_id: { xstr64: lobbyId },
        nick,
      },
      () => m.route.set('/chat/:lobby', { lobby: lobbyId }),
      true
    );
  },
  enterPublicLobby(lobbyId, nick) {
    ChatRoomsModel.joiningLobbyId = lobbyId;
    ChatRoomsModel.joinError = '';
    rs.rsJsonApiRequest(
      '/rsChats/joinVisibleChatLobby',
      {
        lobby_id: { xstr64: lobbyId },
        own_id: nick,
      },
      (data, success) => {
        ChatRoomsModel.joiningLobbyId = null;
        if (!success || !data || !data.retval) {
          const room = ChatHubState.selectedRoom || {};
          const flags = Number(room.lobby_flags || 0);
          if ((flags & 0x10) !== 0) {
            ChatRoomsModel.joinError = 'This room requires a signed identity. Select a PGP-linked identity.';
          } else if (!ChatRoomsModel.invitationIds.has(lobbyId)
              && Number(room.total_number_of_peers || 0) === 0) {
            ChatRoomsModel.joinError = 'This room is no longer being advertised by an online participant. Try again when someone in the room is online.';
            ChatRoomsModel.loadPublicRooms();
          } else {
            ChatRoomsModel.joinError = 'RetroShare could not join this room. It may no longer be available; refresh the room list and try again.';
          }
          m.redraw();
          return;
        }

        // Keep the subscription in the RetroShare profile so the core joins
        // this room again after a restart. Recent cores also enable this from
        // joinVisibleChatLobby, but doing it explicitly preserves the expected
        // behaviour with cores where joining only lasts for the current run.
        rs.rsJsonApiRequest(
          '/rsChats/setLobbyAutoSubscribe',
          {
            lobby_id: { xstr64: lobbyId },
            autoSubscribe: true,
          },
          () => { },
          true
        );

        ChatRoomsModel.loadSubscribedRooms();
        ChatHubState.selectedRoomType = 'subscribed';
        ChatLobbyModel.loadLobby(lobbyId);
        m.redraw();
      },
      true
    );
  },
  unsubscribeChatLobby(lobbyId, follow) {
    rs.rsJsonApiRequest(
      '/rsChats/unsubscribeChatLobby',
      {
        lobby_id: { xstr64: lobbyId },
      },
      (data, success) => {
        if (success) {
          ChatRoomsModel.loadSubscribedRooms(follow);
        }
      },
      true
    );
  },
  chatId() {
    const type = (this.currentLobby && this.currentLobby.chatType) || 3;
    const id = this.lastLobbyId || m.route.param('lobby');
    const cid = {
      broadcast_status_peer_id: '00000000000000000000000000000000',
      type,
      peer_id: '00000000000000000000000000000000',
      distant_chat_id: '00000000000000000000000000000000',
      lobby_id: { xstr64: '0' },
    };
    if (type === 3) cid.lobby_id.xstr64 = id;
    else if (type === 2) cid.distant_chat_id = id;
    else if (type === 1) cid.peer_id = id;
    return cid;
  },
  loadLobby(currentlobbyid) {
    this.stopStatusPolling();
    this.stopParticipantPolling();
    this.lastLobbyId = currentlobbyid;
    ChatRoomsModel.unreadCount[currentlobbyid] = 0;

    const finishLoad = (detail) => {
      this.setupAction = this.setIdentity;
      this.currentLobby = detail;
      this.isSubscribed = true;
      this.lobby_user = rs.userList.username(detail.gxs_id) || '???';

      this.messages = [];
      this.messageKeys.clear();

      this.loadHistory(currentlobbyid, detail.chatType);

      const cid = this.chatId();
      rs.events[15].chatMessages(cid, rs.events[15], (l) => {
        this.addMessages(l);
      });

      this.updateParticipants(detail);

      if (detail.chatType === 2) {
        this.startStatusPolling();
      } else if (detail.chatType === 3) {
        this.startParticipantPolling(currentlobbyid);
      }

      m.redraw();
    };

    const isDistantChatId = /^[0-9a-f]{32}$/i.test(String(currentlobbyid));
    const loadDetails = (attempt = 0) => loadLobbyDetails(currentlobbyid, (detail) => {
      if (detail) {
        finishLoad(detail);
        return;
      }

      // Public lobby IDs are uint64 decimal strings. Passing one to the
      // distant-chat fallback makes the core construct a 128-bit tunnel ID
      // from (for example) a 20-character decimal value and can terminate the
      // JSON API listener. Only a real 32-hex-character tunnel ID may use it.
      if (isDistantChatId) {
        loadDistantChatDetails(currentlobbyid, (dDetail) => {
          if (dDetail) finishLoad(dDetail);
        });
        return;
      }

      // A newly joined room may not be immediately visible through
      // getChatLobbyInfo. Prefer the lobby data already loaded by the room
      // lists, then retry briefly while the core completes the subscription.
      const cached = ChatRoomsModel.subscribedRooms[currentlobbyid]
        || (ChatRoomsModel.allRooms || []).find(
          (room) => rs.idToHex(room.lobby_id) === currentlobbyid
        );
      if (cached) {
        finishLoad({ ...cached, chatType: 3 });
      } else if (attempt < 3) {
        setTimeout(() => loadDetails(attempt + 1), 250 * (attempt + 1));
      }
    });

    loadDetails();
  },
  loadPublicLobby(currentlobbyid) {
    this.setupAction = this.enterPublicLobby;
    this.isSubscribed = false;
    ChatRoomsModel.allRooms.forEach((it) => {
      if (rs.idToHex(it.lobby_id) === currentlobbyid) {
        this.currentLobby = it;
        this.lobby_user = '???';
        this.lobbyid = currentlobbyid;
      }
    });
    this.users = [];
  },
  sendMessage(msg, onsuccess) {
    const cid = this.chatId();

    rs.rsJsonApiRequest(
      '/rsChats/sendChat',
      {
        id: cid,
        msg,
      },
      (data, success) => {
        if (success) {
          const echoMsg = {
            chat_id: cid,
            msg,
            sendTime: Math.floor(Date.now() / 1000),
            lobby_peer_gxs_id: this.currentLobby.gxs_id,
          };
          this.addMessages([echoMsg], true);
          if (onsuccess) onsuccess();
        } else {
          console.error('[RS] Failed to send chat message:', data);
          alert('Failed to send chat message. The image/payload exceeds RetroShare max chat packet size.');
          if (onsuccess) onsuccess();
        }
      }
    );
  },
  selected(info, selName, defaultName) {
    const currid = rs.idToHex(ChatLobbyModel.currentLobby.lobby_id || { xstr64: m.route.param('lobby') });
    return (rs.idToHex(info.lobby_id) === currid ? selName : '') + defaultName;
  },
  switchToEvent(info) {
    return () => {
      ChatLobbyModel.currentLobby = info;
      m.route.set('/chat/:lobby', { lobby: rs.idToHex(info.lobby_id) });
      ChatLobbyModel.loadLobby(rs.idToHex(info.lobby_id));
    };
  },
  setupEvent(info) {
    return () => {
      m.route.set('/chat/:lobby/setup', { lobby: rs.idToHex(info.lobby_id) });
      ChatLobbyModel.loadPublicLobby(rs.idToHex(info.lobby_id));
    };
  },
};

// ************************* Chat Hub State ****************************

const ChatHubState = {
  mobilePane: 'list',
  selectedRoomId: null,
  selectedRoom: null,
  selectedRoomType: null,
  searchString: '',
  ownProfile: { name: 'Loading...' },
  gxsDetails: {},
  hoveredUser: null,
  mutedUsers: new Set(),
  activeMenu: null,
  showAttachModal: false,
  attachPath: '',
  attachBrowseHint: false,
  isHashing: false,
  hashingError: '',
  showEmojiPicker: false,
  emojiSearch: '',
  emojiCategory: 'Smileys',
  showCreateRoomModal: false,
  newRoomName: '',
  newRoomTopic: '',
  newRoomIdentity: '',
  newRoomPublic: true,
  newRoomSigned: false,
  ownGxsIdentities: [],
  createRoomError: '',
  userSortMethod: 'name',
  showInviteModal: false,
  friendsList: [],
  selectedFriendsToInvite: new Set(),
  showHistoryModal: false,
  historySearchQuery: '',
  fullHistoryMessages: [],
  isHistoryLoading: false,
  messageContextMenu: {
    show: false,
    x: 0,
    y: 0,
    messageText: '',
    username: '',
    gxsId: '',
  },
};

function receiveLobbyChatMessage(chatMessage) {
  const cid = chatMessage && chatMessage.chat_id;
  if (!cid || cid.type !== 3) return;
  const lobbyId = rs.idToHex(cid.lobby_id);
  if (!lobbyId) return;
  ChatLobbyModel.rememberLiveParticipant(chatMessage);
  const isOpen = m.route.get().split('/')[1] === 'chat'
    && ChatLobbyModel.lastLobbyId === lobbyId
    && (window.innerWidth > 700 || ChatHubState.mobilePane === 'detail');
  if (isOpen) ChatLobbyModel.addMessages([chatMessage]);
  else if (chatMessage.incoming === true) {
    ChatRoomsModel.unreadCount[lobbyId] = (ChatRoomsModel.unreadCount[lobbyId] || 0) + 1;
    m.redraw();
  }
}

module.exports = {
  get64Num,
  loadLobbyDetails,
  loadDistantChatDetails,
  sortLobbies,
  getNicknameColor,
  getStatusColor,
  getStatusTooltip,
  renderTextWithEmoji,
  renderChatMessage,
  getSafeAvatar,
  MobileState,
  ChatRoomsModel,
  Message,
  ChatLobbyModel,
  ChatHubState,
  receiveLobbyChatMessage,
};
