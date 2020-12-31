let m = require('mithril');
let rs = require('rswebui');

function loadLobbyDetails(id, apply) {
  rs.rsJsonApiRequest('/rsMsgs/getChatLobbyInfo', {
      id,
    },
    detail => {
        if (detail.retval) {
            apply(detail.info);
        }
    },
    true, {},
    undefined,
    // Custom serializer NOTE:
    // Since id represents 64-bit int(see deserializer note below)
    // Instead of using JSON.stringify, this function directly
    // creates a json string manually.
    () => '{"id":' + id + '}')
 }

let ChatRoomsModel = {
  allRooms: [],
  knownSubscrIds:[], // to exclude subscribed from public rooms (subscribedRooms filled to late)
  subscribedRooms: {},
  loadPublicRooms() {
    // TODO: this doesn't preserve id of rooms,
    // use regex on response to extract ids.
    rs.rsJsonApiRequest('/rsMsgs/getListOfNearbyChatLobbies', {},
      data => {
        ChatRoomsModel.allRooms = data.public_lobbies;
      },
    );
  },
  loadSubscribedRooms() {
    // ChatRoomsModel.subscribedRooms = {};
    rs.rsJsonApiRequest('/rsMsgs/getChatLobbyList', {},
      data => {
        ChatRoomsModel.knownSubscrIds = data;
        let rooms = {};
        data.map(id => loadLobbyDetails(id, info => rooms[id] = info));
        ChatRoomsModel.subscribedRooms = rooms;
      },
      true, {},
      // Custom deserializer NOTE:
      // JS uses double precision numbers of 64 bit. It is equivalent
      // to 53 bits of precision. All large precision ints will
      // get truncated to an approximation.
      // This API uses Cpp-style 64 bits for `id`.
      // Instead of parsing using JSON.parse, this function manually
      // extracts all numbers and stores them as strings
      // Note the g flag. The match will return an array of strings
      (response) => response.match(/\d+/g),
    )
  },
  subscribed(info) {
    return this.knownSubscrIds.includes(info.lobby_id.xstr64);
  },
};

function printMessage(msg){
  let datetime = new Date(msg.sendTime * 1000).toLocaleString();
  let username = rs.userList.username(msg.lobby_peer_gxs_id);
  let text = msg.msg.replaceAll('<br/>','\n').replace(new RegExp('<style[^<]*</style>|<[^>]*>','gm'),'');
  console.info(text);
  return m('.message', m('span.datetime', datetime), m('span.username', username), m('span.messagetext', text));
}

const ChatLobbyModel = {
    currentLobby: {
        lobby_name: '...',
    },
    messages: [],
    users: [],
    chatId(action) {
        return {type:3,lobby_id:{xstr64:m.route.param('lobby')}};
    },
    loadLobby (currentlobbyid) {
        loadLobbyDetails(currentlobbyid, detail => {
            this.currentLobby = detail;
            let lobbyid = currentlobbyid;
            // apply existing messages to current lobby view
            rs.events[15].chatMessages(this.chatId(),rs.events[15], l => (this.messages = l.map(printMessage)));
            // register for chatEvents for future messages
            rs.events[15].notify = chatMessage => {
                if (chatMessage.chat_id.type===3 && chatMessage.chat_id.lobby_id.xstr64 === lobbyid) {
                    this.messages.push(printMessage(chatMessage));
                    m.redraw();
                }
            }
            // lookup for chat-user names (only snapshot, we don't get notified about changes of participants)
            var names = detail.gxs_ids.reduce((a,u) => a.concat(rs.userList.username(u.key)), []);
            names.sort((a,b) => a.localeCompare(b));
            this.users = [];
            names.forEach(name =>  this.users = this.users.concat([m('.user',name)]));
            return this.users;
        });
    },
    sendMessage(msg, onsuccess) {
        rs.rsJsonApiRequest('/rsmsgs/sendChat', {},
            () => {
              // adding own message to log
              rs.events[15].handler({
                mChatMessage:{
                    chat_id:this.chatId(),
                    msg:msg,
                    sendTime:new Date().getTime()/1000,
                    lobby_peer_gxs_id:this.currentLobby.gxs_id,
                }
              },rs.events[15]);
              onsuccess();
            },
            true, {}, undefined,
            () => '{"id":{"type": 3,"lobby_id":' + m.route.param('lobby') + '}, "msg":' + JSON.stringify(msg) + '}'
        );
    },
    selected(info, selName, defaultName) {
        let currid = (ChatLobbyModel.currentLobby.lobby_id || {xstr64: m.route.param('lobby')}).xstr64
        return ((info.lobby_id.xstr64 === currid) ? selName : '') + defaultName;
    },
    switchToEvent(info) {
        return () => {
            ChatLobbyModel.currentLobby = info;
            m.route.set('/chat/:lobby', { lobby: info.lobby_id.xstr64 });
            ChatLobbyModel.loadLobby(info.lobby_id.xstr64); // update
        };
    }
}

