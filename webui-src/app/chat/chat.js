const m = require('mithril');
const rs = require('rswebui');
const peopleUtil = require('people/people_util');

// **************** utility functions ********************

function loadLobbyDetails(id, apply) {
  rs.rsJsonApiRequest(
    '/rsMsgs/getChatLobbyInfo',
    {
      id,
    },
    (detail) => {
      if (detail.retval) {
        apply(detail.info);
      }
    },
    true,
    {},
    undefined,
    // Custom serializer NOTE:
    // Since id represents 64-bit int(see deserializer note below)
    // Instead of using JSON.stringify, this function directly
    // creates a json string manually.
    () => '{"id":' + id + '}'
  );
}

function sortLobbies(lobbies) {
  if (lobbies !== undefined) {
    const list = [...lobbies];
    list.sort((a, b) => a.lobby_name.localeCompare(b.lobby_name));
    return list;
  }
  // return lobbies; // fallback on reload page in browser, keep undefiend
}

// ***************************** models ***********************************

const ChatRoomsModel = {
  allRooms: [],
  knownSubscrIds: [], // to exclude subscribed from public rooms (subscribedRooms filled to late)
  subscribedRooms: {},
  loadPublicRooms() {
    // TODO: this doesn't preserve id of rooms,
    // use regex on response to extract ids.
    rs.rsJsonApiRequest(
      '/rsMsgs/getListOfNearbyChatLobbies',
      {},
      (data) => (ChatRoomsModel.allRooms = sortLobbies(data.public_lobbies))
    );
  },
  loadSubscribedRooms(after = null) {
    // ChatRoomsModel.subscribedRooms = {};
    rs.rsJsonApiRequest(
      '/rsMsgs/getChatLobbyList',
      {},
      // JS uses double precision numbers of 64 bit. It is equivalent
      // to 53 bits of precision. All large precision ints will
      // get truncated to an approximation.
      // This API uses Cpp-style 64 bits for `id`.
      // So we use the string-value 'xstr64' instead
      (data) => {
        const ids = data.cl_list.map((lid) => lid.xstr64);
        ChatRoomsModel.knownSubscrIds = ids;
        const rooms = {};
        ids.map((id) =>
          loadLobbyDetails(id, (info) => {
            rooms[id] = info;
            if (Object.keys(rooms).length === ids.length) {
              // apply rooms to subscribedRooms only after reading all room-details, so sorting all or nothing
              ChatRoomsModel.subscribedRooms = rooms;
            }
          })
        );
        if (after != null) {
          after();
        }
      }
    );
  },
  subscribed(info) {
    return this.knownSubscrIds.includes(info.lobby_id.xstr64);
  },
};

/**
 * Message displays a single Chat-Message<br>
 * currently removes formatting and in consequence inline links
 * msg: Message to Display
 */
