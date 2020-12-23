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
    ChatRoomsModel.subscribedRooms = {};
    rs.rsJsonApiRequest('/rsMsgs/getChatLobbyList', {},
      data => data.map(id => loadLobbyDetails(id, info => ChatRoomsModel.subscribedRooms[id] = info)),
      true, {},
      // Custom deserializer NOTE:
      // JS uses double precision numbers of 64 bit. It is equivalent
      // to 53 bits of precision. All large precision ints will
      // get truncated to an approximation.
      // This API uses Cpp-style 64 bits for `id`.
      // Instead of parsing using JSON.parse, this funciton manually
      // extracts all numbers and stores them as strings
      // Note the g flag. The match will return an array of strings
      (response) => response.match(/\d+/g),
    )
  },
  subscribed(info) {
    return this.subscribedRooms.hasOwnProperty(info.lobby_id.xstr64);
  },
};

function printMessage(msg){
  let text = msg.msg.replaceAll('<br/>','\n').replace(new RegExp('<style[^<]*</style>|<[^>]*>','gm'),'');
  console.info(text);
  return m('p.message', text);
}

let ChatLobbyModel = {
    currentLobby: {
        lobby_name: '...',
    },
    messages: [],
    users: [],
    loadLobby () {
        loadLobbyDetails(m.route.param('lobby'), detail => {
            this.currentLobby = detail;
            rs.rsJsonApiRequest('/rsIdentity/getIdentitiesSummaries', {},
              userlist => {
                if (userlist!== undefined) {
                  var userMap = userlist.ids.reduce((a,c) => {
                    a[c.mGroupId] = c;
                    return a;
                  },{});
                  var names = detail.gxs_ids.reduce((a,u) => {
                    var user = userMap[u.key];
                    return a.concat([user === undefined ? '???' : user.mGroupName])
                  },[]);
                  this.users = [];
                  let lobbyid = m.route.param('lobby');
                  rs.events[15].chatMessages({type:3,lobby_id:{xstr64:lobbyid}},rs.events[15], l => (this.messages = l.map(printMessage)));
                  rs.events[15].notify = chatMessage => {
                    if (chatMessage.chat_id.type===3 && chatMessage.chat_id.lobby_id.xstr64 === lobbyid) {
                        this.messages.push(printMessage(chatMessage));
                        m.redraw();
                    }
                  }
                  names.sort((a,b) => a.localeCompare(b));
                  names.forEach(name =>  this.users = this.users.concat([m('.user',name)]));
                }
              },
            );
            return this.users;
        });
    },
    sendMessage(msg, onsuccess) {
        rs.rsJsonApiRequest('/rsmsgs/sendChat', {},
          () => onsuccess(),
          true,
          {},
          undefined,
          () => '{"id":{"type": 3,"lobby_id":' + m.route.param('lobby') + '}, "msg":' + JSON.stringify(msg) + '}'
        )
    },
}

const Lobby = () => {
  let info = {};
  return {
    oninit: (v) => info = v.attrs.info,
    view: (v) => m( '.lobby.' + (ChatRoomsModel.subscribed(v.attrs.info) ? 'subscribed':'public'), {
      key: v.attrs.info.lobby_id.xstr64,
      onclick: e => {
        if (ChatRoomsModel.subscribed(v.attrs.info)) {
          m.route.set('/chat/:lobby', {
            lobby: v.attrs.info.lobby_id.xstr64
          });
        }
      },
    }, [
      m('h5', info.lobby_name === '' ? '<unnamed>' : info.lobby_name),
      m('p', info.lobby_topic),
    ]),
  };
};

const SubscribedLobbies = () => {
  lobbies = [];
  return {
    oninit: (v) => ChatRoomsModel.loadSubscribedRooms(),
    view: () => m('.widget', [
      m('h3', 'Subscribed chat rooms'),
      m('hr'),
      Object.values(ChatRoomsModel.subscribedRooms).map(info => m(Lobby, {
        info
      })),
    ]),
  };
};

let PublicLobbies = () => {
  return {
    oninit: () => ChatRoomsModel.loadPublicRooms(),
    view: () => m('.widget', [
      m('h3', 'Public chat rooms'),
      m('hr'),
      ChatRoomsModel.allRooms.filter(info => !ChatRoomsModel.subscribed(info)).map(info => m(Lobby, {
            info,
      })),
    ])
  };
};

const Layout = () => {
  return {
    view: vnode => m('.tab-page', [
      m(SubscribedLobbies),
      m(PublicLobbies),
    ]),
  };
};

const LayoutSingle = () => {
  return {
    oninit: ChatLobbyModel.loadLobby(),
    view: vnode => m('.tab-page', [
      m('h3.lobbyName', ChatLobbyModel.currentLobby.lobby_name),
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