const Lobby = () => {
  let info = {};
  let tagname = '';
  let onclick = e => {};
  let lobbytagname = '';
  return {
    oninit: (v) => {
        info = v.attrs.info;
        tagname = v.attrs.tagname;
        onclick = v.attrs.onclick || (e => {});
        lobbytagname= v.attrs.lobbytagname || 'h5.mainname';
    },
    view: v => {
      return m(ChatLobbyModel.selected(info, '.selected-lobby', tagname), {
      key: info.lobby_id.xstr64,
      onclick: onclick,
    }, [
      m(lobbytagname,info.lobby_name === '' ? '<unnamed>' : info.lobby_name),
      m('.topic', info.lobby_topic),
    ]);
    },
  };
};

const SubscribedLobbies = () => {
  return {
    view: () => m('.widget', [
      m('h3', 'Subscribed chat rooms'),
      m('hr'),
      Object.values(ChatRoomsModel.subscribedRooms).map(info => m(Lobby, {
        info, tagname:'.lobby.subscribed', onclick: e => m.route.set('/chat/:lobby', { lobby: info.lobby_id.xstr64 })
      })),
    ]),
  };
};

const PublicLobbies = () => {
  return {
    view: () => m('.widget', [
      m('h3', 'Public chat rooms'),
      m('hr'),
      ChatRoomsModel.allRooms.filter(info => !ChatRoomsModel.subscribed(info)).map(info => m(Lobby, {
            info, tagname:'.lobby.public',
      })),
    ])
  };
};

const Layout = () => {
  return {
    oninit: () => {
        ChatRoomsModel.loadSubscribedRooms();
        ChatRoomsModel.loadPublicRooms();
    },
    view: vnode => m('.tab-page', [
      m(SubscribedLobbies),
      m(PublicLobbies),
    ]),
  };
};

const LobbyList = () => {
    let rooms= [];
    let tagname= '';
    let lobbytagname= '';
    let onclick = (info => (() => {}));
    return {
      oninit: vnode => {
        rooms = vnode.attrs.rooms;
        tagname = vnode.attrs.tagname;
        lobbytagname= vnode.attrs.lobbytagname;
        onclick=vnode.attrs.onclick||(() => (() => {}));
      },
      view: vnode => rooms.map(info => m(Lobby, {
            info,
            tagname: tagname,
            lobbytagname,
            onclick: onclick(info),
        })),
    };
}

const LayoutSingle = () => {
  return {
    oninit: () => {
      ChatRoomsModel.loadSubscribedRooms();
      ChatRoomsModel.loadPublicRooms();
      ChatLobbyModel.loadLobby(m.route.param('lobby'));
    },
    view: vnode => m('.tab-page', [
      m('h3.lobbyName', ChatLobbyModel.currentLobby.lobby_name),
      m('.lobbies',
        m('h5.lefttitle', 'subscribed:'),
        m('hr'),
        m(LobbyList, {
          rooms: Object.values(ChatRoomsModel.subscribedRooms),
          tagname: '.leftlobby.subscribed',
          lobbytagname:'h5.leftname',
          onclick: ChatLobbyModel.switchToEvent,
        }),
        m('h5.lefttitle', 'public:'),
        m('hr'),
        Object.values(ChatRoomsModel.allRooms).filter(info => !ChatRoomsModel.subscribed(info)).map(info => m(Lobby, {
          info, tagname: '.leftlobby.public', lobbytagname:'h5.leftname',
        })),
      ),
      m('.messages', ChatLobbyModel.messages),
      m('.rightbar', ChatLobbyModel.users),
      m('.chatMessage', {},  m("textarea.chatMsg", {
          placeholder: 'enter new message and press return to send',
          onkeydown: e => {
            if (e.code==='Enter') {
                var msg = e.target.value;
                e.target.value = ' sending ... ';
                ChatLobbyModel.sendMessage(msg, () => e.target.value='');
                return false;
            }
          }
        })
      ),
    ]),
  };
};

module.exports = {
  view: (vnode) => {
    if (m.route.param('lobby') === undefined) {
      return m(Layout);
    } else {
       return m(LayoutSingle);
    }
  }
};