const Message = () => {
  let msg = null; // message to display
  let text = ''; // extracted text to display
  let datetime = ''; // date time to display
  let username = ''; // username to display (later may be linked)
  return {
    oninit: (vnode) => {
      console.info('chat Message', vnode);
      msg = vnode.attrs;
      datetime = new Date(msg.sendTime * 1000).toLocaleTimeString();
      username = rs.userList.username(msg.lobby_peer_gxs_id);
      text = msg.msg
        .replaceAll('<br/>', '\n')
        .replace(new RegExp('<style[^<]*</style>|<[^>]*>', 'gm'), '');
      console.info('chat Text', text);
    },
    view: () =>
      m(
        '.message',
        m('span.datetime', datetime),
        m('span.username', username),
        m('span.messagetext', text)
      ),
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
  setupAction: (lobbyId, nick) => {},
  setIdentity(lobbyId, nick) {
    rs.rsJsonApiRequest(
      '/rsMsgs/setIdentityForChatLobby',
      {},
      () => m.route.set('/chat/:lobby_id', { lobbyId }),
      true,
      {},
      JSON.parse,
      () => '{"lobby_id":' + lobbyId + ',"nick":"' + nick + '"}'
    );
  },
  enterPublicLobby(lobbyId, nick) {
    console.info('joinVisibleChatLobby', nick, '@', lobbyId);
    rs.rsJsonApiRequest(
      '/rsMsgs/joinVisibleChatLobby',
      {},
      () => {
        loadLobbyDetails(lobbyId, (info) => {
          ChatRoomsModel.subscribedRooms[lobbyId] = info;
          ChatRoomsModel.loadSubscribedRooms(() => {
            m.route.set('/chat/:lobby', { lobby: info.lobby_id.xstr64 });
          });
        });
      },
      true,
      {},
      JSON.parse,
      () => '{"lobby_id":' + lobbyId + ',"own_id":"' + nick + '"}'
    );
  },
  unsubscribeChatLobby(lobbyId, follow) {
    console.info('unsubscribe lobby', lobbyId);
    rs.rsJsonApiRequest(
      '/rsMsgs/unsubscribeChatLobby',
      {},
      () => ChatRoomsModel.loadSubscribedRooms(follow),
      true,
      {},
      JSON.parse,
      () => '{"lobby_id":' + lobbyId + '}'
    );
  },
  chatId(action) {
    return { type: 3, lobby_id: { xstr64: m.route.param('lobby') } };
  },
  loadLobby(currentlobbyid) {
    loadLobbyDetails(currentlobbyid, (detail) => {
      this.setupAction = this.setIdentity;
      this.currentLobby = detail;
      this.isSubscribed = true;
      this.lobby_user = rs.userList.username(detail.gxs_id) || '???';
      const lobbyid = currentlobbyid;
      // apply existing messages to current lobby view
      rs.events[15].chatMessages(
        this.chatId(),
        rs.events[15],
        (l) => (this.messages = l.map((msg) => m(Message, msg)))
      );
      // register for chatEvents for future messages
      rs.events[15].notify = (chatMessage) => {
        if (chatMessage.chat_id.type === 3 && chatMessage.chat_id.lobby_id.xstr64 === lobbyid) {
          this.messages.push(m(Message, chatMessage));
          m.redraw();
        }
      };
      // lookup for chat-user names (only snapshot, we don't get notified about changes of participants)
      const names = detail.gxs_ids.reduce((a, u) => a.concat(rs.userList.username(u.key)), []);
      names.sort((a, b) => a.localeCompare(b));
      this.users = [];
      names.forEach((name) => (this.users = this.users.concat([m('.user', name)])));
      return this.users;
    });
  },
  loadPublicLobby(currentlobbyid) {
    console.info('loadPublicLobby ChatRoomsModel:', ChatRoomsModel);
    this.setupAction = this.enterPublicLobby;
    this.isSubscribed = false;
    ChatRoomsModel.allRooms.forEach((it) => {
      if (it.lobby_id.xstr64 === currentlobbyid) {
        this.currentLobby = it;
        this.lobby_user = '???';
        this.lobbyid = currentlobbyid;
      }
    });
    this.users = [];
  },
  sendMessage(msg, onsuccess) {
    rs.rsJsonApiRequest(
      '/rsmsgs/sendChat',
      {},
      () => {
        // adding own message to log
        rs.events[15].handler(
          {
            mChatMessage: {
              chat_id: this.chatId(),
              msg,
              sendTime: new Date().getTime() / 1000,
              lobby_peer_gxs_id: this.currentLobby.gxs_id,
            },
          },
          rs.events[15]
        );
        onsuccess();
      },
      true,
      {},
      undefined,
      () =>
        '{"id":{"type": 3,"lobby_id":' +
        m.route.param('lobby') +
        '}, "msg":' +
        JSON.stringify(msg) +
        '}'
    );
  },
  selected(info, selName, defaultName) {
    const currid = (ChatLobbyModel.currentLobby.lobby_id || { xstr64: m.route.param('lobby') })
      .xstr64;
    return (info.lobby_id.xstr64 === currid ? selName : '') + defaultName;
  },
  switchToEvent(info) {
    return () => {
      ChatLobbyModel.currentLobby = info;
      m.route.set('/chat/:lobby', { lobby: info.lobby_id.xstr64 });
      ChatLobbyModel.loadLobby(info.lobby_id.xstr64); // update
    };
  },
  setupEvent(info) {
    return () => {
      m.route.set('/chat/:lobby/setup', { lobby: info.lobby_id.xstr64 });
      ChatLobbyModel.loadPublicLobby(info.lobby_id.xstr64); // update
    };
  },
};

// ************************* views ****************************

const Lobby = () => {
  let info = {};
  let tagname = '';
  let onclick = (e) => {};
  let lobbytagname = '';
  return {
    oninit: (v) => {
      info = v.attrs.info;
      tagname = v.attrs.tagname;
      onclick = v.attrs.onclick || ((e) => {});
      lobbytagname = v.attrs.lobbytagname || 'mainname';
    },
    view: (v) => {
      return m(
        ChatLobbyModel.selected(info, '.selected-lobby', tagname),
        {
          key: info.lobby_id.xstr64,

          onclick,
        },
        [
          m('h5', { class: lobbytagname }, info.lobby_name === '' ? '<unnamed>' : info.lobby_name),
          m('.topic', info.lobby_topic),
        ]
      );
    },
  };
};

const LobbyList = {
  view(vnode) {
    const tagname = vnode.attrs.tagname;
    const lobbytagname = vnode.attrs.lobbytagname;
    const onclick = vnode.attrs.onclick || (() => null);
    return [
      m('hr'),
      vnode.attrs.rooms.map((info) =>
        m(Lobby, {
          info,
          tagname,
          lobbytagname,
          onclick: onclick(info),
        })
      ),
    ];
  },
};

const SubscribedLeftLobbies = {
  view() {
    return [
      m('h5.lefttitle', 'subscribed:'),
      m(LobbyList, {
        rooms: sortLobbies(Object.values(ChatRoomsModel.subscribedRooms)),
        tagname: '.leftlobby.subscribed',
        lobbytagname: 'leftname',
        onclick: ChatLobbyModel.switchToEvent,
      }),
    ];
  },
};

const SubscribedLobbies = {
  view() {
    return m('.widget', [
      m('h3', 'Subscribed chat rooms'),
      m(LobbyList, {
        rooms: sortLobbies(Object.values(ChatRoomsModel.subscribedRooms)),
        tagname: '.lobby.subscribed',
        onclick: ChatLobbyModel.switchToEvent,
      }),
    ]);
  },
};

const PublicLeftLobbies = {
  view() {
    return [
      m('h5.lefttitle', 'public:'),
      m(LobbyList, {
        rooms: Object.values(ChatRoomsModel.allRooms).filter(
          (info) => !ChatRoomsModel.subscribed(info)
        ),
        tagname: '.leftlobby.public',
        lobbytagname: 'leftname',
        onclick: ChatLobbyModel.setupEvent,
      }),
    ];
  },
};

const PublicLobbies = () => {
  return m('.widget', [
    m('h3', 'Public chat rooms'),
    m(LobbyList, {
      rooms: ChatRoomsModel.allRooms.filter((info) => !ChatRoomsModel.subscribed(info)),
      tagname: '.lobby.public',
      onclick: ChatLobbyModel.setupEvent,
    }),
  ]);
};

const LobbyName = () => {
  return m(
    'h3.lobbyName',
    ChatLobbyModel.isSubscribed
      ? [m('span.chatusername', ChatLobbyModel.lobby_user), m('span.chatatchar', '@')]
      : [],
    m('span.chatlobbyname', ChatLobbyModel.currentLobby.lobby_name),
    m.route.param('subaction') !== 'setup'
      ? [
          m('i.fas.fa-cog.setupicon', {
            title: 'configure lobby',
            onclick: () =>
              m.route.set(
                '/chat/:lobby/:subaction',
                {
                  lobby: m.route.param('lobby'),
                  subaction: 'setup',
                },
                { replace: true }
              ),
          }),
        ]
      : [],
    ChatLobbyModel.isSubscribed
      ? [
          m('i.fas.fa-sign-out-alt.leaveicon', {
            title: 'leaving lobby',
            onclick: () =>
              ChatLobbyModel.unsubscribeChatLobby(m.route.param('lobby'), () => {
                m.route.set('/chat', null, { replace: true });
              }),
          }),
        ]
      : []
  );
};

// ***************************** Page Layouts ******************************

const Layout = () => {
  return {
    view: () => m('.tab-page', [m(SubscribedLobbies), PublicLobbies()]),
  };
};

const LayoutSingle = () => {
  return {
    oninit: () => ChatLobbyModel.loadLobby(m.route.param('lobby')),
    view: (vnode) =>
      m('.tab-page', [
        LobbyName(),
        m('.lobbies', m(SubscribedLeftLobbies), m(PublicLeftLobbies)),
        m('.messages', ChatLobbyModel.messages),
        m('.rightbar', ChatLobbyModel.users),
        m(
          '.chatMessage',
          {},
          m('textarea.chatMsg', {
            placeholder: 'enter new message and press return to send',
            onkeydown: (e) => {
              if (e.code === 'Enter') {
                const msg = e.target.value;
                e.target.value = ' sending ... ';
                ChatLobbyModel.sendMessage(msg, () => (e.target.value = ''));
                return false;
              }
            },
          })
        ),
      ]),
  };
};

const LayoutSetup = () => {
  let ownIds = [];
  return {
    oninit: () => peopleUtil.ownIds((data) => (ownIds = data)),
    view: (vnode) =>
      m('.tab-page', [
        LobbyName(),
        m('.lobbies', m(SubscribedLeftLobbies), m(PublicLeftLobbies)),
        m('.setup', [
          m('h5.selectidentity', 'Select identity to use'),
          ownIds.map((nick) =>
            m(
              '.identity' +
                (ChatLobbyModel.currentLobby.gxs_id === nick ? '.selectedidentity' : ''),
              {
                onclick: () => ChatLobbyModel.setupAction(m.route.param('lobby'), nick),
              },
              rs.userList.username(nick)
            )
          ),
        ]),
      ]),
  };
};

/*
    /rsMsgs/initiateDistantChatConnexion
	 * @param[in] to_pid RsGxsId to start the connection
	 * @param[in] from_pid owned RsGxsId who start the connection
	 * @param[out] pid distant chat id
	 * @param[out] error_code if the connection can't be stablished
	 * @param[in] notify notify remote that the connection is stablished
*/
const LayoutCreateDistant = () => {
  let ownIds = [];
  return {
    oninit: () => peopleUtil.ownIds((data) => (ownIds = data)),
    view: (vnode) =>
      m('.tab-page', [
        m('.createDistantChat', [
          'choose identitiy to chat with ',
          rs.userList.username(m.route.param('lobby')),
          ownIds.map((id) =>
            m(
              '.identity',
              {
                onclick: () =>
                  rs.rsJsonApiRequest(
                    '/rsMsgs/initiateDistantChatConnexion',
                    {
                      to_pid: m.route.param('lobby'),
                      from_pid: id,
                      notify: true,
                    },
                    (result) => {
                      console.info('initiateDistantChatConnexion', result);
                      m.route.set('/chat/:lobbyid', { lobbyid: result.pid });
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
    ChatRoomsModel.loadPublicRooms();
  },
  view: (vnode) => {
    if (m.route.param('lobby') === undefined) {
      return m(Layout);
    } else if (m.route.param('subaction') === 'setup') {
      return m(LayoutSetup);
    } else if (m.route.param('subaction') === 'createdistantchat') {
      return m(LayoutCreateDistant);
    } else {
      return m(LayoutSingle);
    }
  },
};
