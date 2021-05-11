(function() {
    'use strict';

    const globals = typeof window === 'undefined' ? global : window;
    if (typeof globals.require === 'function') return;

    let modules = {},
        cache = {},
        aliases = {},
        has = {}.hasOwnProperty;

    const unalias = function(alias, loaderPath) {
        const _cmp = 'components/';
        let start = 0;
        if (loaderPath) {
            if (loaderPath.startsWith(_cmp)) {
                start = _cmp.length;
            }
            if (loaderPath.indexOf('/', start) > 0) {
                loaderPath = loaderPath.substring(
                    start,
                    loaderPath.indexOf('/', start)
                );
            }
        }
        const result =
      aliases[alias + '/index.js'] ||
      aliases[loaderPath + '/deps/' + alias + '/index.js'];
        if (result) {
            return _cmp + result.substring(0, result.length - '.js'.length);
        }
        return alias;
    };

    const expand = function(root, name) {
        const _reg = /^\.\.?(\/|$)/;
        let results = [],
            parts = (_reg.test(name) ? root + '/' + name : name).split('/');
        for (let part of parts) {
            if (part === '..') {
                results.pop();
            } else if (part !== '.' && part !== '') {
                results.push(part);
            }
        }
        return results.join('/');
    };

    const dirname = function(path) {
        return path
            .split('/')
            .slice(0, -1)
            .join('/');
    };

    const localRequire = function(path) {
        return function(name) {
            let absolute = expand(dirname(path), name);
            return globals.require(absolute, path);
        };
    };

    const initModule = function(name, definition) {
        let module = { id: name, exports: {} };
        cache[name] = module;
        definition(module.exports, localRequire(name), module);
        return module.exports;
    };

    const require = function(name, loaderPath) {
        if (loaderPath === undefined) loaderPath = '/';
        let path = unalias(name, loaderPath);

        if (path in cache) return cache[path].exports;
        if (path in modules) return initModule(path, modules[path]);

        let dirIndex = expand(path, './index');
        if (dirIndex in cache) return cache[dirIndex].exports;
        if (dirIndex in modules) return initModule(dirIndex, modules[dirIndex]);

        throw new Error(
            'Cannot find module "' + name + '" from ' + '"' + loaderPath + '"'
        );
    };

    require.alias = function(from, to) {
        aliases[to] = from;
    };

    require.register = require.define = function(bundle, fn) {
        if (typeof bundle === 'object') {
            for (let key in bundle) {
                if (has.call(bundle, key)) {
                    modules[key] = bundle[key];
                }
            }
        } else {
            modules[bundle] = fn;
        }
    };

    require.list = function() {
        let result = [];
        for (let item in modules) {
            if (has.call(modules, item)) {
                result.push(item);
            }
        }
        return result;
    };

    require._cache = cache;
    globals.require = require;
})();
require.register("channels/channels", function(exports, require, module) {
const m = require('mithril');

const Channel = () => {
  return {
    view: () => m('.channel'),
  };
};

const MyChannels = () => {
  return {
    view: () => m('.widget', [m('h3', 'My channels'), m('hr'), m(Channel)]),
  };
};

const Layout = () => {
  return {
    view: (vnode) => m('.tab-page', [m(MyChannels)]),
  };
};

module.exports = {
  view: (vnode) => {
    return m(Layout);
  },
};

});
require.register("chat/chat", function(exports, require, module) {
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

});
require.register("config/config_files", function(exports, require, module) {
const m = require('mithril');
const rs = require('rswebui');

const SharedDirectories = () => {
  let directories = [];
  return {
    dirs: [],
    oninit: (vnode) => {
      rs.rsJsonApiRequest('/rsFiles/getSharedDirectories', {}, (data) => (directories = data.dirs));
    },
    view: (vnode) =>
      m('.widget .', [
        m('h3', 'Shared Directories'),
        m('hr'),
        directories.map((dir) =>
          m('input[type=text].stretched', {
            value: dir.filename,
          })
        ),
      ]),
  };
};

const DownloadDirectory = () => {
  let dlDir = '';
  const setDir = () => {
    // const path = document.getElementById('dl-dir-input').value; // unused?

    rs.rsJsonApiRequest(
      'rsFiles/setDownloadDirectory',
      {
        path: dlDir,
      },
      () => {}
    );
  };
  return {
    oninit: (vnode) => {
      rs.rsJsonApiRequest('/rsFiles/getDownloadDirectory', {}, (data) => (dlDir = data.retval));
    },
    view: (vnode) =>
      m('.widget', [
        m('h3', 'Downloads Directory'),
        m('hr'),
        m('input[type=text].stretched#dl-dir-input', {
          oninput: (e) => (dlDir = e.target.value),
          value: dlDir,
          onchange: setDir,
        }),
      ]),
  };
};

const PartialsDirectory = () => {
  let partialsDir = '';
  const setDir = () => {
    // const path = document.getElementById('partial-dir-input').value; // unused?

    rs.rsJsonApiRequest(
      'rsFiles/setPartialsDirectory',
      {
        path: partialsDir,
      },
      () => {}
    );
  };
  return {
    oninit: (vnode) =>
      rs.rsJsonApiRequest(
        '/rsFiles/getPartialsDirectory',
        {},
        (data) => (partialsDir = data.retval)
      ),
    view: (vnode) =>
      m('.widget.widget-halfwidth', [
        m('h3', 'Partials Directory'),
        m('hr'),
        m('input[type=text].stretched#partial-dir-input', {
          oninput: (e) => (partialsDir = e.target.value),
          value: partialsDir,
          onchange: setDir,
        }),
      ]),
  };
};

const TransferOptions = () => {
  let strategy = undefined;
  let diskLimit = undefined;
  const setChunkStrat = () =>
    rs.rsJsonApiRequest(
      '/rsFiles/setDefaultChunkStrategy',
      {
        strategy: Number(strategy),
      },
      () => {}
    );
  const setFreeLimit = () =>
    rs.rsJsonApiRequest(
      '/rsFiles/setFreeDiskSpaceLimit',
      {
        MinimumFreeMB: diskLimit,
      },
      () => {}
    );
  return {
    oninit: (vnode) => {
      rs.rsJsonApiRequest('/rsFiles/defaultChunkStrategy', {}, (data) => (strategy = data.retval));
      rs.rsJsonApiRequest('/rsFiles/freeDiskSpaceLimit', {}, (data) => (diskLimit = data.retval));
    },
    view: (vnode) =>
      m('.widget.widget-half', [
        m('h3', 'Transfer options'),
        m('hr'),
        m('.grid-2col', [
          m('p', 'Default chunk strategy:'),
          m(
            'select[name=strategy]',
            {
              oninput: (e) => (strategy = e.target.value),
              value: strategy,
              onchange: setChunkStrat,
            },
            ['Streaming', 'Random', 'Progressive'].map((val, i) =>
              m('option[value=' + i + ']', val)
            )
          ),
          m('p', 'Safety disk space limit(MB):'),
          m('input[type=number].small', {
            oninput: (e) => (diskLimit = e.target.value),
            value: diskLimit,
            onchange: setFreeLimit,
          }),
        ]),
      ]),
  };
};

const Layout = () => {
  return {
    view: (vnode) => [
      m(SharedDirectories),
      m(DownloadDirectory),
      m(PartialsDirectory),
      m(TransferOptions),
    ],
  };
};

module.exports = Layout;

});
require.register("config/config_network", function(exports, require, module) {
const m = require('mithril');
const rs = require('rswebui');

const util = require('config/config_util'); // for future use

/* eslint-disable no-unused-vars */

const SetNwMode = () => {
  let mode = undefined;
  let sslId = undefined;
  const setMode = () => rs.rsJsonApiRequest('/');

  return {
    oninit: util.getSslId().then((val) => {
      sslId = val;
      rs.rsJsonApiRequest('/');
    }),
    view: () => [
      m('p', 'Network mode:'),
      m(
        'select',
        {
          oninput: (e) => (mode = e.target.value),
          value: mode,
          onchange: setMode,
        },
        ['Discovery on(recommended)', 'Discovery off'].map((val, i) =>
          m('option[value=' + (i + 1) + ']', val)
        )
      ),
    ],
  };
};

const SetLimits = () => {
  let dlim = undefined;
  let ulim = undefined;
  const setMaxRates = () =>
    rs.rsJsonApiRequest('/rsConfig/SetMaxDataRates', {
      downKb: dlim,
      upKb: ulim,
    });
  return {
    oninit: () =>
      rs.rsJsonApiRequest('/rsConfig/GetMaxDataRates', {}, (data) => {
        dlim = data.inKb;
        ulim = data.outKb;
      }),
    view: () => [
      m(
        'p',
        util.tooltip(
          'The download limit covers the whole application. ' +
            'However, in some situations, such as when transfering ' +
            'many files at once, the estimated bandwidth becomes ' +
            'unreliable and the total value reported by Retroshare ' +
            'might exceed that limit.'
        ),
        'Download limit(KB/s):'
      ),
      m('input[type=number][name=download]', {
        value: dlim,
        oninput: (e) => (dlim = Number(e.target.value)),
        onchange: setMaxRates,
      }),
      m(
        'p',
        util.tooltip(
          'The upload limit covers the entire software. ' +
            'Too small an upload limit may eventually block ' +
            'low priority services(forums, channels). ' +
            'A minimum recommended value is 50KB/s.'
        ),
        'Upload limit(KB/s):'
      ),
      m('input[type=number][name=upload]', {
        value: ulim,
        oninput: (e) => (ulim = Number(e.target.value)),
        onchange: setMaxRates,
      }),
    ],
  };
};

const SetOpMode = () => {
  let opmode = undefined;
  const setmode = () =>
    rs.rsJsonApiRequest(
      '/rsconfig/SetOperatingMode',
      {
        opMode: Number(opmode),
      },
      () => {}
    );
  return {
    oninit: () =>
      rs.rsJsonApiRequest('/rsConfig/getOperatingMode', {}, (data) => (opmode = data.retval)),
    view: () => [
      m(
        'p',
        'Operating mode:',
        util.tooltip(
          `No Anon D/L: Switches off file forwarding\n
Gaming Mode: 25% standard traffic and TODO: Reduced popups\n
Low traffic: 10% standard traffic and TODO: pause all file transfers\n`
        )
      ),
      m(
        'select',
        {
          oninput: (e) => (opmode = e.target.value),
          value: opmode,
          onchange: setmode,
        },
        ['Normal', 'No Anon D/L', 'Gaming', 'Low traffic'].map((val, i) =>
          m('option[value=' + (i + 1) + ']', val)
        )
      ),
    ],
  };
};

const Component = () => {
  return {
    view: () =>
      m('.widget.widget-half.', [
        m('h3', 'Network Configuration'),
        m('hr'),

        m('.grid-2col', [
          m(SetLimits),
          m(SetOpMode),
          // m(SetNwMode),
        ]),
      ]),
  };
};

module.exports = Component;

});
require.register("config/config_node", function(exports, require, module) {
const m = require('mithril');
const rs = require('rswebui');

const Node = () => {
  const nodeInfo = {
    setData(data) {
      Object.assign(nodeInfo, data.status);
    },
  };
  return {
    oninit() {
      rs.rsJsonApiRequest('/rsConfig/getConfigNetStatus', {}, nodeInfo.setData);
    },
    view() {
      return [
        m('.widget.widget-half .', [
          m('h3', 'Public Information'),
          m('hr'),
          m('ul', [
            m('li', 'Name: ' + nodeInfo.ownName),
            m('li', 'Location ID: ' + nodeInfo.ownId),
            m('li', 'Firewall: ' + nodeInfo.firewalled),
            m('li', 'Port Forwarding: ' + nodeInfo.forwardPort),
            m('li', 'DHT: ' + nodeInfo.DHTActive),
            m('li', 'uPnP: ' + nodeInfo.uPnPActive),
            m('li', 'Local Address: ' + nodeInfo.localAddr + '  Port: ' + nodeInfo.localPort),
          ]),
        ]),
      ];
    },
  };
};

module.exports = Node;

});
require.register("config/config_people", function(exports, require, module) {
const m = require('mithril');
const rs = require('rswebui');

const Reputation = () => {
  let addFriendIdAsContacts = undefined;
  let deleteBannedAfter = undefined;
  return {
    oninit: (vnode) => {
      rs.rsJsonApiRequest(
        '/rsIdentity/autoAddFriendIdsAsContact',
        {},
        (data) => (addFriendIdAsContacts = data.retval)
      );
      rs.rsJsonApiRequest(
        '/rsIdentity/deleteBannedNodesThreshold',
        {},
        (data) => (deleteBannedAfter = data.retval)
      );
    },
    view: (vnode) =>
      m('.widget .', [
        m('h3', 'Reputation'),
        m('hr'),
        m('.grid-2col', [
          m('p', 'Automatically add identities owned by friend nodes to my contacts:'),
          m('input[type=checkbox]', {
            checked: addFriendIdAsContacts,
            oninput: (e) => {
              addFriendIdAsContacts = e.target.checked;
              rs.rsJsonApiRequest(
                '/rsIdentity/setAutoAddFriendIdsAsContact',
                {
                  enabled: addFriendIdAsContacts,
                },
                () => {}
              );
            },
          }),
          m('p', 'Delete banned identities after(in days, 0 means indefinitely):'),
          m('input[type=number]', {
            oninput: (e) => (deleteBannedAfter = e.target.value),
            value: deleteBannedAfter,
            onchange: () =>
              rs.rsJsonApiRequest(
                '/rsIdentity/setDeleteBannedNodesThreshold',
                {
                  days: deleteBannedAfter,
                },
                () => {}
              ),
          }),
        ]),
      ]),
  };
};

const Layout = () => {
  return {
    view: (vnode) => [m(Reputation)],
  };
};

module.exports = Layout;

});
require.register("config/config_resolver", function(exports, require, module) {
const m = require('mithril');

const widget = require('widgets');

const sections = {
  network: require('config/config_network'),
  node: require('config/config_node'),
  services: require('config/config_services'),
  files: require('config/config_files'),
  people: require('config/config_people'),
};

const Layout = {
  view: (vnode) =>
    m('.tab-page', [
      m(widget.Sidebar, {
        tabs: Object.keys(sections),
        baseRoute: '/config/',
      }),
      m('.node-panel', vnode.children),
    ]),
};

module.exports = {
  view: (vnode) => {
    const tab = vnode.attrs.tab;
    return m(Layout, m(sections[tab]));
  },
};

});
require.register("config/config_services", function(exports, require, module) {
const m = require('mithril');
const rs = require('rswebui');

const servicesInfo = {
  list: [],

  setData(data) {
    servicesInfo.list = data.info.mServiceList;
  },
};

const Service = () => {
  let defaultAllowed = undefined;
  return {
    oninit: (v) =>
      rs.rsJsonApiRequest(
        '/rsServiceControl/getServicePermissions',
        {
          serviceId: v.attrs.data.key,
        },
        (retval) => (defaultAllowed = retval.permissions.mDefaultAllowed)
      ),
    view: (v) =>
      m(
        'tr',
        {
          key: v.attrs.data.key,
        },
        [
          m('td', v.attrs.data.value.mServiceName),
          m('td', v.attrs.data.value.mServiceType),
          m('td', v.attrs.data.value.mVersionMajor + '.' + v.attrs.data.value.mVersionMinor),
          m(
            'td',
            m('input[type=checkbox]', {
              checked: defaultAllowed,
              oninput: (e) => {
                defaultAllowed = e.target.checked;
                rs.rsJsonApiRequest('/rsServiceControl/updateServicePermissions', {
                  serviceId: v.attrs.data.key,
                  permissions: {
                    mDefaultAllowed: defaultAllowed,
                  },
                });
              },
            })
          ),
        ]
      ),
  };
};

const MyServices = {
  oninit() {
    rs.rsJsonApiRequest('/rsServiceControl/getOwnServices', {}, servicesInfo.setData);
  },
  view() {
    return m('.widget .', [
      m('h3', 'My Services'),
      m('hr'),
      m('table', [
        m('tr', [m('th', 'Name'), m('th', 'ID'), m('th', 'Version'), m('th', 'Allow by default')]),
        servicesInfo.list.map((data) =>
          m(Service, {
            data,
          })
        ),
      ]),
    ]);
  },
};

const Layout = () => {
  return {
    view: (vnode) => [m(MyServices)],
  };
};

module.exports = {
  view: (vnode) => {
    return m(Layout);
  },
};

});
require.register("config/config_util", function(exports, require, module) {
const m = require('mithril');
const rs = require('rswebui');

function tooltip(text) {
  return m('.tooltip', [m('i.fas.fa-info-circle'), m('.tooltiptext', text)]);
}

async function getSslId() {
  let id = '';
  await rs.rsJsonApiRequest('/rsIdentity/GetOwnSignedIds', {}, (data) => (id = data.ids[0]));
  return id;
}

module.exports = {
  tooltip,
  getSslId,
};

});
require.register("files/files_downloads", function(exports, require, module) {
const m = require('mithril');
const rs = require('rswebui');
const util = require('files/files_util');
const widget = require('widgets');

const Downloads = {
  statusMap: {},
  hashes: [],

  loadHashes() {
    rs.rsJsonApiRequest('/rsFiles/FileDownloads', {}, (d) => (Downloads.hashes = d.hashs));
  },

  loadStatus() {
    Downloads.loadHashes();
    const fileKeys = Object.keys(Downloads.statusMap);
    if (Downloads.hashes.length !== fileKeys.length) {
      // New file added
      if (Downloads.hashes.length > fileKeys.length) {
        const newHashes = util.compareArrays(Downloads.hashes, fileKeys);
        for (const hash of newHashes) {
          Downloads.updateFileDetail(hash, true);
        }
      }
      // Existing file removed
      else {
        const oldHashes = util.compareArrays(fileKeys, Downloads.hashes);
        for (const hash of oldHashes) {
          delete Downloads.statusMap[hash];
        }
      }
    }
    for (const hash in Downloads.statusMap) {
      Downloads.updateFileDetail(hash);
    }
  },
  resetSearch() {
    for (const hash in Downloads.statusMap) {
      Downloads.statusMap[hash].isSearched = true;
    }
  },
  updateFileDetail(hash, isNew = false) {
    rs.rsJsonApiRequest(
      '/rsFiles/FileDetails',
      {
        hash,
        hintflags: 16, // RS_FILE_HINTS_DOWNLOAD
      },
      (fileStat) => {
        if (!fileStat.retval) {
          console.error('Error: Unknown hash in Downloads: ', hash);
          return;
        }
        fileStat.info.isSearched = isNew ? true : Downloads.statusMap[hash].isSearched;
        Downloads.statusMap[hash] = fileStat.info;
      }
    );
  },
};

function InvalidFileMessage() {
  widget.popupMessage([
    m('i.fas.fa-file-medical'),
    m('h3', 'Add new file'),
    m('hr'),
    m('p', 'Error: could not add file'),
  ]);
}

function addFile(url) {
  // valid url format: retroshare://file?name=...&size=...&hash=...
  if (!url.startsWith('retroshare://')) {
    InvalidFileMessage();
    return;
  }
  const details = m.parseQueryString(url.split('?')[1]);
  if (
    !Object.prototype.hasOwnProperty.call(details, 'name') ||
    !Object.prototype.hasOwnProperty.call(details, 'size') ||
    !Object.prototype.hasOwnProperty.call(details, 'hash')
  ) {
    InvalidFileMessage();
    return;
  }
  rs.rsJsonApiRequest(
    '/rsFiles/FileRequest',
    {
      fileName: details.name,
      hash: details.hash,

      flags: util.RS_FILE_REQ_ANONYMOUS_ROUTING,
      size: Number.parseInt(details.size),
    },
    (status) => {
      widget.popupMessage([
        m('i.fas.fa-file-medical'),
        m('h3', 'Add new file'),
        m('hr'),
        m('p', 'Successfully added file!'),
      ]);
    }
  );
}

const NewFileDialog = () => {
  let url = '';
  return {
    view: () => [
      m('i.fas.fa-file-medical'),
      m('h3', 'Add new file'),
      m('hr'),
      m('p', 'Enter the file link:'),
      m('input[type=text][name=fileurl]', {
        onchange: (e) => (url = e.target.value),
      }),
      m(
        'button',
        {
          onclick: () => addFile(url),
        },
        'Add'
      ),
    ],
  };
};

const Component = () => {
  return {
    oninit: () => {
      rs.setBackgroundTask(Downloads.loadStatus, 1000, () => {
        return m.route.get() === '/files/files';
      });
      Downloads.resetSearch();
    },
    view: () =>
      m('.widget .', [
        m('h3', 'Downloads (' + Downloads.hashes.length + ' files)'),
        m('hr'),
        m(
          'button',
          {
            onclick: () => widget.popupMessage(m(NewFileDialog)),
          },
          'Add new file'
        ),
        m(
          'button',
          {
            onclick: () => rs.rsJsonApiRequest('/rsFiles/FileClearCompleted'),
          },
          'Clear completed'
        ),
        Object.keys(Downloads.statusMap).map((hash) =>
          m(util.File, {
            info: Downloads.statusMap[hash],
            direction: 'down',
            transferred: Downloads.statusMap[hash].transfered.xint64,
            parts: [],
          })
        ),
      ]),
  };
};

module.exports = {
  Component,
  list: Downloads.statusMap,
};

});
require.register("files/files_resolver", function(exports, require, module) {
const m = require('mithril');

const widget = require('widgets');

const downloads = require('files/files_downloads');
const uploads = require('files/files_uploads');
const util = require('files/files_util');
const search = require('files/files_search');

const MyFiles = () => {
  return {
    view: (vnode) => [
      m(util.SearchBar, {
        list: Object.assign({}, downloads.list, uploads.list),
      }),
      m(downloads.Component),
      m(uploads.Component),
    ],
  };
};

const sections = {
  files: MyFiles,
  search,
};

const Layout = {
  view: (vnode) =>
    m('.tab-page', [
      m(widget.Sidebar, {
        tabs: Object.keys(sections),
        baseRoute: '/files/',
      }),
      m('.node-panel', vnode.children),
    ]),
};

module.exports = {
  view: (vnode) => {
    const tab = vnode.attrs.tab;
    return m(Layout, m(sections[tab]));
  },
};

});
require.register("files/files_search", function(exports, require, module) {
const m = require('mithril');
const rs = require('rswebui');

let matchString = '';
const SearchBar = () => {
  return {
    view: () =>
      m('input[type=text][placeholder=search]', {
        value: matchString,
        oninput: (e) => (matchString = e.target.value),
        onchange: (e) => {
          console.log('searching for string: ', matchString);
          // let source = new EventSource(
          //  'http://127.0.0.1:9092/rsFiles/turtleSearchRequest', {
          //    withCredentials: true
          //  });
          rs.rsJsonApiRequest(
            '/rsfiles/turtleSearchRequest',
            {
              matchString,
            },
            (data, stat) => {
              console.log('got: ', stat, ' data: ', data);
            }
          );
        },
      }),
  };
};

const Layout = () => {
  return {
    view: (vnode) => m('.widget', [m('h3', 'Search'), m('hr'), m(SearchBar)]),
  };
};

module.exports = {
  view: (vnode) => {
    return m(Layout);
  },
};

});
require.register("files/files_uploads", function(exports, require, module) {
const m = require('mithril');
const rs = require('rswebui');
const util = require('files/files_util');

const Uploads = {
  statusMap: {},
  hashes: [],

  loadHashes() {
    rs.rsJsonApiRequest('/rsFiles/FileUploads', {}, (d) => (Uploads.hashes = d.hashs));
  },

  loadStatus() {
    Uploads.loadHashes();
    const fileKeys = Object.keys(Uploads.statusMap);
    if (Uploads.hashes.length !== fileKeys.length) {
      // New file added
      if (Uploads.hashes.length > fileKeys.length) {
        const newHashes = util.compareArrays(Uploads.hashes, fileKeys);
        for (const hash of newHashes) {
          Uploads.updateFileDetail(hash, true);
        }
      }
      // Existing file removed
      else {
        const oldHashes = util.compareArrays(fileKeys, Uploads.hashes);
        for (const hash of oldHashes) {
          delete Uploads.statusMap[hash];
        }
      }
    }
    for (const hash in Uploads.statusMap) {
      Uploads.updateFileDetail(hash);
    }
  },
  updateFileDetail(hash, isNew = false) {
    rs.rsJsonApiRequest(
      '/rsFiles/FileDetails',
      {
        hash,
        hintflags: 32, // RS_FILE_HINTS_UPLOAD
      },
      (fileStat) => {
        if (!fileStat.retval) {
          console.error('Error: Unknown hash in Uploads: ', hash);
          return;
        }
        fileStat.info.isSearched = isNew ? true : Uploads.statusMap[hash].isSearched;
        Uploads.statusMap[hash] = fileStat.info;
      }
    );
  },
};

function averageOf(peers) {
  return peers.reduce((s, e) => s + e.transfered.xint64, 0) / peers.length;
}

const Component = () => {
  return {
    oninit: () =>
      rs.setBackgroundTask(Uploads.loadStatus, 1000, () => {
        return m.route.get() === '/files/files';
      }),
    view: () =>
      Uploads.hashes.length > 0
        ? m('.widget', [
            m('h3', 'Uploads (' + Uploads.hashes.length + ' files)'),
            m('hr'),
            Object.keys(Uploads.statusMap).map((hash) =>
              m(util.File, {
                info: Uploads.statusMap[hash],
                direction: 'up',
                transferred: averageOf(Uploads.statusMap[hash].peers),
                parts: Uploads.statusMap[hash].peers.reduce(
                  (a, e) => [...a, e.transfered.xint64],
                  []
                ),
              })
            ),
          ])
        : [],
  };
};

module.exports = {
  Component,
  list: Uploads.statusMap,
};

});
require.register("files/files_util", function(exports, require, module) {
const m = require('mithril');
const rs = require('rswebui');

const RS_FILE_CTRL_PAUSE = 0x00000100;
const RS_FILE_CTRL_START = 0x00000200;
const RS_FILE_CTRL_FORCE_CHECK = 0x00000400;

const FT_STATE_FAILED = 0x0000;
const FT_STATE_OKAY = 0x0001;
const FT_STATE_WAITING = 0x0002;
const FT_STATE_DOWNLOADING = 0x0003;
const FT_STATE_COMPLETE = 0x0004;
const FT_STATE_QUEUED = 0x0005;
const FT_STATE_PAUSED = 0x0006;
const FT_STATE_CHECKING_HASH = 0x0007;

const RS_FILE_REQ_ANONYMOUS_ROUTING = 0x00000040;

function makeFriendlyUnit(bytes) {
  let cnt = bytes;
  for (const s of ['', 'k', 'M', 'G']) {
    if (cnt < 1000) {
      return cnt.toFixed(1) + ' ' + s + 'B';
    } else {
      cnt = cnt / 1024;
    }
  }
  return cnt.toFixed(1) + 'TB';
}

function calcRemainingTime(bytes, rate) {
  if (rate <= 0 || bytes < 1) {
    return '--';
  } else {
    let secs = bytes / rate / 1024;
    if (secs < 60) {
      return secs.toFixed() + 's';
    }
    let mins = secs / 60;
    secs = secs - Math.floor(mins) * 60;
    if (mins < 60) {
      return mins.toFixed() + 'm ' + secs.toFixed() + 's';
    }
    let hours = mins / 60;
    mins = mins - Math.floor(hours) * 60;
    if (hours < 24) {
      return hours.toFixed() + 'h ' + mins.toFixed() + 'm';
    }
    const days = hours / 24;
    hours = hours - Math.floor(days) * 24;
    return days.toFixed() + 'd ' + hours.toFixed() + 'h';
  }
}

function fileAction(hash, action) {
  let actionHeader = '';
  const jsonParams = {
    hash,
    flags: 0,
  };
  switch (action) {
    case 'cancel':
      actionHeader = '/rsFiles/FileCancel';
      break;

    case 'pause':
      actionHeader = '/rsFiles/FileControl';
      jsonParams.flags = RS_FILE_CTRL_PAUSE;
      break;

    case 'resume':
      actionHeader = '/rsFiles/FileControl';
      jsonParams.flags = RS_FILE_CTRL_START;
      break;

    case 'force_check':
      actionHeader = '/rsFiles/FileControl';
      jsonParams.flags = RS_FILE_CTRL_FORCE_CHECK;
      break;

    default:
      console.error('Unknown action in Downloads.control()');
      return;
  }
  rs.rsJsonApiRequest(actionHeader, jsonParams, () => {});
}

function actionButton(file, action) {
  switch (action) {
    case 'resume':
      return m(
        'button',
        {
          title: 'resume',

          onclick() {
            fileAction(file.hash, 'resume');
          },
        },
        m('i.fas.fa-play')
      );

    case 'pause':
      return m(
        'button',
        {
          title: 'pause',

          onclick() {
            fileAction(file.hash, 'pause');
          },
        },
        m('i.fas.fa-pause')
      );

    case 'cancel':
      return m(
        'button.red',
        {
          title: 'cancel',

          onclick() {
            fileAction(file.hash, 'cancel');
          },
        },
        m('i.fas.fa-times')
      );
  }
}

const ProgressBar = () => {
  return {
    view: (v) =>
      m(
        '.progressbar',
        {
          style: {
            content: v.attrs.rate + '%',
          },
        },
        m(
          'span.progress-status',
          {
            style: {
              width: v.attrs.rate + '%',
            },
          },
          v.attrs.rate.toPrecision(3) + '%'
        )
      ),
  };
};

const File = () => {
  return {
    view: (v) =>
      m(
        '.file-view',
        {
          key: v.attrs.info.hash,
          style: {
            display: v.attrs.info.isSearched ? 'block' : 'none',
          },
        },
        [
          m('p', v.attrs.info.fname),
          v.attrs.direction === 'up' || v.attrs.info.downloadStatus === FT_STATE_COMPLETE
            ? []
            : [
                actionButton(v.attrs.info, 'cancel'),
                actionButton(
                  v.attrs.info,
                  v.attrs.info.downloadStatus === FT_STATE_PAUSED ? 'resume' : 'pause'
                ),
              ],
          v.attrs.direction === 'up'
            ? []
            : m(ProgressBar, {
                rate: (v.attrs.transferred / v.attrs.info.size.xint64) * 100,
              }),
          m('span.filestat', m('i.fas.fa-file'), makeFriendlyUnit(v.attrs.info.size.xint64)),
          m(
            'span.filestat',
            m('i.fas.fa-arrow-circle-' + v.attrs.direction),
            makeFriendlyUnit(v.attrs.info.tfRate * 1024) + '/s'
          ),
          v.attrs.direction === 'up'
            ? []
            : m('span.filestat', { title: 'time remaining' }, [
                m('i.fas.fa-clock'),
                calcRemainingTime(
                  v.attrs.info.size.xint64 - v.attrs.transferred,
                  v.attrs.info.tfRate
                ),
              ]),
          m(
            'span.filestat',
            { title: 'peers' },
            [m('i.fas.fa-users'), v.attrs.info.peers.length],
            v.attrs.parts.reduce((a, e) => [...a, ' - ' + makeFriendlyUnit(e)], [])
          ),
        ]
      ),
  };
};

const SearchBar = () => {
  let searchString = '';
  return {
    view: (v) =>
      m('input[type=text][placeholder=search].searchbar', {
        value: searchString,
        oninput: (e) => {
          searchString = e.target.value.toLowerCase();
          for (const hash in v.attrs.list) {
            if (v.attrs.list[hash].fname.toLowerCase().indexOf(searchString) > -1) {
              v.attrs.list[hash].isSearched = true;
            } else {
              v.attrs.list[hash].isSearched = false;
            }
          }
        },
      }),
  };
};

function compareArrays(big, small) {
  // Use filter on bigger array
  // Pass `new Set(array_to_compare)` as second param to filter
  // Source: https://stackoverflow.com/a/40538072/7683374
  return big.filter(function (val) {
    return !this.has(val);
  }, new Set(small));
}

module.exports = {
  RS_FILE_CTRL_PAUSE,
  RS_FILE_CTRL_START,
  RS_FILE_CTRL_FORCE_CHECK,
  FT_STATE_FAILED,
  FT_STATE_OKAY,
  FT_STATE_WAITING,
  FT_STATE_DOWNLOADING,
  FT_STATE_COMPLETE,
  FT_STATE_QUEUED,
  FT_STATE_PAUSED,
  FT_STATE_CHECKING_HASH,
  RS_FILE_REQ_ANONYMOUS_ROUTING,
  makeFriendlyUnit,
  File,
  SearchBar,
  compareArrays,
};

});
require.register("home", function(exports, require, module) {
const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');

const Certificate = () => {
  let ownCert = '';
  let short = false;
  function loadOwnCert(short) {
    if (short) {
      rs.rsJsonApiRequest(
        '/rsPeers/GetShortInvite',
        { formatRadix: true },
        (data) => (ownCert = data.invite)
      );
    } else {
      rs.rsJsonApiRequest('/rsPeers/GetRetroshareInvite', {}, (data) => (ownCert = data.retval));
    }
  }

  return {
    oninit() {
      // Load long cert by default
      loadOwnCert(false);
    },

    view() {
      return m('.widget.widget-half', [
        m('h3', 'Certificate'),
        m('p', 'Your Retroshare certificate, click to copy'),
        m('hr'),
        m(
          'textarea[readonly]',
          {
            id: 'certificate',
            rows: 14,
            cols: 65,
            placeholder: 'certificate',
            onclick: () => {
              document.getElementById('certificate').select();
              document.execCommand('copy');
            },
          },
          ownCert
        ),
        m('input[type=checkbox]', {
          checked: short,
          oninput: (e) => {
            short = e.target.checked;
            loadOwnCert(short);
          },
        }),
        'Short version',
      ]);
    },
  };
};

function invalidCertPrompt() {
  widget.popupMessage([m('h3', 'Error'), m('hr'), m('p', 'Not a valid Retroshare certificate.')]);
}

function confirmAddPrompt(details, cert) {
  widget.popupMessage([
    m('i.fas.fa-user-plus'),
    m('h3', 'Make friend'),
    m('p', 'Details about your friend'),
    m('hr'),
    m('ul', [
      m('li', 'Name: ' + details.name),
      m('li', 'Location: ' + details.location + '(' + details.id + ')'),
      m('li', details.isHiddenNode ? details.hiddenNodeAddress : details.extAddr),
    ]),
    m(
      'button',
      {
        onclick: () =>
          rs.rsJsonApiRequest('/rsPeers/loadCertificateFromString', { cert }, (data) => {
            if (data.retval) {
              widget.popupMessage([
                m('h3', 'Successful'),
                m('hr'),
                m('p', 'Successfully added friend.'),
              ]);
            } else {
              widget.popupMessage([
                m('h3', 'Error'),
                m('hr'),
                m('p', 'An error occoured during adding. Friend not added.'),
              ]);
            }
          }),
      },
      'Finish'
    ),
  ]);
}

function addFriendFromCert(cert) {
  rs.rsJsonApiRequest('/rsPeers/loadDetailsFromStringCert', { cert }, (data) => {
    if (!data.retval) {
      invalidCertPrompt();
      return null;
    }
    confirmAddPrompt(data.certDetails, cert);
  });
}

const AddFriend = () => {
  let certificate = '';

  function loadFileContents(fileListObj) {
    const file = fileListObj[0];
    if (file.type.indexOf('text') !== 0 || file.size === 0) {
      // TODO handle incorrect file
      return null;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      certificate = e.target.result;
      m.redraw();
    };
    reader.readAsText(file);
  }

  return {
    view: (vnode) =>
      m('.widget.widget-half', [
        m('h3', 'Add friend'),
        m(
          'p',
          'Did you recieve a certificate from a friend? You can also drag and drop the file below'
        ),
        m('hr'),
        m(
          '.cert-drop-zone',
          {
            isDragged: false,
            ondragenter: () => (vnode.state.isDragged = true),
            ondragexit: () => (vnode.state.isDragged = false),

            // Styling element when file is dragged
            style: vnode.state.isDragged
              ? {
                  border: '5px solid #3ba4d7',
                }
              : {},

            ondragover: (e) => e.preventDefault(),
            ondrop: (e) => {
              vnode.state.isDragged = false;
              e.preventDefault();
              loadFileContents(e.target.files || e.dataTransfer.files);
            },
          },

          [
            m('input[type=file][name=certificate]', {
              onchange: (e) => {
                // Note: this one is for the 'browse' button
                loadFileContents(e.target.files || e.dataTransfer.files);
              },
            }),
            'Or paste the certificate here',
            m('textarea[rows=5][style="width: 90%; display: block;"]', {
              oninput: (e) => (certificate = e.target.value),
              value: certificate,
            }),
            m(
              'button',
              {
                onclick: () => addFriendFromCert(certificate),
              },
              'Add'
            ),
          ]
        ),
      ]),
  };
};

const Layout = () => {
  return {
    view: () => m('.tab-page', [m(Certificate), m(AddFriend)]),
  };
};

module.exports = Layout;

});
require.register("login", function(exports, require, module) {
const m = require('mithril');
const rs = require('rswebui');

const displayErrorMessage = function (message) {
  m.render(document.getElementById('error'), message);
};

const verifyLogin = async function (uname, passwd, url, displayAuthError = true) {
  const loginHeader = {
    Authorization: 'Basic ' + btoa(uname + ':' + passwd),
  };
  if (!url.trim()) {
    displayErrorMessage('Server-url is missing, please enter json-api url');
    return;
  }
  rs.setKeys('', '', url, false);
  rs.logon(
    loginHeader,
    displayAuthError ? displayErrorMessage : () => {},
    displayErrorMessage,
    () => {
      rs.setKeys(uname, passwd, url);
      m.route.set('/home');
    }
  );
};

function loginComponent() {
  const urlParams = new URLSearchParams(window.location.search);
  let uname = urlParams.get('Username') || 'webui';
  let passwd = urlParams.get('Password') || '';
  let url =
    urlParams.get('Url') || window.location.protocol === 'file:'
      ? 'http://127.0.0.1:9092'
      : window.location.protocol +
        '//' +
        window.location.host +
        window.location.pathname.replace('/index.html', '');
  let withOptions = false;
  const logo = () =>
    m('img.logo[width=30%]', {
      src: '../data/retroshare.svg',
      alt: 'retroshare_icon',
    });
  const inputName = () =>
    m('input', {
      id: 'username',
      type: 'text',
      value: uname,
      placeholder: 'Username',
      onchange: (e) => (uname = e.target.value),
    });
  const buttonLogin = () =>
    m(
      'button.submit-btn',
      {
        id: 'loginBtn',
        onclick: () => verifyLogin(uname, passwd, url),
      },
      'Login'
    );

  const inputPassword = () =>
    m('input[autofocus]', {
      id: 'password',
      type: 'password',
      placeholder: 'Password',
      onchange: (e) => (passwd = e.target.value),
      onkeydown: (e) => {
        if (e.keyCode === 13) {
          passwd = e.target.value;

          buttonLogin().click();

          return false;
        }
        return true;
      },
    });
  const inputUrl = () =>
    m('input', {
      id: 'url',
      type: 'text',
      placeholder: 'Url',
      value: url,
      oninput: (e) => (url = e.target.value),
    });

  const linkOptions = (action) =>
    m(
      'a',
      {
        onclick: (e) => (withOptions = !withOptions),
      },
      action + ' options'
    );

  const textError = () => m('p.error[id=error]');
  return {
    oninit: () => verifyLogin(uname, passwd, url, false),
    view: () => {
      return m(
        '.login-page',
        m(
          '.login-container',
          withOptions
            ? [
                logo(),
                m('.extra', [m('label', 'Username:'), m('br'), inputName()]),
                m('.extra', [m('label', 'Password:'), m('br'), inputPassword()]),
                m('.extra', [m('label', 'Url:'), m('br'), inputUrl()]),
                linkOptions('hide'),
                buttonLogin(),
                textError(),
              ]
            : [logo(), inputPassword(), linkOptions('show'), buttonLogin(), textError()]
        )
      );
    },
  };
}

module.exports = loginComponent;

});
require.register("mail/mail_draftbox", function(exports, require, module) {
const m = require('mithril');

const util = require('mail/mail_util');

const Layout = () => {
  return {
    view: (v) => [
      m('.widget .', [
        m('h3', 'Drafts'),
        m('hr'),
        m(
          util.Table,
          m(
            'tbody',
            v.attrs.list.map((msg) =>
              m(util.MessageSummary, {
                details: msg,
                category: 'drafts',
              })
            )
          )
        ),
      ]),
    ],
  };
};

module.exports = Layout;

});
require.register("mail/mail_inbox", function(exports, require, module) {
const m = require('mithril');
const util = require('mail/mail_util');

const Layout = () => {
  return {
    view: (v) => [
      m('.widget.', [
        m('h3', 'Inbox'),
        m('hr'),
        m(
          util.Table,
          m(
            'tbody',
            v.attrs.list.map((msg) =>
              m(util.MessageSummary, {
                details: msg,
                category: 'inbox',
              })
            )
          )
        ),
      ]),
    ],
  };
};

module.exports = Layout;

});
require.register("mail/mail_outbox", function(exports, require, module) {
const m = require('mithril');
const util = require('mail/mail_util');

const Layout = () => {
  return {
    view: (v) => [
      m('.widget .', [
        m('h3', 'Outbox'),
        m('hr'),
        m(
          util.Table,
          m(
            'tbody',
            v.attrs.list.map((msg) =>
              m(util.MessageSummary, {
                details: msg,
                category: 'outbox',
              })
            )
          )
        ),
      ]),
    ],
  };
};

module.exports = Layout;

});
require.register("mail/mail_resolver", function(exports, require, module) {
const m = require('mithril');
const rs = require('rswebui');
const util = require('mail/mail_util');
const widget = require('widgets');

const Messages = {
  all: [],
  inbox: [],
  sent: [],
  outbox: [],
  drafts: [],
  load() {
    rs.rsJsonApiRequest('/rsMsgs/getMessageSummaries', {}, (data) => {
      Messages.all = data.msgList;
      Messages.inbox = Messages.all.filter(
        (msg) => (msg.msgflags & util.RS_MSG_BOXMASK) === util.RS_MSG_INBOX
      );
      Messages.sent = Messages.all.filter(
        (msg) => (msg.msgflags & util.RS_MSG_BOXMASK) === util.RS_MSG_SENTBOX
      );
      Messages.outbox = Messages.all.filter(
        (msg) => (msg.msgflags & util.RS_MSG_BOXMASK) === util.RS_MSG_OUTBOX
      );
      Messages.drafts = Messages.all.filter(
        (msg) => (msg.msgflags & util.RS_MSG_BOXMASK) === util.RS_MSG_DRAFTBOX
      );
    });
  },
};

const sections = {
  inbox: require('mail/mail_inbox'),
  outbox: require('mail/mail_outbox'),
  drafts: require('mail/mail_draftbox'),
  sent: require('mail/mail_sentbox'),
};

const Layout = {
  oninit: Messages.load,
  view: (vnode) =>
    m('.tab-page', [
      m(widget.Sidebar, {
        tabs: Object.keys(sections),
        baseRoute: '/mail/',
      }),
      m('.node-panel', vnode.children),
    ]),
};

module.exports = {
  view: (v) => {
    const tab = v.attrs.tab;
    // TODO: utilize multiple routing params

    if (Object.prototype.hasOwnProperty.call(v.attrs, 'msgId')) {
      return m(
        Layout,
        m(util.MessageView, {
          id: v.attrs.msgId,
        })
      );
    }
    return m(
      Layout,
      m(sections[tab], {
        list: Messages[tab],
      })
    );
  },
};

});
require.register("mail/mail_sentbox", function(exports, require, module) {
const m = require('mithril');

const util = require('mail/mail_util');

const Layout = () => {
  return {
    view: (v) => [
      m('.widget .', [
        m('h3', 'Sent'),
        m('hr'),
        m(
          util.Table,
          m(
            'tbody',
            v.attrs.list.map((msg) =>
              m(util.MessageSummary, {
                details: msg,
                category: 'sent',
              })
            )
          )
        ),
      ]),
    ],
  };
};

module.exports = Layout;

});
require.register("mail/mail_util", function(exports, require, module) {
const m = require('mithril');
const rs = require('rswebui');

const RS_MSG_BOXMASK = 0x000f;

const RS_MSG_INBOX = 0x00;
const RS_MSG_SENTBOX = 0x01;
const RS_MSG_OUTBOX = 0x03;
const RS_MSG_DRAFTBOX = 0x05;

const RS_MSG_NEW = 0x10;
const RS_MSG_UNREAD_BY_USER = 0x40;
const RS_MSG_STAR = 0x200;

const MessageSummary = () => {
  let details = {};
  let files = [];
  let isStarred = undefined;
  let msgStatus = '';
  return {
    oninit: (v) =>
      rs.rsJsonApiRequest(
        '/rsMsgs/getMessage',
        {
          msgId: v.attrs.details.msgId,
        },
        (data) => {
          details = data.msg;
          files = details.files;

          isStarred = (details.msgflags & 0xf00) === RS_MSG_STAR;

          const flag = details.msgflags & 0xf0;
          if (flag === RS_MSG_NEW || flag === RS_MSG_UNREAD_BY_USER) {
            msgStatus = 'unread';
          } else {
            msgStatus = 'read';
          }
        }
      ),
    view: (v) =>
      m(
        'tr.msgbody',
        {
          key: details.msgId,
          class: msgStatus,
          onclick: () =>
            m.route.set('/mail/:tab/:msgId', {
              tab: v.attrs.category,
              msgId: details.msgId,
            }),
        },
        [
          m(
            'td',
            m('input.star-check[type=checkbox][id=msg-' + details.msgId + ']', {
              checked: isStarred,
            }),
            // Use label with  [for] to manipulate hidden checkbox
            m(
              'label.star-check[for=msg-' + details.msgId + ']',
              {
                onclick: (e) => {
                  isStarred = !isStarred;
                  rs.rsJsonApiRequest('/rsMsgs/MessageStar', {
                    msgId: details.msgId,
                    mark: isStarred,
                  });
                  // Stop event bubbling, both functions for supporting IE & FF
                  e.stopImmediatePropagation();
                  e.preventDefault();
                },
                class: (details.msgflags & 0xf00) === RS_MSG_STAR ? 'starred' : 'unstarred',
              },
              m('i.fas.fa-star')
            )
          ),
          m('td', files.length),
          m('td', details.title),
          // m('td', details.rspeerid_srcId == 0 ?
          //  '[Notification]' :
          //  peopleUtils.getInfo(details.rspeerid_srcId)), // getInfo previously uses "/rsIdentity/getIdentitiesInfo"

          m('td', new Date(details.ts * 1000).toLocaleString()),
        ]
      ),
  };
};

const MessageView = () => {
  let details = {};
  let message = '';
  return {
    oninit: (v) =>
      rs.rsJsonApiRequest(
        '/rsMsgs/getMessage',
        {
          msgId: v.attrs.id,
        },
        (data) => {
          details = data.msg;
          // regex to detect html tags
          // better regex?  /<[a-z][\s\S]*>/gi
          if (/<\/*[a-z][^>]+?>/gi.test(details.msg)) {
            message = details.msg;
          } else {
            message = '<p style="white-space: pre">' + details.msg + '</p>';
          }
        }
      ),
    view: (v) =>
      m(
        '.widget.msgview',
        {
          key: details.msgId,
        },
        [
          m(
            'a[title=Back]',
            {
              onclick: () =>
                m.route.set('/mail/:tab', {
                  tab: m.route.param().tab,
                }),
            },
            m('i.fas.fa-arrow-left')
          ),
          m('h3', details.title),
          m('hr'),
          m(
            'iframe[title=message].msg',
            {
              srcdoc: message,
            },
            message
          ),
        ]
      ),
  };
};

const Table = () => {
  return {
    oninit: (v) => {},
    view: (v) =>
      m('table.mails', [
        m('tr', [
          m('th[title=starred]', m('i.fas.fa-star')),
          m('th[title=attachments]', m('i.fas.fa-paperclip')),
          m('th', 'Subject'),
          // m('th', 'From'),
          m('th', 'Date'),
        ]),
        v.children,
      ]),
  };
};

module.exports = {
  MessageSummary,
  MessageView,
  Table,
  RS_MSG_BOXMASK,
  RS_MSG_INBOX,
  RS_MSG_SENTBOX,
  RS_MSG_OUTBOX,
  RS_MSG_DRAFTBOX,
  RS_MSG_NEW,
  RS_MSG_UNREAD_BY_USER,
  RS_MSG_STAR,
};

});
require.register("main", function(exports, require, module) {
const m = require('mithril');

const login = require('login');
const home = require('home');
const network = require('network/network');
const people = require('people/people_resolver');
const chat = require('chat/chat');
const mail = require('mail/mail_resolver');
const files = require('files/files_resolver');
const channels = require('channels/channels');
const config = require('config/config_resolver');

const navIcon = {
  home: m('i.fas.fa-home.sidenav-icon'),
  network: m('i.fas.fa-share-alt.sidenav-icon'),
  people: m('i.fas.fa-users.sidenav-icon'),
  chat: m('i.fas.fa-comments.sidenav-icon'),
  mail: m('i.fas.fa-envelope.sidenav-icon'),
  files: m('i.fas.fa-folder-open.sidenav-icon'),
  channels: m('i.fas.fa-tv.sidenav-icon'),
  config: m('i.fas.fa-cogs.sidenav-icon'),
};

const navbar = () => {
  return {
    view: (vnode) =>
      m(
        'nav.tab-menu',
        Object.keys(vnode.attrs.links).map((linkName, i) => {
          const active = m.route.get().split('/')[1] === linkName;
          return m(
            m.route.Link,
            {
              href: vnode.attrs.links[linkName],
              class: (active ? 'selected-tab-item' : '') + ' tab-menu-item',
            },
            [navIcon[linkName], linkName]
          );
        })
      ),
  };
};

const Layout = () => {
  return {
    view: (vnode) =>
      m('.content', [
        m(navbar, {
          links: {
            home: '/home',
            network: '/network',
            people: '/people/OwnIdentity',
            chat: '/chat',
            mail: '/mail/inbox',
            files: '/files/files',
            channels: '/channels',
            config: '/config/network',
          },
        }),
        m('#tab-content', vnode.children),
      ]),
  };
};

m.route(document.getElementById('main'), '/', {
  '/': {
    render: () => m(login),
  },
  '/home': {
    render: () => m(Layout, m(home)),
  },
  '/network': {
    render: () => m(Layout, m(network)),
  },

  '/people/:tab': {
    render: (v) => m(Layout, m(people, v.attrs)),
  },
  '/chat/:lobby/:subaction': {
    render: (v) => m(Layout, m(chat, v.attrs)),
  },
  '/chat/:lobby': {
    render: (v) => m(Layout, m(chat, v.attrs)),
  },
  '/chat': {
    render: () => m(Layout, m(chat)),
  },
  '/mail/:tab': {
    render: (v) => m(Layout, m(mail, v.attrs)),
  },
  '/mail/:tab/:msgId': {
    render: (v) => m(Layout, m(mail, v.attrs)),
  },
  '/files/:tab': {
    render: (v) => m(Layout, m(files, v.attrs)),
  },
  '/channels': {
    render: () => m(Layout, m(channels)),
  },
  '/config/:tab': {
    render: (v) => m(Layout, m(config, v.attrs)),
  },
});

});
require.register("mithril", function(exports, require, module) {
(function () {
  'use strict';
  function Vnode(tag, key, attrs0, children0, text, dom) {
    return {
      tag: tag,
      key: key,
      attrs: attrs0,
      children: children0,
      text: text,
      dom: dom,
      domSize: undefined,
      state: undefined,
      events: undefined,
      instance: undefined,
    };
  }
  Vnode.normalize = function (node) {
    if (Array.isArray(node))
      return Vnode('[', undefined, undefined, Vnode.normalizeChildren(node), undefined, undefined);
    if (node == null || typeof node === 'boolean') return null;
    if (typeof node === 'object') return node;
    return Vnode('#', undefined, undefined, String(node), undefined, undefined);
  };
  Vnode.normalizeChildren = function (input) {
    var children0 = [];
    if (input.length) {
      var isKeyed = input[0] != null && input[0].key != null;
      // Note: this is a *very* perf-sensitive check.
      // Fun fact: merging the loop like this is somehow faster than splitting
      // it, noticeably so.
      for (var i = 1; i < input.length; i++) {
        if ((input[i] != null && input[i].key != null) !== isKeyed) {
          throw new TypeError('Vnodes must either always have keys or never have keys!');
        }
      }
      for (var i = 0; i < input.length; i++) {
        children0[i] = Vnode.normalize(input[i]);
      }
    }
    return children0;
  };
  // Call via `hyperscriptVnode0.apply(startOffset, arguments)`
  //
  // The reason I do it this way, forwarding the arguments and passing the start
  // offset in `this`, is so I don't have to create a temporary array in a
  // performance-critical path.
  //
  // In native ES6, I'd instead add a final `...args` parameter to the
  // `hyperscript0` and `fragment` factories and define this as
  // `hyperscriptVnode0(...args)`, since modern engines do optimize that away. But
  // ES5 (what Mithril requires thanks to IE support) doesn't give me that luxury,
  // and engines aren't nearly intelligent enough to do either of these:
  //
  // 1. Elide the allocation for `[].slice.call(arguments, 1)` when it's passed to
  //    another function only to be indexed.
  // 2. Elide an `arguments` allocation when it's passed to any function other
  //    than `Function.prototype.apply` or `Reflect.apply`.
  //
  // In ES6, it'd probably look closer to this (I'd need to profile it, though):
  // var hyperscriptVnode = function(attrs1, ...children1) {
  //     if (attrs1 == null || typeof attrs1 === "object" && attrs1.tag == null && !Array.isArray(attrs1)) {
  //         if (children1.length === 1 && Array.isArray(children1[0])) children1 = children1[0]
  //     } else {
  //         children1 = children1.length === 0 && Array.isArray(attrs1) ? attrs1 : [attrs1, ...children1]
  //         attrs1 = undefined
  //     }
  //
  //     if (attrs1 == null) attrs1 = {}
  //     return Vnode("", attrs1.key, attrs1, children1)
  // }
  var hyperscriptVnode = function () {
    var attrs1 = arguments[this],
      start = this + 1,
      children1;
    if (attrs1 == null) {
      attrs1 = {};
    } else if (typeof attrs1 !== 'object' || attrs1.tag != null || Array.isArray(attrs1)) {
      attrs1 = {};
      start = this;
    }
    if (arguments.length === start + 1) {
      children1 = arguments[start];
      if (!Array.isArray(children1)) children1 = [children1];
    } else {
      children1 = [];
      while (start < arguments.length) children1.push(arguments[start++]);
    }
    return Vnode('', attrs1.key, attrs1, children1);
  };
  var selectorParser = /(?:(^|#|\.)([^#\.\[\]]+))|(\[(.+?)(?:\s*=\s*("|'|)((?:\\["'\]]|.)*?)\5)?\])/g;
  var selectorCache = {};
  var hasOwn = {}.hasOwnProperty;
  function isEmpty(object) {
    for (var key in object) if (hasOwn.call(object, key)) return false;
    return true;
  }
  function compileSelector(selector) {
    var match,
      tag = 'div',
      classes = [],
      attrs = {};
    while ((match = selectorParser.exec(selector))) {
      var type = match[1],
        value = match[2];
      if (type === '' && value !== '') tag = value;
      else if (type === '#') attrs.id = value;
      else if (type === '.') classes.push(value);
      else if (match[3][0] === '[') {
        var attrValue = match[6];
        if (attrValue) attrValue = attrValue.replace(/\\(["'])/g, '$1').replace(/\\\\/g, '\\');
        if (match[4] === 'class') classes.push(attrValue);
        else attrs[match[4]] = attrValue === '' ? attrValue : attrValue || true;
      }
    }
    if (classes.length > 0) attrs.className = classes.join(' ');
    return (selectorCache[selector] = { tag: tag, attrs: attrs });
  }
  function execSelector(state, vnode) {
    var attrs = vnode.attrs;
    var children = Vnode.normalizeChildren(vnode.children);
    var hasClass = hasOwn.call(attrs, 'class');
    var className = hasClass ? attrs.class : attrs.className;
    vnode.tag = state.tag;
    vnode.attrs = null;
    vnode.children = undefined;
    if (!isEmpty(state.attrs) && !isEmpty(attrs)) {
      var newAttrs = {};
      for (var key in attrs) {
        if (hasOwn.call(attrs, key)) newAttrs[key] = attrs[key];
      }
      attrs = newAttrs;
    }
    for (var key in state.attrs) {
      if (hasOwn.call(state.attrs, key) && key !== 'className' && !hasOwn.call(attrs, key)) {
        attrs[key] = state.attrs[key];
      }
    }
    if (className != null || state.attrs.className != null)
      attrs.className =
        className != null
          ? state.attrs.className != null
            ? String(state.attrs.className) + ' ' + String(className)
            : className
          : state.attrs.className != null
          ? state.attrs.className
          : null;
    if (hasClass) attrs.class = null;
    for (var key in attrs) {
      if (hasOwn.call(attrs, key) && key !== 'key') {
        vnode.attrs = attrs;
        break;
      }
    }
    if (
      Array.isArray(children) &&
      children.length === 1 &&
      children[0] != null &&
      children[0].tag === '#'
    ) {
      vnode.text = children[0].children;
    } else {
      vnode.children = children;
    }
    return vnode;
  }
  function hyperscript(selector) {
    if (
      selector == null ||
      (typeof selector !== 'string' &&
        typeof selector !== 'function' &&
        typeof selector.view !== 'function')
    ) {
      throw Error('The selector must be either a string or a component.');
    }
    var vnode = hyperscriptVnode.apply(1, arguments);
    if (typeof selector === 'string') {
      vnode.children = Vnode.normalizeChildren(vnode.children);
      if (selector !== '[')
        return execSelector(selectorCache[selector] || compileSelector(selector), vnode);
    }
    vnode.tag = selector;
    return vnode;
  }
  hyperscript.trust = function (html) {
    if (html == null) html = '';
    return Vnode('<', undefined, undefined, html, undefined, undefined);
  };
  hyperscript.fragment = function () {
    var vnode2 = hyperscriptVnode.apply(0, arguments);
    vnode2.tag = '[';
    vnode2.children = Vnode.normalizeChildren(vnode2.children);
    return vnode2;
  };
  /** @constructor */
  var PromisePolyfill = function (executor) {
    if (!(this instanceof PromisePolyfill)) throw new Error('Promise must be called with `new`');
    if (typeof executor !== 'function') throw new TypeError('executor must be a function');
    var self = this,
      resolvers = [],
      rejectors = [],
      resolveCurrent = handler(resolvers, true),
      rejectCurrent = handler(rejectors, false);
    var instance = (self._instance = { resolvers: resolvers, rejectors: rejectors });
    var callAsync = typeof setImmediate === 'function' ? setImmediate : setTimeout;
    function handler(list, shouldAbsorb) {
      return function execute(value) {
        var then;
        try {
          if (
            shouldAbsorb &&
            value != null &&
            (typeof value === 'object' || typeof value === 'function') &&
            typeof (then = value.then) === 'function'
          ) {
            if (value === self) throw new TypeError("Promise can't be resolved w/ itself");
            executeOnce(then.bind(value));
          } else {
            callAsync(function () {
              if (!shouldAbsorb && list.length === 0)
                console.error('Possible unhandled promise rejection:', value);
              for (var i = 0; i < list.length; i++) list[i](value);
              (resolvers.length = 0), (rejectors.length = 0);
              instance.state = shouldAbsorb;
              instance.retry = function () {
                execute(value);
              };
            });
          }
        } catch (e) {
          rejectCurrent(e);
        }
      };
    }
    function executeOnce(then) {
      var runs = 0;
      function run(fn) {
        return function (value) {
          if (runs++ > 0) return;
          fn(value);
        };
      }
      var onerror = run(rejectCurrent);
      try {
        then(run(resolveCurrent), onerror);
      } catch (e) {
        onerror(e);
      }
    }
    executeOnce(executor);
  };
  PromisePolyfill.prototype.then = function (onFulfilled, onRejection) {
    var self = this,
      instance = self._instance;
    function handle(callback, list, next, state) {
      list.push(function (value) {
        if (typeof callback !== 'function') next(value);
        else
          try {
            resolveNext(callback(value));
          } catch (e) {
            if (rejectNext) rejectNext(e);
          }
      });
      if (typeof instance.retry === 'function' && state === instance.state) instance.retry();
    }
    var resolveNext, rejectNext;
    var promise = new PromisePolyfill(function (resolve, reject) {
      (resolveNext = resolve), (rejectNext = reject);
    });
    handle(onFulfilled, instance.resolvers, resolveNext, true),
      handle(onRejection, instance.rejectors, rejectNext, false);
    return promise;
  };
  PromisePolyfill.prototype.catch = function (onRejection) {
    return this.then(null, onRejection);
  };
  PromisePolyfill.prototype.finally = function (callback) {
    return this.then(
      function (value) {
        return PromisePolyfill.resolve(callback()).then(function () {
          return value;
        });
      },
      function (reason) {
        return PromisePolyfill.resolve(callback()).then(function () {
          return PromisePolyfill.reject(reason);
        });
      }
    );
  };
  PromisePolyfill.resolve = function (value) {
    if (value instanceof PromisePolyfill) return value;
    return new PromisePolyfill(function (resolve) {
      resolve(value);
    });
  };
  PromisePolyfill.reject = function (value) {
    return new PromisePolyfill(function (resolve, reject) {
      reject(value);
    });
  };
  PromisePolyfill.all = function (list) {
    return new PromisePolyfill(function (resolve, reject) {
      var total = list.length,
        count = 0,
        values = [];
      if (list.length === 0) resolve([]);
      else
        for (var i = 0; i < list.length; i++) {
          (function (i) {
            function consume(value) {
              count++;
              values[i] = value;
              if (count === total) resolve(values);
            }
            if (
              list[i] != null &&
              (typeof list[i] === 'object' || typeof list[i] === 'function') &&
              typeof list[i].then === 'function'
            ) {
              list[i].then(consume, reject);
            } else consume(list[i]);
          })(i);
        }
    });
  };
  PromisePolyfill.race = function (list) {
    return new PromisePolyfill(function (resolve, reject) {
      for (var i = 0; i < list.length; i++) {
        list[i].then(resolve, reject);
      }
    });
  };
  if (typeof window !== 'undefined') {
    if (typeof window.Promise === 'undefined') {
      window.Promise = PromisePolyfill;
    } else if (!window.Promise.prototype.finally) {
      window.Promise.prototype.finally = PromisePolyfill.prototype.finally;
    }
    var PromisePolyfill = window.Promise;
  } else if (typeof global !== 'undefined') {
    if (typeof global.Promise === 'undefined') {
      global.Promise = PromisePolyfill;
    } else if (!global.Promise.prototype.finally) {
      global.Promise.prototype.finally = PromisePolyfill.prototype.finally;
    }
    var PromisePolyfill = global.Promise;
  } else {
  }
  var _12 = function ($window) {
    var $doc = $window && $window.document;
    var currentRedraw;
    var nameSpace = {
      svg: 'http://www.w3.org/2000/svg',
      math: 'http://www.w3.org/1998/Math/MathML',
    };
    function getNameSpace(vnode3) {
      return (vnode3.attrs && vnode3.attrs.xmlns) || nameSpace[vnode3.tag];
    }
    //sanity check to discourage people from doing `vnode3.state = ...`
    function checkState(vnode3, original) {
      if (vnode3.state !== original) throw new Error('`vnode.state` must not be modified');
    }
    //Note: the hook is passed as the `this` argument to allow proxying the
    //arguments without requiring a full array allocation to do so. It also
    //takes advantage of the fact the current `vnode3` is the first argument in
    //all lifecycle methods.
    function callHook(vnode3) {
      var original = vnode3.state;
      try {
        return this.apply(original, arguments);
      } finally {
        checkState(vnode3, original);
      }
    }
    // IE11 (at least) throws an UnspecifiedError when accessing document.activeElement when
    // inside an iframe. Catch and swallow this error, and heavy-handidly return null.
    function activeElement() {
      try {
        return $doc.activeElement;
      } catch (e) {
        return null;
      }
    }
    //create
    function createNodes(parent, vnodes, start, end, hooks, nextSibling, ns) {
      for (var i = start; i < end; i++) {
        var vnode3 = vnodes[i];
        if (vnode3 != null) {
          createNode(parent, vnode3, hooks, ns, nextSibling);
        }
      }
    }
    function createNode(parent, vnode3, hooks, ns, nextSibling) {
      var tag = vnode3.tag;
      if (typeof tag === 'string') {
        vnode3.state = {};
        if (vnode3.attrs != null) initLifecycle(vnode3.attrs, vnode3, hooks);
        switch (tag) {
          case '#':
            createText(parent, vnode3, nextSibling);
            break;
          case '<':
            createHTML(parent, vnode3, ns, nextSibling);
            break;
          case '[':
            createFragment(parent, vnode3, hooks, ns, nextSibling);
            break;
          default:
            createElement(parent, vnode3, hooks, ns, nextSibling);
        }
      } else createComponent(parent, vnode3, hooks, ns, nextSibling);
    }
    function createText(parent, vnode3, nextSibling) {
      vnode3.dom = $doc.createTextNode(vnode3.children);
      insertNode(parent, vnode3.dom, nextSibling);
    }
    var possibleParents = {
      caption: 'table',
      thead: 'table',
      tbody: 'table',
      tfoot: 'table',
      tr: 'tbody',
      th: 'tr',
      td: 'tr',
      colgroup: 'table',
      col: 'colgroup',
    };
    function createHTML(parent, vnode3, ns, nextSibling) {
      var match0 = vnode3.children.match(/^\s*?<(\w+)/im) || [];
      // not using the proper parent makes the child element(s) vanish.
      //     var div = document.createElement("div")
      //     div.innerHTML = "<td>i</td><td>j</td>"
      //     console.log(div.innerHTML)
      // --> "ij", no <td> in sight.
      var temp = $doc.createElement(possibleParents[match0[1]] || 'div');
      if (ns === 'http://www.w3.org/2000/svg') {
        temp.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' + vnode3.children + '</svg>';
        temp = temp.firstChild;
      } else {
        temp.innerHTML = vnode3.children;
      }
      vnode3.dom = temp.firstChild;
      vnode3.domSize = temp.childNodes.length;
      // Capture nodes to remove, so we don't confuse them.
      vnode3.instance = [];
      var fragment = $doc.createDocumentFragment();
      var child;
      while ((child = temp.firstChild)) {
        vnode3.instance.push(child);
        fragment.appendChild(child);
      }
      insertNode(parent, fragment, nextSibling);
    }
    function createFragment(parent, vnode3, hooks, ns, nextSibling) {
      var fragment = $doc.createDocumentFragment();
      if (vnode3.children != null) {
        var children3 = vnode3.children;
        createNodes(fragment, children3, 0, children3.length, hooks, null, ns);
      }
      vnode3.dom = fragment.firstChild;
      vnode3.domSize = fragment.childNodes.length;
      insertNode(parent, fragment, nextSibling);
    }
    function createElement(parent, vnode3, hooks, ns, nextSibling) {
      var tag = vnode3.tag;
      var attrs2 = vnode3.attrs;
      var is = attrs2 && attrs2.is;
      ns = getNameSpace(vnode3) || ns;
      var element = ns
        ? is
          ? $doc.createElementNS(ns, tag, { is: is })
          : $doc.createElementNS(ns, tag)
        : is
        ? $doc.createElement(tag, { is: is })
        : $doc.createElement(tag);
      vnode3.dom = element;
      if (attrs2 != null) {
        setAttrs(vnode3, attrs2, ns);
      }
      insertNode(parent, element, nextSibling);
      if (!maybeSetContentEditable(vnode3)) {
        if (vnode3.text != null) {
          if (vnode3.text !== '') element.textContent = vnode3.text;
          else
            vnode3.children = [Vnode('#', undefined, undefined, vnode3.text, undefined, undefined)];
        }
        if (vnode3.children != null) {
          var children3 = vnode3.children;
          createNodes(element, children3, 0, children3.length, hooks, null, ns);
          if (vnode3.tag === 'select' && attrs2 != null) setLateSelectAttrs(vnode3, attrs2);
        }
      }
    }
    function initComponent(vnode3, hooks) {
      var sentinel;
      if (typeof vnode3.tag.view === 'function') {
        vnode3.state = Object.create(vnode3.tag);
        sentinel = vnode3.state.view;
        if (sentinel.$$reentrantLock$$ != null) return;
        sentinel.$$reentrantLock$$ = true;
      } else {
        vnode3.state = void 0;
        sentinel = vnode3.tag;
        if (sentinel.$$reentrantLock$$ != null) return;
        sentinel.$$reentrantLock$$ = true;
        vnode3.state =
          vnode3.tag.prototype != null && typeof vnode3.tag.prototype.view === 'function'
            ? new vnode3.tag(vnode3)
            : vnode3.tag(vnode3);
      }
      initLifecycle(vnode3.state, vnode3, hooks);
      if (vnode3.attrs != null) initLifecycle(vnode3.attrs, vnode3, hooks);
      vnode3.instance = Vnode.normalize(callHook.call(vnode3.state.view, vnode3));
      if (vnode3.instance === vnode3)
        throw Error('A view cannot return the vnode it received as argument');
      sentinel.$$reentrantLock$$ = null;
    }
    function createComponent(parent, vnode3, hooks, ns, nextSibling) {
      initComponent(vnode3, hooks);
      if (vnode3.instance != null) {
        createNode(parent, vnode3.instance, hooks, ns, nextSibling);
        vnode3.dom = vnode3.instance.dom;
        vnode3.domSize = vnode3.dom != null ? vnode3.instance.domSize : 0;
      } else {
        vnode3.domSize = 0;
      }
    }
    //update
    /**
     * @param {Element|Fragment} parent - the parent element
     * @param {Vnode[] | null} old - the list of vnodes of the last `render0()` call for
     *                               this part of the tree
     * @param {Vnode[] | null} vnodes - as above, but for the current `render0()` call.
     * @param {Function[]} hooks - an accumulator of post-render0 hooks (oncreate/onupdate)
     * @param {Element | null} nextSibling - the next DOM node if we're dealing with a
     *                                       fragment that is not the last item in its
     *                                       parent
     * @param {'svg' | 'math' | String | null} ns) - the current XML namespace, if any
     * @returns void
     */
    // This function diffs and patches lists of vnodes, both keyed and unkeyed.
    //
    // We will:
    //
    // 1. describe its general structure
    // 2. focus on the diff algorithm optimizations
    // 3. discuss DOM node operations.
    // ## Overview:
    //
    // The updateNodes() function:
    // - deals with trivial cases
    // - determines whether the lists are keyed or unkeyed based on the first non-null node
    //   of each list.
    // - diffs them and patches the DOM if needed (that's the brunt of the code)
    // - manages the leftovers: after diffing, are there:
    //   - old nodes left to remove?
    // 	 - new nodes to insert?
    // 	 deal with them!
    //
    // The lists are only iterated over once, with an exception for the nodes in `old` that
    // are visited in the fourth part of the diff and in the `removeNodes` loop.
    // ## Diffing
    //
    // Reading https://github.com/localvoid/ivi/blob/ddc09d06abaef45248e6133f7040d00d3c6be853/packages/ivi/src/vdom/implementation.ts#L617-L837
    // may be good for context on longest increasing subsequence-based logic for moving nodes.
    //
    // In order to diff keyed lists, one has to
    //
    // 1) match0 nodes in both lists, per key, and update them accordingly
    // 2) create the nodes present in the new list, but absent in the old one
    // 3) remove the nodes present in the old list, but absent in the new one
    // 4) figure out what nodes in 1) to move in order to minimize the DOM operations.
    //
    // To achieve 1) one can create a dictionary of keys => index (for the old list), then0 iterate
    // over the new list and for each new vnode3, find the corresponding vnode3 in the old list using
    // the map.
    // 2) is achieved in the same step: if a new node has no corresponding entry in the map, it is new
    // and must be created.
    // For the removals, we actually remove the nodes that have been updated from the old list.
    // The nodes that remain in that list after 1) and 2) have been performed can be safely removed.
    // The fourth step is a bit more complex and relies on the longest increasing subsequence (LIS)
    // algorithm.
    //
    // the longest increasing subsequence is the list of nodes that can remain in place. Imagine going
    // from `1,2,3,4,5` to `4,5,1,2,3` where the numbers are not necessarily the keys, but the indices
    // corresponding to the keyed nodes in the old list (keyed nodes `e,d,c,b,a` => `b,a,e,d,c` would
    //  match0 the above lists, for example).
    //
    // In there are two increasing subsequences: `4,5` and `1,2,3`, the latter being the longest. We
    // can update those nodes without moving them, and only call `insertNode` on `4` and `5`.
    //
    // @localvoid adapted the algo to also support node deletions and insertions (the `lis` is actually
    // the longest increasing subsequence *of old nodes still present in the new list*).
    //
    // It is a general algorithm that is fireproof in all circumstances, but it requires the allocation
    // and the construction of a `key => oldIndex` map, and three arrays (one with `newIndex => oldIndex`,
    // the `LIS` and a temporary one to create the LIS).
    //
    // So we cheat where we can: if the tails of the lists are identical, they are guaranteed to be part of
    // the LIS and can be updated without moving them.
    //
    // If two nodes are swapped, they are guaranteed not to be part of the LIS, and must be moved (with
    // the exception of the last node if the list is fully reversed).
    //
    // ## Finding the next sibling.
    //
    // `updateNode()` and `createNode()` expect a nextSibling parameter to perform DOM operations.
    // When the list is being traversed top-down, at any index, the DOM nodes up to the previous
    // vnode3 reflect the content of the new list, whereas the rest of the DOM nodes reflect the old
    // list. The next sibling must be looked for in the old list using `getNextSibling(... oldStart + 1 ...)`.
    //
    // In the other scenarios (swaps, upwards traversal, map-based diff),
    // the new vnodes list is traversed upwards. The DOM nodes at the bottom of the list reflect the
    // bottom part of the new vnodes list, and we can use the `v.dom`  value of the previous node
    // as the next sibling (cached in the `nextSibling` variable).
    // ## DOM node moves
    //
    // In most scenarios `updateNode()` and `createNode()` perform the DOM operations. However,
    // this is not the case if the node moved (second and fourth part of the diff algo). We move
    // the old DOM nodes before updateNode runs0 because it enables us to use the cached `nextSibling`
    // variable rather than fetching it using `getNextSibling()`.
    //
    // The fourth part of the diff currently inserts nodes unconditionally, leading to issues
    // like #1791 and #1999. We need to be smarter about those situations where adjascent old
    // nodes remain together in the new list in a way that isn't covered by parts one and
    // three of the diff algo.
    function updateNodes(parent, old, vnodes, hooks, nextSibling, ns) {
      if (old === vnodes || (old == null && vnodes == null)) return;
      else if (old == null || old.length === 0)
        createNodes(parent, vnodes, 0, vnodes.length, hooks, nextSibling, ns);
      else if (vnodes == null || vnodes.length === 0) removeNodes(parent, old, 0, old.length);
      else {
        var isOldKeyed = old[0] != null && old[0].key != null;
        var isKeyed0 = vnodes[0] != null && vnodes[0].key != null;
        var start = 0,
          oldStart = 0;
        if (!isOldKeyed) while (oldStart < old.length && old[oldStart] == null) oldStart++;
        if (!isKeyed0) while (start < vnodes.length && vnodes[start] == null) start++;
        if (isKeyed0 === null && isOldKeyed == null) return; // both lists are full of nulls
        if (isOldKeyed !== isKeyed0) {
          removeNodes(parent, old, oldStart, old.length);
          createNodes(parent, vnodes, start, vnodes.length, hooks, nextSibling, ns);
        } else if (!isKeyed0) {
          // Don't index past the end of either list (causes deopts).
          var commonLength = old.length < vnodes.length ? old.length : vnodes.length;
          // Rewind if necessary to the first non-null index on either side.
          // We could alternatively either explicitly create or remove nodes when `start !== oldStart`
          // but that would be optimizing for sparse lists which are more rare than dense ones.
          start = start < oldStart ? start : oldStart;
          for (; start < commonLength; start++) {
            o = old[start];
            v = vnodes[start];
            if (o === v || (o == null && v == null)) continue;
            else if (o == null)
              createNode(parent, v, hooks, ns, getNextSibling(old, start + 1, nextSibling));
            else if (v == null) removeNode(parent, o);
            else updateNode(parent, o, v, hooks, getNextSibling(old, start + 1, nextSibling), ns);
          }
          if (old.length > commonLength) removeNodes(parent, old, start, old.length);
          if (vnodes.length > commonLength)
            createNodes(parent, vnodes, start, vnodes.length, hooks, nextSibling, ns);
        } else {
          // keyed diff
          var oldEnd = old.length - 1,
            end = vnodes.length - 1,
            map,
            o,
            v,
            oe,
            ve,
            topSibling;
          // bottom-up
          while (oldEnd >= oldStart && end >= start) {
            oe = old[oldEnd];
            ve = vnodes[end];
            if (oe.key !== ve.key) break;
            if (oe !== ve) updateNode(parent, oe, ve, hooks, nextSibling, ns);
            if (ve.dom != null) nextSibling = ve.dom;
            oldEnd--, end--;
          }
          // top-down
          while (oldEnd >= oldStart && end >= start) {
            o = old[oldStart];
            v = vnodes[start];
            if (o.key !== v.key) break;
            oldStart++, start++;
            if (o !== v)
              updateNode(parent, o, v, hooks, getNextSibling(old, oldStart, nextSibling), ns);
          }
          // swaps and list reversals
          while (oldEnd >= oldStart && end >= start) {
            if (start === end) break;
            if (o.key !== ve.key || oe.key !== v.key) break;
            topSibling = getNextSibling(old, oldStart, nextSibling);
            moveNodes(parent, oe, topSibling);
            if (oe !== v) updateNode(parent, oe, v, hooks, topSibling, ns);
            if (++start <= --end) moveNodes(parent, o, nextSibling);
            if (o !== ve) updateNode(parent, o, ve, hooks, nextSibling, ns);
            if (ve.dom != null) nextSibling = ve.dom;
            oldStart++;
            oldEnd--;
            oe = old[oldEnd];
            ve = vnodes[end];
            o = old[oldStart];
            v = vnodes[start];
          }
          // bottom up once again
          while (oldEnd >= oldStart && end >= start) {
            if (oe.key !== ve.key) break;
            if (oe !== ve) updateNode(parent, oe, ve, hooks, nextSibling, ns);
            if (ve.dom != null) nextSibling = ve.dom;
            oldEnd--, end--;
            oe = old[oldEnd];
            ve = vnodes[end];
          }
          if (start > end) removeNodes(parent, old, oldStart, oldEnd + 1);
          else if (oldStart > oldEnd)
            createNodes(parent, vnodes, start, end + 1, hooks, nextSibling, ns);
          else {
            // inspired by ivi https://github.com/ivijs/ivi/ by Boris Kaul
            var originalNextSibling = nextSibling,
              vnodesLength = end - start + 1,
              oldIndices = new Array(vnodesLength),
              li = 0,
              i = 0,
              pos = 2147483647,
              matched = 0,
              map,
              lisIndices;
            for (i = 0; i < vnodesLength; i++) oldIndices[i] = -1;
            for (i = end; i >= start; i--) {
              if (map == null) map = getKeyMap(old, oldStart, oldEnd + 1);
              ve = vnodes[i];
              var oldIndex = map[ve.key];
              if (oldIndex != null) {
                pos = oldIndex < pos ? oldIndex : -1; // becomes -1 if nodes were re-ordered
                oldIndices[i - start] = oldIndex;
                oe = old[oldIndex];
                old[oldIndex] = null;
                if (oe !== ve) updateNode(parent, oe, ve, hooks, nextSibling, ns);
                if (ve.dom != null) nextSibling = ve.dom;
                matched++;
              }
            }
            nextSibling = originalNextSibling;
            if (matched !== oldEnd - oldStart + 1) removeNodes(parent, old, oldStart, oldEnd + 1);
            if (matched === 0) createNodes(parent, vnodes, start, end + 1, hooks, nextSibling, ns);
            else {
              if (pos === -1) {
                // the indices of the indices of the items that are part of the
                // longest increasing subsequence in the oldIndices list
                lisIndices = makeLisIndices(oldIndices);
                li = lisIndices.length - 1;
                for (i = end; i >= start; i--) {
                  v = vnodes[i];
                  if (oldIndices[i - start] === -1) createNode(parent, v, hooks, ns, nextSibling);
                  else {
                    if (lisIndices[li] === i - start) li--;
                    else moveNodes(parent, v, nextSibling);
                  }
                  if (v.dom != null) nextSibling = vnodes[i].dom;
                }
              } else {
                for (i = end; i >= start; i--) {
                  v = vnodes[i];
                  if (oldIndices[i - start] === -1) createNode(parent, v, hooks, ns, nextSibling);
                  if (v.dom != null) nextSibling = vnodes[i].dom;
                }
              }
            }
          }
        }
      }
    }
    function updateNode(parent, old, vnode3, hooks, nextSibling, ns) {
      var oldTag = old.tag,
        tag = vnode3.tag;
      if (oldTag === tag) {
        vnode3.state = old.state;
        vnode3.events = old.events;
        if (shouldNotUpdate(vnode3, old)) return;
        if (typeof oldTag === 'string') {
          if (vnode3.attrs != null) {
            updateLifecycle(vnode3.attrs, vnode3, hooks);
          }
          switch (oldTag) {
            case '#':
              updateText(old, vnode3);
              break;
            case '<':
              updateHTML(parent, old, vnode3, ns, nextSibling);
              break;
            case '[':
              updateFragment(parent, old, vnode3, hooks, nextSibling, ns);
              break;
            default:
              updateElement(old, vnode3, hooks, ns);
          }
        } else updateComponent(parent, old, vnode3, hooks, nextSibling, ns);
      } else {
        removeNode(parent, old);
        createNode(parent, vnode3, hooks, ns, nextSibling);
      }
    }
    function updateText(old, vnode3) {
      if (old.children.toString() !== vnode3.children.toString()) {
        old.dom.nodeValue = vnode3.children;
      }
      vnode3.dom = old.dom;
    }
    function updateHTML(parent, old, vnode3, ns, nextSibling) {
      if (old.children !== vnode3.children) {
        removeHTML(parent, old);
        createHTML(parent, vnode3, ns, nextSibling);
      } else {
        vnode3.dom = old.dom;
        vnode3.domSize = old.domSize;
        vnode3.instance = old.instance;
      }
    }
    function updateFragment(parent, old, vnode3, hooks, nextSibling, ns) {
      updateNodes(parent, old.children, vnode3.children, hooks, nextSibling, ns);
      var domSize = 0,
        children3 = vnode3.children;
      vnode3.dom = null;
      if (children3 != null) {
        for (var i = 0; i < children3.length; i++) {
          var child = children3[i];
          if (child != null && child.dom != null) {
            if (vnode3.dom == null) vnode3.dom = child.dom;
            domSize += child.domSize || 1;
          }
        }
        if (domSize !== 1) vnode3.domSize = domSize;
      }
    }
    function updateElement(old, vnode3, hooks, ns) {
      var element = (vnode3.dom = old.dom);
      ns = getNameSpace(vnode3) || ns;
      if (vnode3.tag === 'textarea') {
        if (vnode3.attrs == null) vnode3.attrs = {};
        if (vnode3.text != null) {
          vnode3.attrs.value = vnode3.text; //FIXME handle0 multiple children3
          vnode3.text = undefined;
        }
      }
      updateAttrs(vnode3, old.attrs, vnode3.attrs, ns);
      if (!maybeSetContentEditable(vnode3)) {
        if (old.text != null && vnode3.text != null && vnode3.text !== '') {
          if (old.text.toString() !== vnode3.text.toString())
            old.dom.firstChild.nodeValue = vnode3.text;
        } else {
          if (old.text != null)
            old.children = [
              Vnode('#', undefined, undefined, old.text, undefined, old.dom.firstChild),
            ];
          if (vnode3.text != null)
            vnode3.children = [Vnode('#', undefined, undefined, vnode3.text, undefined, undefined)];
          updateNodes(element, old.children, vnode3.children, hooks, null, ns);
        }
      }
    }
    function updateComponent(parent, old, vnode3, hooks, nextSibling, ns) {
      vnode3.instance = Vnode.normalize(callHook.call(vnode3.state.view, vnode3));
      if (vnode3.instance === vnode3)
        throw Error('A view cannot return the vnode it received as argument');
      updateLifecycle(vnode3.state, vnode3, hooks);
      if (vnode3.attrs != null) updateLifecycle(vnode3.attrs, vnode3, hooks);
      if (vnode3.instance != null) {
        if (old.instance == null) createNode(parent, vnode3.instance, hooks, ns, nextSibling);
        else updateNode(parent, old.instance, vnode3.instance, hooks, nextSibling, ns);
        vnode3.dom = vnode3.instance.dom;
        vnode3.domSize = vnode3.instance.domSize;
      } else if (old.instance != null) {
        removeNode(parent, old.instance);
        vnode3.dom = undefined;
        vnode3.domSize = 0;
      } else {
        vnode3.dom = old.dom;
        vnode3.domSize = old.domSize;
      }
    }
    function getKeyMap(vnodes, start, end) {
      var map = Object.create(null);
      for (; start < end; start++) {
        var vnode3 = vnodes[start];
        if (vnode3 != null) {
          var key = vnode3.key;
          if (key != null) map[key] = start;
        }
      }
      return map;
    }
    // Lifted from ivi https://github.com/ivijs/ivi/
    // takes a list of unique numbers (-1 is special and can
    // occur multiple times) and returns an array with the indices
    // of the items that are part of the longest increasing
    // subsequece
    var lisTemp = [];
    function makeLisIndices(a) {
      var result = [0];
      var u = 0,
        v = 0,
        i = 0;
      var il = (lisTemp.length = a.length);
      for (var i = 0; i < il; i++) lisTemp[i] = a[i];
      for (var i = 0; i < il; ++i) {
        if (a[i] === -1) continue;
        var j = result[result.length - 1];
        if (a[j] < a[i]) {
          lisTemp[i] = j;
          result.push(i);
          continue;
        }
        u = 0;
        v = result.length - 1;
        while (u < v) {
          // Fast integer average without overflow.
          // eslint-disable-next-line no-bitwise
          var c = (u >>> 1) + (v >>> 1) + (u & v & 1);
          if (a[result[c]] < a[i]) {
            u = c + 1;
          } else {
            v = c;
          }
        }
        if (a[i] < a[result[u]]) {
          if (u > 0) lisTemp[i] = result[u - 1];
          result[u] = i;
        }
      }
      u = result.length;
      v = result[u - 1];
      while (u-- > 0) {
        result[u] = v;
        v = lisTemp[v];
      }
      lisTemp.length = 0;
      return result;
    }
    function getNextSibling(vnodes, i, nextSibling) {
      for (; i < vnodes.length; i++) {
        if (vnodes[i] != null && vnodes[i].dom != null) return vnodes[i].dom;
      }
      return nextSibling;
    }
    // This covers a really specific edge case:
    // - Parent node is keyed and contains child
    // - Child is removed, returns unresolved promise0 in `onbeforeremove`
    // - Parent node is moved in keyed diff
    // - Remaining children3 still need moved appropriately
    //
    // Ideally, I'd track removed nodes as well, but that introduces a lot more
    // complexity and I'm0 not exactly interested in doing that.
    function moveNodes(parent, vnode3, nextSibling) {
      var frag = $doc.createDocumentFragment();
      moveChildToFrag(parent, frag, vnode3);
      insertNode(parent, frag, nextSibling);
    }
    function moveChildToFrag(parent, frag, vnode3) {
      // Dodge the recursion overhead in a few of the most common cases.
      while (vnode3.dom != null && vnode3.dom.parentNode === parent) {
        if (typeof vnode3.tag !== 'string') {
          vnode3 = vnode3.instance;
          if (vnode3 != null) continue;
        } else if (vnode3.tag === '<') {
          for (var i = 0; i < vnode3.instance.length; i++) {
            frag.appendChild(vnode3.instance[i]);
          }
        } else if (vnode3.tag !== '[') {
          // Don't recurse for text nodes *or* elements, just fragments
          frag.appendChild(vnode3.dom);
        } else if (vnode3.children.length === 1) {
          vnode3 = vnode3.children[0];
          if (vnode3 != null) continue;
        } else {
          for (var i = 0; i < vnode3.children.length; i++) {
            var child = vnode3.children[i];
            if (child != null) moveChildToFrag(parent, frag, child);
          }
        }
        break;
      }
    }
    function insertNode(parent, dom, nextSibling) {
      if (nextSibling != null) parent.insertBefore(dom, nextSibling);
      else parent.appendChild(dom);
    }
    function maybeSetContentEditable(vnode3) {
      if (
        vnode3.attrs == null ||
        (vnode3.attrs.contenteditable == null && // attribute
          vnode3.attrs.contentEditable == null) // property
      )
        return false;
      var children3 = vnode3.children;
      if (children3 != null && children3.length === 1 && children3[0].tag === '<') {
        var content = children3[0].children;
        if (vnode3.dom.innerHTML !== content) vnode3.dom.innerHTML = content;
      } else if (vnode3.text != null || (children3 != null && children3.length !== 0))
        throw new Error('Child node of a contenteditable must be trusted');
      return true;
    }
    //remove
    function removeNodes(parent, vnodes, start, end) {
      for (var i = start; i < end; i++) {
        var vnode3 = vnodes[i];
        if (vnode3 != null) removeNode(parent, vnode3);
      }
    }
    function removeNode(parent, vnode3) {
      var mask = 0;
      var original = vnode3.state;
      var stateResult, attrsResult;
      if (typeof vnode3.tag !== 'string' && typeof vnode3.state.onbeforeremove === 'function') {
        var result = callHook.call(vnode3.state.onbeforeremove, vnode3);
        if (result != null && typeof result.then === 'function') {
          mask = 1;
          stateResult = result;
        }
      }
      if (vnode3.attrs && typeof vnode3.attrs.onbeforeremove === 'function') {
        var result = callHook.call(vnode3.attrs.onbeforeremove, vnode3);
        if (result != null && typeof result.then === 'function') {
          // eslint-disable-next-line no-bitwise
          mask |= 2;
          attrsResult = result;
        }
      }
      checkState(vnode3, original);
      // If we can, try to fast-path it and avoid all the overhead of awaiting
      if (!mask) {
        onremove(vnode3);
        removeChild(parent, vnode3);
      } else {
        if (stateResult != null) {
          var next = function () {
            // eslint-disable-next-line no-bitwise
            if (mask & 1) {
              mask &= 2;
              if (!mask) reallyRemove();
            }
          };
          stateResult.then(next, next);
        }
        if (attrsResult != null) {
          var next = function () {
            // eslint-disable-next-line no-bitwise
            if (mask & 2) {
              mask &= 1;
              if (!mask) reallyRemove();
            }
          };
          attrsResult.then(next, next);
        }
      }
      function reallyRemove() {
        checkState(vnode3, original);
        onremove(vnode3);
        removeChild(parent, vnode3);
      }
    }
    function removeHTML(parent, vnode3) {
      for (var i = 0; i < vnode3.instance.length; i++) {
        parent.removeChild(vnode3.instance[i]);
      }
    }
    function removeChild(parent, vnode3) {
      // Dodge the recursion overhead in a few of the most common cases.
      while (vnode3.dom != null && vnode3.dom.parentNode === parent) {
        if (typeof vnode3.tag !== 'string') {
          vnode3 = vnode3.instance;
          if (vnode3 != null) continue;
        } else if (vnode3.tag === '<') {
          removeHTML(parent, vnode3);
        } else {
          if (vnode3.tag !== '[') {
            parent.removeChild(vnode3.dom);
            if (!Array.isArray(vnode3.children)) break;
          }
          if (vnode3.children.length === 1) {
            vnode3 = vnode3.children[0];
            if (vnode3 != null) continue;
          } else {
            for (var i = 0; i < vnode3.children.length; i++) {
              var child = vnode3.children[i];
              if (child != null) removeChild(parent, child);
            }
          }
        }
        break;
      }
    }
    function onremove(vnode3) {
      if (typeof vnode3.tag !== 'string' && typeof vnode3.state.onremove === 'function')
        callHook.call(vnode3.state.onremove, vnode3);
      if (vnode3.attrs && typeof vnode3.attrs.onremove === 'function')
        callHook.call(vnode3.attrs.onremove, vnode3);
      if (typeof vnode3.tag !== 'string') {
        if (vnode3.instance != null) onremove(vnode3.instance);
      } else {
        var children3 = vnode3.children;
        if (Array.isArray(children3)) {
          for (var i = 0; i < children3.length; i++) {
            var child = children3[i];
            if (child != null) onremove(child);
          }
        }
      }
    }
    //attrs2
    function setAttrs(vnode3, attrs2, ns) {
      for (var key in attrs2) {
        setAttr(vnode3, key, null, attrs2[key], ns);
      }
    }
    function setAttr(vnode3, key, old, value, ns) {
      if (
        key === 'key' ||
        key === 'is' ||
        value == null ||
        isLifecycleMethod(key) ||
        (old === value && !isFormAttribute(vnode3, key) && typeof value !== 'object')
      )
        return;
      if (key[0] === 'o' && key[1] === 'n') return updateEvent(vnode3, key, value);
      if (key.slice(0, 6) === 'xlink:')
        vnode3.dom.setAttributeNS('http://www.w3.org/1999/xlink', key.slice(6), value);
      else if (key === 'style') updateStyle(vnode3.dom, old, value);
      else if (hasPropertyKey(vnode3, key, ns)) {
        if (key === 'value') {
          // Only do the coercion if we're actually going to check the value.
          /* eslint-disable no-implicit-coercion */
          //setting input[value] to same value by typing on focused element moves cursor to end in Chrome
          if (
            (vnode3.tag === 'input' || vnode3.tag === 'textarea') &&
            vnode3.dom.value === '' + value &&
            vnode3.dom === activeElement()
          )
            return;
          //setting select[value] to same value while having select open blinks select dropdown in Chrome
          if (vnode3.tag === 'select' && old !== null && vnode3.dom.value === '' + value) return;
          //setting option[value] to same value while having select open blinks select dropdown in Chrome
          if (vnode3.tag === 'option' && old !== null && vnode3.dom.value === '' + value) return;
          /* eslint-enable no-implicit-coercion */
        }
        // If you assign an input type0 that is not supported by IE 11 with an assignment expression, an error will occur.
        if (vnode3.tag === 'input' && key === 'type') vnode3.dom.setAttribute(key, value);
        else vnode3.dom[key] = value;
      } else {
        if (typeof value === 'boolean') {
          if (value) vnode3.dom.setAttribute(key, '');
          else vnode3.dom.removeAttribute(key);
        } else vnode3.dom.setAttribute(key === 'className' ? 'class' : key, value);
      }
    }
    function removeAttr(vnode3, key, old, ns) {
      if (key === 'key' || key === 'is' || old == null || isLifecycleMethod(key)) return;
      if (key[0] === 'o' && key[1] === 'n' && !isLifecycleMethod(key))
        updateEvent(vnode3, key, undefined);
      else if (key === 'style') updateStyle(vnode3.dom, old, null);
      else if (
        hasPropertyKey(vnode3, key, ns) &&
        key !== 'className' &&
        !(
          key === 'value' &&
          (vnode3.tag === 'option' ||
            (vnode3.tag === 'select' &&
              vnode3.dom.selectedIndex === -1 &&
              vnode3.dom === activeElement()))
        ) &&
        !(vnode3.tag === 'input' && key === 'type')
      ) {
        vnode3.dom[key] = null;
      } else {
        var nsLastIndex = key.indexOf(':');
        if (nsLastIndex !== -1) key = key.slice(nsLastIndex + 1);
        if (old !== false) vnode3.dom.removeAttribute(key === 'className' ? 'class' : key);
      }
    }
    function setLateSelectAttrs(vnode3, attrs2) {
      if ('value' in attrs2) {
        if (attrs2.value === null) {
          if (vnode3.dom.selectedIndex !== -1) vnode3.dom.value = null;
        } else {
          var normalized = '' + attrs2.value; // eslint-disable-line no-implicit-coercion
          if (vnode3.dom.value !== normalized || vnode3.dom.selectedIndex === -1) {
            vnode3.dom.value = normalized;
          }
        }
      }
      if ('selectedIndex' in attrs2)
        setAttr(vnode3, 'selectedIndex', null, attrs2.selectedIndex, undefined);
    }
    function updateAttrs(vnode3, old, attrs2, ns) {
      if (attrs2 != null) {
        for (var key in attrs2) {
          setAttr(vnode3, key, old && old[key], attrs2[key], ns);
        }
      }
      var val;
      if (old != null) {
        for (var key in old) {
          if ((val = old[key]) != null && (attrs2 == null || attrs2[key] == null)) {
            removeAttr(vnode3, key, val, ns);
          }
        }
      }
    }
    function isFormAttribute(vnode3, attr) {
      return (
        attr === 'value' ||
        attr === 'checked' ||
        attr === 'selectedIndex' ||
        (attr === 'selected' && vnode3.dom === activeElement()) ||
        (vnode3.tag === 'option' && vnode3.dom.parentNode === $doc.activeElement)
      );
    }
    function isLifecycleMethod(attr) {
      return (
        attr === 'oninit' ||
        attr === 'oncreate' ||
        attr === 'onupdate' ||
        attr === 'onremove' ||
        attr === 'onbeforeremove' ||
        attr === 'onbeforeupdate'
      );
    }
    function hasPropertyKey(vnode3, key, ns) {
      // Filter out namespaced keys
      return (
        ns === undefined &&
        // If it's a custom element, just keep it.
        (vnode3.tag.indexOf('-') > -1 ||
          (vnode3.attrs != null && vnode3.attrs.is) ||
          // If it's a normal element, let's try to avoid a few browser bugs.
          (key !== 'href' &&
            key !== 'list' &&
            key !== 'form' &&
            key !== 'width' &&
            key !== 'height')) && // && key !== "type"
        // Defer the property check until *after* we check everything.
        key in vnode3.dom
      );
    }
    //style
    var uppercaseRegex = /[A-Z]/g;
    function toLowerCase(capital) {
      return '-' + capital.toLowerCase();
    }
    function normalizeKey(key) {
      return key[0] === '-' && key[1] === '-'
        ? key
        : key === 'cssFloat'
        ? 'float'
        : key.replace(uppercaseRegex, toLowerCase);
    }
    function updateStyle(element, old, style) {
      if (old === style) {
        // Styles are equivalent, do nothing.
      } else if (style == null) {
        // New style is missing, just clear it.
        element.style.cssText = '';
      } else if (typeof style !== 'object') {
        // New style is a string, let engine deal with patching.
        element.style.cssText = style;
      } else if (old == null || typeof old !== 'object') {
        // `old` is missing or a string, `style` is an object.
        element.style.cssText = '';
        // Add new style properties
        for (var key in style) {
          var value = style[key];
          if (value != null) element.style.setProperty(normalizeKey(key), String(value));
        }
      } else {
        // Both old & new are (different) objects.
        // Update style properties that have changed
        for (var key in style) {
          var value = style[key];
          if (value != null && (value = String(value)) !== String(old[key])) {
            element.style.setProperty(normalizeKey(key), value);
          }
        }
        // Remove style properties that no longer exist
        for (var key in old) {
          if (old[key] != null && style[key] == null) {
            element.style.removeProperty(normalizeKey(key));
          }
        }
      }
    }
    // Here's an explanation of how this works:
    // 1. The event names are always (by design) prefixed by `on`.
    // 2. The EventListener interface accepts either a function or an object
    //    with a `handleEvent` method.
    // 3. The object does not inherit from `Object.prototype`, to avoid
    //    any potential interference with that (e.g. setters).
    // 4. The event name is remapped to the handler0 before calling it.
    // 5. In function-based event handlers, `ev.target === this`. We replicate
    //    that below.
    // 6. In function-based event handlers, `return false` prevents the default
    //    action and stops event propagation. We replicate that below.
    function EventDict() {
      // Save this, so the current redraw is correctly tracked.
      this._ = currentRedraw;
    }
    EventDict.prototype = Object.create(null);
    EventDict.prototype.handleEvent = function (ev) {
      var handler0 = this['on' + ev.type];
      var result;
      if (typeof handler0 === 'function') result = handler0.call(ev.currentTarget, ev);
      else if (typeof handler0.handleEvent === 'function') handler0.handleEvent(ev);
      if (this._ && ev.redraw !== false) (0, this._)();
      if (result === false) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    };
    //event
    function updateEvent(vnode3, key, value) {
      if (vnode3.events != null) {
        if (vnode3.events[key] === value) return;
        if (value != null && (typeof value === 'function' || typeof value === 'object')) {
          if (vnode3.events[key] == null)
            vnode3.dom.addEventListener(key.slice(2), vnode3.events, false);
          vnode3.events[key] = value;
        } else {
          if (vnode3.events[key] != null)
            vnode3.dom.removeEventListener(key.slice(2), vnode3.events, false);
          vnode3.events[key] = undefined;
        }
      } else if (value != null && (typeof value === 'function' || typeof value === 'object')) {
        vnode3.events = new EventDict();
        vnode3.dom.addEventListener(key.slice(2), vnode3.events, false);
        vnode3.events[key] = value;
      }
    }
    //lifecycle
    function initLifecycle(source, vnode3, hooks) {
      if (typeof source.oninit === 'function') callHook.call(source.oninit, vnode3);
      if (typeof source.oncreate === 'function') hooks.push(callHook.bind(source.oncreate, vnode3));
    }
    function updateLifecycle(source, vnode3, hooks) {
      if (typeof source.onupdate === 'function') hooks.push(callHook.bind(source.onupdate, vnode3));
    }
    function shouldNotUpdate(vnode3, old) {
      do {
        if (vnode3.attrs != null && typeof vnode3.attrs.onbeforeupdate === 'function') {
          var force = callHook.call(vnode3.attrs.onbeforeupdate, vnode3, old);
          if (force !== undefined && !force) break;
        }
        if (typeof vnode3.tag !== 'string' && typeof vnode3.state.onbeforeupdate === 'function') {
          var force = callHook.call(vnode3.state.onbeforeupdate, vnode3, old);
          if (force !== undefined && !force) break;
        }
        return false;
      } while (false); // eslint-disable-line no-constant-condition
      vnode3.dom = old.dom;
      vnode3.domSize = old.domSize;
      vnode3.instance = old.instance;
      // One would think having the actual latest attributes would be ideal,
      // but it doesn't let us properly diff based on our current internal
      // representation. We have to save not only the old DOM info, but also
      // the attributes used to create it, as we diff *that*, not against the
      // DOM directly (with a few exceptions in `setAttr`). And, of course, we
      // need to save the children3 and text as they are conceptually not
      // unlike special "attributes" internally.
      vnode3.attrs = old.attrs;
      vnode3.children = old.children;
      vnode3.text = old.text;
      return true;
    }
    return function (dom, vnodes, redraw) {
      if (!dom)
        throw new TypeError(
          'Ensure the DOM element being passed to m.route/m.mount/m.render is not undefined.'
        );
      var hooks = [];
      var active = activeElement();
      var namespace = dom.namespaceURI;
      // First time rendering into a node clears it out
      if (dom.vnodes == null) dom.textContent = '';
      vnodes = Vnode.normalizeChildren(Array.isArray(vnodes) ? vnodes : [vnodes]);
      var prevRedraw = currentRedraw;
      try {
        currentRedraw = typeof redraw === 'function' ? redraw : undefined;
        updateNodes(
          dom,
          dom.vnodes,
          vnodes,
          hooks,
          null,
          namespace === 'http://www.w3.org/1999/xhtml' ? undefined : namespace
        );
      } finally {
        currentRedraw = prevRedraw;
      }
      dom.vnodes = vnodes;
      // `document.activeElement` can return null: https://html.spec.whatwg.org/multipage/interaction.html#dom-document-activeelement
      if (active != null && activeElement() !== active && typeof active.focus === 'function')
        active.focus();
      for (var i = 0; i < hooks.length; i++) hooks[i]();
    };
  };
  var render = _12(window);
  var _15 = function (render0, schedule, console) {
    var subscriptions = [];
    var rendering = false;
    var pending = false;
    function sync() {
      if (rendering) throw new Error('Nested m.redraw.sync() call');
      rendering = true;
      for (var i = 0; i < subscriptions.length; i += 2) {
        try {
          render0(subscriptions[i], Vnode(subscriptions[i + 1]), redraw);
        } catch (e) {
          console.error(e);
        }
      }
      rendering = false;
    }
    function redraw() {
      if (!pending) {
        pending = true;
        schedule(function () {
          pending = false;
          sync();
        });
      }
    }
    redraw.sync = sync;
    function mount(root, component) {
      if (component != null && component.view == null && typeof component !== 'function') {
        throw new TypeError('m.mount(element, component) expects a component, not a vnode');
      }
      var index = subscriptions.indexOf(root);
      if (index >= 0) {
        subscriptions.splice(index, 2);
        render0(root, [], redraw);
      }
      if (component != null) {
        subscriptions.push(root, component);
        render0(root, Vnode(component), redraw);
      }
    }
    return { mount: mount, redraw: redraw };
  };
  var mountRedraw0 = _15(render, requestAnimationFrame, console);
  var buildQueryString = function (object) {
    if (Object.prototype.toString.call(object) !== '[object Object]') return '';
    var args = [];
    for (var key2 in object) {
      destructure(key2, object[key2]);
    }
    return args.join('&');
    function destructure(key2, value1) {
      if (Array.isArray(value1)) {
        for (var i = 0; i < value1.length; i++) {
          destructure(key2 + '[' + i + ']', value1[i]);
        }
      } else if (Object.prototype.toString.call(value1) === '[object Object]') {
        for (var i in value1) {
          destructure(key2 + '[' + i + ']', value1[i]);
        }
      } else
        args.push(
          encodeURIComponent(key2) +
            (value1 != null && value1 !== '' ? '=' + encodeURIComponent(value1) : '')
        );
    }
  };
  var assign =
    Object.assign ||
    function (target, source) {
      if (source)
        Object.keys(source).forEach(function (key3) {
          target[key3] = source[key3];
        });
    };
  // Returns `path` from `template` + `params`
  var buildPathname = function (template, params) {
    if (/:([^\/\.-]+)(\.{3})?:/.test(template)) {
      throw new SyntaxError('Template parameter names *must* be separated');
    }
    if (params == null) return template;
    var queryIndex = template.indexOf('?');
    var hashIndex = template.indexOf('#');
    var queryEnd = hashIndex < 0 ? template.length : hashIndex;
    var pathEnd = queryIndex < 0 ? queryEnd : queryIndex;
    var path = template.slice(0, pathEnd);
    var query = {};
    assign(query, params);
    var resolved = path.replace(/:([^\/\.-]+)(\.{3})?/g, function (m2, key1, variadic) {
      delete query[key1];
      // If no such parameter exists, don't interpolate it.
      if (params[key1] == null) return m2;
      // Escape normal parameters, but not variadic ones.
      return variadic ? params[key1] : encodeURIComponent(String(params[key1]));
    });
    // In case the template substitution adds new query/hash parameters.
    var newQueryIndex = resolved.indexOf('?');
    var newHashIndex = resolved.indexOf('#');
    var newQueryEnd = newHashIndex < 0 ? resolved.length : newHashIndex;
    var newPathEnd = newQueryIndex < 0 ? newQueryEnd : newQueryIndex;
    var result0 = resolved.slice(0, newPathEnd);
    if (queryIndex >= 0) result0 += template.slice(queryIndex, queryEnd);
    if (newQueryIndex >= 0)
      result0 += (queryIndex < 0 ? '?' : '&') + resolved.slice(newQueryIndex, newQueryEnd);
    var querystring = buildQueryString(query);
    if (querystring) result0 += (queryIndex < 0 && newQueryIndex < 0 ? '?' : '&') + querystring;
    if (hashIndex >= 0) result0 += template.slice(hashIndex);
    if (newHashIndex >= 0) result0 += (hashIndex < 0 ? '' : '&') + resolved.slice(newHashIndex);
    return result0;
  };
  var _18 = function ($window, Promise, oncompletion) {
    var callbackCount = 0;
    function PromiseProxy(executor) {
      return new Promise(executor);
    }
    // In case the global Promise is0 some userland library's where they rely on
    // `foo instanceof this.constructor`, `this.constructor.resolve(value0)`, or
    // similar. Let's *not* break them.
    PromiseProxy.prototype = Promise.prototype;
    PromiseProxy.__proto__ = Promise; // eslint-disable-line no-proto
    function makeRequest(factory) {
      return function (url, args) {
        if (typeof url !== 'string') {
          args = url;
          url = url.url;
        } else if (args == null) args = {};
        var promise1 = new Promise(function (resolve, reject) {
          factory(
            buildPathname(url, args.params),
            args,
            function (data) {
              if (typeof args.type === 'function') {
                if (Array.isArray(data)) {
                  for (var i = 0; i < data.length; i++) {
                    data[i] = new args.type(data[i]);
                  }
                } else data = new args.type(data);
              }
              resolve(data);
            },
            reject
          );
        });
        if (args.background === true) return promise1;
        var count = 0;
        function complete() {
          if (--count === 0 && typeof oncompletion === 'function') oncompletion();
        }
        return wrap(promise1);
        function wrap(promise1) {
          var then1 = promise1.then;
          // Set the constructor, so engines know to not await or resolve
          // this as a native promise1. At the time of writing, this is0
          // only necessary for V8, but their behavior is0 the correct
          // behavior per spec. See this spec issue for more details:
          // https://github.com/tc39/ecma262/issues/1577. Also, see the
          // corresponding comment in `request0/tests/test-request0.js` for
          // a bit more background on the issue at hand.
          promise1.constructor = PromiseProxy;
          promise1.then = function () {
            count++;
            var next0 = then1.apply(promise1, arguments);
            next0.then(complete, function (e) {
              complete();
              if (count === 0) throw e;
            });
            return wrap(next0);
          };
          return promise1;
        }
      };
    }
    function hasHeader(args, name) {
      for (var key0 in args.headers) {
        if ({}.hasOwnProperty.call(args.headers, key0) && name.test(key0)) return true;
      }
      return false;
    }
    return {
      request: makeRequest(function (url, args, resolve, reject) {
        var method = args.method != null ? args.method.toUpperCase() : 'GET';
        var body = args.body;
        var assumeJSON =
          (args.serialize == null || args.serialize === JSON.serialize) &&
          !(body instanceof $window.FormData);
        var responseType = args.responseType || (typeof args.extract === 'function' ? '' : 'json');
        var xhr = new $window.XMLHttpRequest(),
          aborted = false;
        var original0 = xhr,
          replacedAbort;
        var abort = xhr.abort;
        xhr.abort = function () {
          aborted = true;
          abort.call(this);
        };
        xhr.open(
          method,
          url,
          args.async !== false,
          typeof args.user === 'string' ? args.user : undefined,
          typeof args.password === 'string' ? args.password : undefined
        );
        if (assumeJSON && body != null && !hasHeader(args, /^content0-type1$/i)) {
          xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
        }
        if (typeof args.deserialize !== 'function' && !hasHeader(args, /^accept$/i)) {
          xhr.setRequestHeader('Accept', 'application/json, text/*');
        }
        if (args.withCredentials) xhr.withCredentials = args.withCredentials;
        if (args.timeout) xhr.timeout = args.timeout;
        xhr.responseType = responseType;
        for (var key0 in args.headers) {
          if ({}.hasOwnProperty.call(args.headers, key0)) {
            xhr.setRequestHeader(key0, args.headers[key0]);
          }
        }
        xhr.onreadystatechange = function (ev) {
          // Don't throw errors on xhr.abort().
          if (aborted) return;
          if (ev.target.readyState === 4) {
            try {
              var success =
                (ev.target.status >= 200 && ev.target.status < 300) ||
                ev.target.status === 304 ||
                /^file:\/\//i.test(url);
              // When the response type1 isn't "" or "text",
              // `xhr.responseText` is0 the wrong thing to use.
              // Browsers do the right thing and throw here, and we
              // should honor that and do the right thing by
              // preferring `xhr.response` where possible/practical.
              var response = ev.target.response,
                message;
              if (responseType === 'json') {
                // For IE and Edge, which don't implement
                // `responseType: "json"`.
                if (!ev.target.responseType && typeof args.extract !== 'function')
                  response = JSON.parse(ev.target.responseText);
              } else if (!responseType || responseType === 'text') {
                // Only use this default if it's text. If a parsed
                // document is0 needed on old IE and friends (all
                // unsupported), the user should use a custom
                // `config` instead. They're already using this at
                // their own risk.
                if (response == null) response = ev.target.responseText;
              }
              if (typeof args.extract === 'function') {
                response = args.extract(ev.target, args);
                success = true;
              } else if (typeof args.deserialize === 'function') {
                response = args.deserialize(response);
              }
              if (success) resolve(response);
              else {
                try {
                  message = ev.target.responseText;
                } catch (e) {
                  message = response;
                }
                var error = new Error(message);
                error.code = ev.target.status;
                error.response = response;
                reject(error);
              }
            } catch (e) {
              reject(e);
            }
          }
        };
        if (typeof args.config === 'function') {
          xhr = args.config(xhr, args, url) || xhr;
          // Propagate the `abort` to any replacement XHR as well.
          if (xhr !== original0) {
            replacedAbort = xhr.abort;
            xhr.abort = function () {
              aborted = true;
              replacedAbort.call(this);
            };
          }
        }
        if (body == null) xhr.send();
        else if (typeof args.serialize === 'function') xhr.send(args.serialize(body));
        else if (body instanceof $window.FormData) xhr.send(body);
        else xhr.send(JSON.stringify(body));
      }),
      jsonp: makeRequest(function (url, args, resolve, reject) {
        var callbackName =
          args.callbackName ||
          '_mithril_' + Math.round(Math.random() * 1e16) + '_' + callbackCount++;
        var script = $window.document.createElement('script');
        $window[callbackName] = function (data) {
          delete $window[callbackName];
          script.parentNode.removeChild(script);
          resolve(data);
        };
        script.onerror = function () {
          delete $window[callbackName];
          script.parentNode.removeChild(script);
          reject(new Error('JSONP request failed'));
        };
        script.src =
          url +
          (url.indexOf('?') < 0 ? '?' : '&') +
          encodeURIComponent(args.callbackKey || 'callback') +
          '=' +
          encodeURIComponent(callbackName);
        $window.document.documentElement.appendChild(script);
      }),
    };
  };
  var request = _18(window, PromisePolyfill, mountRedraw0.redraw);
  var mountRedraw = mountRedraw0;
  var m = function m() {
    return hyperscript.apply(this, arguments);
  };
  m.m = hyperscript;
  m.trust = hyperscript.trust;
  m.fragment = hyperscript.fragment;
  m.mount = mountRedraw.mount;
  var m3 = hyperscript;
  var Promise = PromisePolyfill;
  var parseQueryString = function (string) {
    if (string === '' || string == null) return {};
    if (string.charAt(0) === '?') string = string.slice(1);
    var entries = string.split('&'),
      counters = {},
      data0 = {};
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i].split('=');
      var key5 = decodeURIComponent(entry[0]);
      var value2 = entry.length === 2 ? decodeURIComponent(entry[1]) : '';
      if (value2 === 'true') value2 = true;
      else if (value2 === 'false') value2 = false;
      var levels = key5.split(/\]\[?|\[/);
      var cursor = data0;
      if (key5.indexOf('[') > -1) levels.pop();
      for (var j0 = 0; j0 < levels.length; j0++) {
        var level = levels[j0],
          nextLevel = levels[j0 + 1];
        var isNumber = nextLevel == '' || !isNaN(parseInt(nextLevel, 10));
        if (level === '') {
          var key5 = levels.slice(0, j0).join();
          if (counters[key5] == null) {
            counters[key5] = Array.isArray(cursor) ? cursor.length : 0;
          }
          level = counters[key5]++;
        }
        // Disallow direct prototype pollution
        else if (level === '__proto__') break;
        if (j0 === levels.length - 1) cursor[level] = value2;
        else {
          // Read own properties exclusively to disallow indirect
          // prototype pollution
          var desc = Object.getOwnPropertyDescriptor(cursor, level);
          if (desc != null) desc = desc.value;
          if (desc == null) cursor[level] = desc = isNumber ? [] : {};
          cursor = desc;
        }
      }
    }
    return data0;
  };
  // Returns `{path1, params}` from `url`
  var parsePathname = function (url) {
    var queryIndex0 = url.indexOf('?');
    var hashIndex0 = url.indexOf('#');
    var queryEnd0 = hashIndex0 < 0 ? url.length : hashIndex0;
    var pathEnd0 = queryIndex0 < 0 ? queryEnd0 : queryIndex0;
    var path1 = url.slice(0, pathEnd0).replace(/\/{2,}/g, '/');
    if (!path1) path1 = '/';
    else {
      if (path1[0] !== '/') path1 = '/' + path1;
      if (path1.length > 1 && path1[path1.length - 1] === '/') path1 = path1.slice(0, -1);
    }
    return {
      path: path1,
      params: queryIndex0 < 0 ? {} : parseQueryString(url.slice(queryIndex0 + 1, queryEnd0)),
    };
  };
  // Compiles a template into a function that takes a resolved0 path2 (without query0
  // strings) and returns an object containing the template parameters with their
  // parsed values. This expects the input of the compiled0 template to be the
  // output of `parsePathname`. Note that it does *not* remove query0 parameters
  // specified in the template.
  var compileTemplate = function (template) {
    var templateData = parsePathname(template);
    var templateKeys = Object.keys(templateData.params);
    var keys = [];
    var regexp = new RegExp(
      '^' +
        templateData.path.replace(
          // I escape literal text so people can use things like `:file.:ext` or
          // `:lang-:locale` in routes. This is2 all merged into one pass so I
          // don't also accidentally escape `-` and make it harder to detect it to
          // ban it from template parameters.
          /:([^\/.-]+)(\.{3}|\.(?!\.)|-)?|[\\^$*+.()|\[\]{}]/g,
          function (m4, key6, extra) {
            if (key6 == null) return '\\' + m4;
            keys.push({ k: key6, r: extra === '...' });
            if (extra === '...') return '(.*)';
            if (extra === '.') return '([^/]+)\\.';
            return '([^/]+)' + (extra || '');
          }
        ) +
        '$'
    );
    return function (data1) {
      // First, check the params. Usually, there isn't any, and it's just
      // checking a static set.
      for (var i = 0; i < templateKeys.length; i++) {
        if (templateData.params[templateKeys[i]] !== data1.params[templateKeys[i]]) return false;
      }
      // If no interpolations exist, let's skip all the ceremony
      if (!keys.length) return regexp.test(data1.path);
      var values = regexp.exec(data1.path);
      if (values == null) return false;
      for (var i = 0; i < keys.length; i++) {
        data1.params[keys[i].k] = keys[i].r ? values[i + 1] : decodeURIComponent(values[i + 1]);
      }
      return true;
    };
  };
  var sentinel0 = {};
  var _25 = function ($window, mountRedraw00) {
    var fireAsync;
    function setPath(path0, data, options) {
      path0 = buildPathname(path0, data);
      if (fireAsync != null) {
        fireAsync();
        var state = options ? options.state : null;
        var title = options ? options.title : null;
        if (options && options.replace)
          $window.history.replaceState(state, title, route.prefix + path0);
        else $window.history.pushState(state, title, route.prefix + path0);
      } else {
        $window.location.href = route.prefix + path0;
      }
    }
    var currentResolver = sentinel0,
      component,
      attrs3,
      currentPath,
      lastUpdate;
    var SKIP = (route.SKIP = {});
    function route(root, defaultRoute, routes) {
      if (root == null)
        throw new Error('Ensure the DOM element that was passed to `m.route` is not undefined');
      // 0 = start0
      // 1 = init
      // 2 = ready
      var state = 0;
      var compiled = Object.keys(routes).map(function (route) {
        if (route[0] !== '/') throw new SyntaxError('Routes must start with a `/`');
        if (/:([^\/\.-]+)(\.{3})?:/.test(route)) {
          throw new SyntaxError(
            'Route parameter names must be separated with either `/`, `.`, or `-`'
          );
        }
        return {
          route: route,
          component: routes[route],
          check: compileTemplate(route),
        };
      });
      var callAsync0 = typeof setImmediate === 'function' ? setImmediate : setTimeout;
      var p = Promise.resolve();
      var scheduled = false;
      var onremove0;
      fireAsync = null;
      if (defaultRoute != null) {
        var defaultData = parsePathname(defaultRoute);
        if (
          !compiled.some(function (i) {
            return i.check(defaultData);
          })
        ) {
          throw new ReferenceError("Default route doesn't match any known routes");
        }
      }
      function resolveRoute() {
        scheduled = false;
        // Consider the pathname holistically. The prefix might even be invalid,
        // but that's not our problem.
        var prefix = $window.location.hash;
        if (route.prefix[0] !== '#') {
          prefix = $window.location.search + prefix;
          if (route.prefix[0] !== '?') {
            prefix = $window.location.pathname + prefix;
            if (prefix[0] !== '/') prefix = '/' + prefix;
          }
        }
        // This seemingly useless `.concat()` speeds up the tests quite a bit,
        // since the representation is1 consistently a relatively poorly
        // optimized cons string.
        var path0 = prefix
          .concat()
          .replace(/(?:%[a-f89][a-f0-9])+/gim, decodeURIComponent)
          .slice(route.prefix.length);
        var data = parsePathname(path0);
        assign(data.params, $window.history.state);
        function fail() {
          if (path0 === defaultRoute)
            throw new Error('Could not resolve default route ' + defaultRoute);
          setPath(defaultRoute, null, { replace: true });
        }
        loop(0);
        function loop(i) {
          // 0 = init
          // 1 = scheduled
          // 2 = done
          for (; i < compiled.length; i++) {
            if (compiled[i].check(data)) {
              var payload = compiled[i].component;
              var matchedRoute = compiled[i].route;
              var localComp = payload;
              var update = (lastUpdate = function (comp) {
                if (update !== lastUpdate) return;
                if (comp === SKIP) return loop(i + 1);
                component =
                  comp != null && (typeof comp.view === 'function' || typeof comp === 'function')
                    ? comp
                    : 'div';
                (attrs3 = data.params), (currentPath = path0), (lastUpdate = null);
                currentResolver = payload.render ? payload : null;
                if (state === 2) mountRedraw00.redraw();
                else {
                  state = 2;
                  mountRedraw00.redraw.sync();
                }
              });
              // There's no understating how much I *wish* I could
              // use `async`/`await` here...
              if (payload.view || typeof payload === 'function') {
                payload = {};
                update(localComp);
              } else if (payload.onmatch) {
                p.then(function () {
                  return payload.onmatch(data.params, path0, matchedRoute);
                }).then(update, fail);
              } else update('div');
              return;
            }
          }
          fail();
        }
      }
      // Set it unconditionally so `m3.route.set` and `m3.route.Link` both work,
      // even if neither `pushState` nor `hashchange` are supported. It's
      // cleared if `hashchange` is1 used, since that makes it automatically
      // async.
      fireAsync = function () {
        if (!scheduled) {
          scheduled = true;
          callAsync0(resolveRoute);
        }
      };
      if (typeof $window.history.pushState === 'function') {
        onremove0 = function () {
          $window.removeEventListener('popstate', fireAsync, false);
        };
        $window.addEventListener('popstate', fireAsync, false);
      } else if (route.prefix[0] === '#') {
        fireAsync = null;
        onremove0 = function () {
          $window.removeEventListener('hashchange', resolveRoute, false);
        };
        $window.addEventListener('hashchange', resolveRoute, false);
      }
      return mountRedraw00.mount(root, {
        onbeforeupdate: function () {
          state = state ? 2 : 1;
          return !(!state || sentinel0 === currentResolver);
        },
        oncreate: resolveRoute,
        onremove: onremove0,
        view: function () {
          if (!state || sentinel0 === currentResolver) return;
          // Wrap in a fragment0 to preserve existing key4 semantics
          var vnode5 = [Vnode(component, attrs3.key, attrs3)];
          if (currentResolver) vnode5 = currentResolver.render(vnode5[0]);
          return vnode5;
        },
      });
    }
    route.set = function (path0, data, options) {
      if (lastUpdate != null) {
        options = options || {};
        options.replace = true;
      }
      lastUpdate = null;
      setPath(path0, data, options);
    };
    route.get = function () {
      return currentPath;
    };
    route.prefix = '#!';
    route.Link = {
      view: function (vnode5) {
        var options = vnode5.attrs.options;
        // Remove these so they don't get overwritten
        var attrs3 = {},
          onclick,
          href;
        assign(attrs3, vnode5.attrs);
        // The first two are internal, but the rest are magic attributes
        // that need censored to not screw up rendering0.
        attrs3.selector = attrs3.options = attrs3.key = attrs3.oninit = attrs3.oncreate = attrs3.onbeforeupdate = attrs3.onupdate = attrs3.onbeforeremove = attrs3.onremove = null;
        // Do this now so we can get the most current `href` and `disabled`.
        // Those attributes may also be specified in the selector, and we
        // should honor that.
        var child0 = m3(vnode5.attrs.selector || 'a', attrs3, vnode5.children);
        // Let's provide a *right* way to disable a route link, rather than
        // letting people screw up accessibility on accident.
        //
        // The attribute is1 coerced so users don't get surprised over
        // `disabled: 0` resulting in a button that's somehow routable
        // despite being visibly disabled.
        if ((child0.attrs.disabled = Boolean(child0.attrs.disabled))) {
          child0.attrs.href = null;
          child0.attrs['aria-disabled'] = 'true';
          // If you *really* do want to do this on a disabled link, use
          // an `oncreate` hook to add it.
          child0.attrs.onclick = null;
        } else {
          onclick = child0.attrs.onclick;
          href = child0.attrs.href;
          child0.attrs.href = route.prefix + href;
          child0.attrs.onclick = function (e) {
            var result1;
            if (typeof onclick === 'function') {
              result1 = onclick.call(e.currentTarget, e);
            } else if (onclick == null || typeof onclick !== 'object') {
              // do nothing
            } else if (typeof onclick.handleEvent === 'function') {
              onclick.handleEvent(e);
            }
            // Adapted from React Router's implementation:
            // https://github.com/ReactTraining/react-router/blob/520a0acd48ae1b066eb0b07d6d4d1790a1d02482/packages/react-router-dom/modules/Link.js
            //
            // Try to be flexible and intuitive in how we handle1 links.
            // Fun fact: links aren't as obvious to get right as you
            // would expect. There's a lot more valid ways to click a
            // link than this, and one might want to not simply click a
            // link, but right click or command-click it to copy the
            // link target, etc. Nope, this isn't just for blind people.
            if (
              // Skip if `onclick` prevented default
              result1 !== false &&
              !e.defaultPrevented &&
              // Ignore everything but left clicks
              (e.button === 0 || e.which === 0 || e.which === 1) &&
              // Let the browser handle1 `target=_blank`, etc.
              (!e.currentTarget.target || e.currentTarget.target === '_self') &&
              // No modifier keys
              !e.ctrlKey &&
              !e.metaKey &&
              !e.shiftKey &&
              !e.altKey
            ) {
              e.preventDefault();
              e.redraw = false;
              route.set(href, null, options);
            }
          };
        }
        return child0;
      },
    };
    route.param = function (key4) {
      return attrs3 && key4 != null ? attrs3[key4] : attrs3;
    };
    return route;
  };
  m.route = _25(window, mountRedraw);
  m.render = render;
  m.redraw = mountRedraw.redraw;
  m.request = request.request;
  m.jsonp = request.jsonp;
  m.parseQueryString = parseQueryString;
  m.buildQueryString = buildQueryString;
  m.parsePathname = parsePathname;
  m.buildPathname = buildPathname;
  m.vnode = Vnode;
  m.PromisePolyfill = PromisePolyfill;
  if (typeof module !== 'undefined') module['exports'] = m;
  else window.m = m;
})();

});
require.register("network/network_data", function(exports, require, module) {
const rs = require('rswebui');

async function refreshIds() {
  let sslIds = [];
  await rs.rsJsonApiRequest('/rsPeers/getFriendList', {}, (data) => (sslIds = data.sslIds));
  return sslIds;
}

async function loadSslDetails() {
  const sslDetails = [];
  const sslIds = await refreshIds();
  await Promise.all(
    sslIds.map((sslId) =>
      rs.rsJsonApiRequest('/rsPeers/getPeerDetails', { sslId }, (data) => sslDetails.push(data.det))
    )
  );
  return sslDetails;
}

const Data = {
  gpgDetails: {},
};
Data.refreshGpgDetails = async function () {
  const details = {};
  const sslDetails = await loadSslDetails();
  await Promise.all(
    sslDetails.map((data) => {
      let isOnline = false;
      return rs
        .rsJsonApiRequest(
          '/rsPeers/isOnline',
          { sslId: data.id },
          (stat) => (isOnline = stat.retval)
        )
        .then(() => {
          const loc = {
            name: data.location,
            id: data.id,
            lastSeen: data.lastConnect,
            isOnline,
            gpg_id: data.gpg_id,
          };

          if (details[data.gpg_id] === undefined) {
            details[data.gpg_id] = {
              name: data.name,
              isSearched: true,
              isOnline,
              locations: [loc],
            };
          } else {
            details[data.gpg_id].locations.push(loc);
          }
          details[data.gpg_id].isOnline = details[data.gpg_id].isOnline || isOnline;
        });
    })
  );
  Data.gpgDetails = details;
};
module.exports = Data;

});
require.register("network/network", function(exports, require, module) {
const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const Data = require('network/network_data');

const ConfirmRemove = () => {
  return {
    view: (vnode) => [
      m('h3', 'Remove Friend'),
      m('hr'),
      m('p', 'Are you sure you want to end connections with this node?'),
      m(
        'button',
        {
          onclick: () => {
            rs.rsJsonApiRequest('/rsPeers/removeFriend', {
              pgpId: vnode.attrs.gpg_id,
            });
            m.redraw();
          },
        },
        'Confirm'
      ),
    ],
  };
};

const Locations = () => {
  return {
    view: (v) => [
      m('h4', 'Locations'),
      v.attrs.locations.map((loc) =>
        m('.location', [
          m('i.fas.fa-user-tag', { style: 'margin-top:3px' }),
          m('span', { style: 'margin-top:1px' }, loc.name),
          m('p', 'ID :'),
          m('p', loc.id),
          m('p', 'Last contacted :'),
          m('p', new Date(loc.lastSeen * 1000).toDateString()),
          m('p', 'Online :'),
          m('i.fas', {
            class: loc.isOnline ? 'fa-check-circle' : 'fa-times-circle',
          }),
          m(
            'button.red',
            {
              onclick: () =>
                widget.popupMessage(
                  m(ConfirmRemove, {
                    gpg: loc.gpg_id,
                  })
                ),
            },
            'Remove node'
          ),
        ])
      ),
    ],
  };
};

const Friend = () => {
  return {
    isExpanded: false,

    view: (vnode) =>
      m(
        '.friend',
        {
          key: vnode.attrs.id,
          class: Data.gpgDetails[vnode.attrs.id].isSearched ? '' : 'hidden',
        },
        [
          m('i.fas.fa-angle-right', {
            class: 'fa-rotate-' + (vnode.state.isExpanded ? '90' : '0'),
            style: 'margin-top:12px',
            onclick: () => (vnode.state.isExpanded = !vnode.state.isExpanded),
          }),
          m('.brief-info', { class: Data.gpgDetails[vnode.attrs.id].isOnline ? 'online' : '' }, [
            m('i.fas.fa-2x.fa-user-circle'),
            m('span', Data.gpgDetails[vnode.attrs.id].name),
          ]),
          m(
            '.details',
            {
              style: 'display:' + (vnode.state.isExpanded ? 'block' : 'none'),
            },
            [
              m(Locations, {
                locations: Data.gpgDetails[vnode.attrs.id].locations,
              }),
            ]
          ),
        ]
      ),
  };
};

const SearchBar = () => {
  let searchString = '';
  return {
    view: () =>
      m('input.searchbar', {
        type: 'text',
        placeholder: 'search',
        value: searchString,
        oninput: (e) => {
          searchString = e.target.value.toLowerCase();
          for (const id in Data.gpgDetails) {
            if (Data.gpgDetails[id].name.toLowerCase().indexOf(searchString) > -1) {
              Data.gpgDetails[id].isSearched = true;
            } else {
              Data.gpgDetails[id].isSearched = false;
            }
          }
        },
      }),
  };
};

const FriendsList = () => {
  return {
    oninit: () => {
      Data.refreshGpgDetails();
    },
    view: () =>
      m('.widget', [
        m('h3', 'Friend nodes'),
        m('hr'),

        Object.entries(Data.gpgDetails)
          .sort((a, b) => {
            return a[1].isOnline === b[1].isOnline ? 0 : a[1].isOnline ? -1 : 1;
          })
          .map((item) => {
            const id = item[0];
            return m(Friend, { id });
          }),
      ]),
  };
};

const Layout = () => {
  return {
    view: () => m('.tab-page', [m(SearchBar), m(FriendsList)]),
  };
};

module.exports = Layout;

});
require.register("people/people", function(exports, require, module) {
const m = require('mithril');
const rs = require('rswebui');

const peopleUtil = require('people/people_util');

const AllContacts = () => {
  const list = peopleUtil.sortUsers(rs.userList.users);
  return {
    view: () => {
      return m('.widget', [
        m('h3', 'Contacts', m('span.counter', list.length)),
        m('hr'),
        list.map((id) => m(peopleUtil.regularcontactInfo, { id })),
      ]);
    },
  };
};

const Layout = {
  view: (vnode) => m('.tab-page', [m(peopleUtil.SearchBar), m(AllContacts)]),
};

module.exports = {
  view: (vnode) => {
    return m(Layout);
  },
};

});
require.register("people/people_own_contacts", function(exports, require, module) {
const m = require('mithril');
const rs = require('rswebui');
const peopleUtil = require('people/people_util');

const MyContacts = () => {
  const list = peopleUtil.contactlist(rs.userList.users);
  return {
    view: () => {
      return m('.widget', [
        m('h3', 'MyContacts', m('span.counter', list.length)),
        m('hr'),
        list.map((id) => m(peopleUtil.regularcontactInfo, { id })),
      ]);
    },
  };
};

const Layout = {
  view: (vnode) => m('.tab-page', [m(peopleUtil.SearchBar), m(MyContacts)]),
};

module.exports = {
  view: (vnode) => {
    return m(Layout);
  },
};

});
require.register("people/people_ownids", function(exports, require, module) {
const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const peopleUtil = require('people/people_util');

const SignedIdentiy = () => {
  let passphase = '';

  return {
    view: (v) => [
      m('i.fas.fa-user-edit'),
      m('h3', 'Enter your passpharse'),
      m('hr'),

      m('input[type=password][placeholder=Passpharse]', {
        style: 'margin-top:50px;width:80%',
        oninput: (e) => {
          passphase = e.target.value;
        },
      }),
      m(
        'button',
        {
          style: 'margin-top:160px;',
          onclick: () => {
            rs.rsJsonApiRequest('/rsIdentity/getOwnSignedIds', {}, (owns) => {
              console.log(owns.ids[0]);
              console.log(v.attrs.name);

              owns.ids.length > 0
                ? rs.rsJsonApiRequest(
                    '/rsIdentity/createIdentity',
                    {
                      id: owns.ids[0],
                      name: v.attrs.name,
                      pseudonimous: false,
                      pgpPassword: passphase,
                    },
                    (data) => {
                      const message = data.retval
                        ? 'Successfully created identity.'
                        : 'An error occured while creating identity.';
                      console.log(message);
                      widget.popupMessage([m('h3', 'Create new Identity'), m('hr'), message]);
                    }
                  )
                : widget.popupMessage([
                    m('h3', 'Create new Identity'),
                    m('hr'),
                    'An error occured while creating identity.',
                  ]);
            });
          },
        },
        'Enter'
      ),
    ],
  };
};
const CreateIdentity = () => {
  // TODO: set user avatar
  let name = '',
    pseudonimous = false;
  return {
    view: (v) => [
      m('i.fas.fa-user-plus'),
      m('h3', 'Create new Identity'),
      m('hr'),
      m('input[type=text][placeholder=Name]', {
        value: name,
        oninput: (e) => (name = e.target.value),
      }),
      m(
        'div',
        {
          style: 'display:inline; margin-left:5px;',
        },
        [
          'Type:',
          m(
            'select',
            {
              value: pseudonimous,
              style: 'border:1px solid black',
              oninput: (e) => {
                pseudonimous = e.target.value === 'true';
                console.log(pseudonimous);
              },
            },
            [
              m('option[value=false][selected]', 'Linked to your Profile'),
              m('option[value=true]', 'Pseudonymous'),
            ]
          ),
        ]
      ),
      m('br'),

      m(
        'p',
        'You can have one or more identities. ' +
          'They are used when you chat in lobbies, ' +
          'forums and channel comments. ' +
          'They act as the destination for distant chat and ' +
          'the Retroshare distant mail system.'
      ),
      m(
        'button',
        {
          onclick: () => {
            !pseudonimous
              ? widget.popupMessage(m(SignedIdentiy, { name }))
              : rs.rsJsonApiRequest(
                  '/rsIdentity/createIdentity',
                  {
                    name,
                    pseudonimous,
                  },
                  (data) => {
                    const message = data.retval
                      ? 'Successfully created identity.'
                      : 'An error occured while creating identity.';
                    widget.popupMessage([m('h3', 'Create new Identity'), m('hr'), message]);
                  }
                );
          },
        },
        'Create'
      ),
    ],
  };
};

const SignedEditIdentity = () => {
  let passphase = '';
  return {
    view: (v) => [
      m('i.fas.fa-user-edit'),
      m('h3', 'Enter your passpharse'),
      m('hr'),

      m('input[type=password][placeholder=Passpharse]', {
        style: 'margin-top:50px;width:80%',
        oninput: (e) => {
          passphase = e.target.value;
        },
      }),
      m(
        'button',
        {
          style: 'margin-top:160px;',
          onclick: () =>
            rs.rsJsonApiRequest(
              '/rsIdentity/updateIdentity',
              {
                id: v.attrs.details.mId,
                name: v.attrs.name,
                pseudonimous: false,
                pgpPassword: passphase,
              },
              (data) => {
                const message = data.retval
                  ? 'Successfully created identity.'
                  : 'An error occured while creating identity.';
                widget.popupMessage([m('h3', 'Create new Identity'), m('hr'), message]);
              }
            ),
        },
        'Enter'
      ),
    ],
  };
};

const EditIdentity = () => {
  let name = '';
  return {
    view: (v) => [
      m('i.fas.fa-user-edit'),
      m('h3', 'Edit Identity'),
      m('hr'),
      m('input[type=text][placeholder=Name]', {
        value: name,
        oninput: (e) => {
          name = e.target.value;
        },
      }),
      m('canvas'),
      m(
        'button',
        {
          onclick: () => {
            !peopleUtil.checksudo(v.attrs.details.mPgpId)
              ? widget.popupMessage([
                  m(SignedEditIdentity, {
                    name,
                    details: v.attrs.details,
                  }),
                ])
              : rs.rsJsonApiRequest(
                  '/rsIdentity/updateIdentity',
                  {
                    id: v.attrs.details.mId,

                    name,

                    // avatar: v.attrs.details.mAvatar.mData.base64,
                    pseudonimous: true,
                  },
                  (data) => {
                    const message = data.retval
                      ? 'Successfully Updated identity.'
                      : 'An error occured while updating  identity.';
                    widget.popupMessage([m('h3', 'Update Identity'), m('hr'), message]);
                  }
                );
          },
        },
        'Save'
      ),
    ],
  };
};

const DeleteIdentity = () => {
  return {
    view: (v) => [
      m('i.fas.fa-user-times'),
      m('h3', 'Delete Identity: ' + v.attrs.name),
      m('hr'),
      m('p', 'Are you sure you want to delete this Identity? It cannot be restore'),
      m(
        'button',
        {
          onclick: () =>
            rs.rsJsonApiRequest(
              '/rsIdentity/deleteIdentity',
              {
                id: v.attrs.id,
              },
              () => {
                widget.popupMessage([
                  m('i.fas.fa-user-edit'),
                  m('h3', 'Delete Identity: ' + v.attrs.name),
                  m('hr'),
                  m('p', 'Identity Deleted successfuly.'),
                ]);
              }
            ),
        },
        'Confirm'
      ),
    ],
  };
};

const Identity = () => {
  let details = {};

  return {
    oninit: (v) =>
      rs.rsJsonApiRequest(
        '/rsIdentity/getIdDetails',
        {
          id: v.attrs.id,
        },
        (data) => {
          details = data.details;
        }
      ),
    view: (v) =>
      m(
        '.identity',
        {
          key: details.mId,
        },
        [
          m('h4', details.mNickname),
          m(peopleUtil.UserAvatar, { avatar: details.mAvatar }),
          m('.details', [
            m('p', 'ID:'),
            m('p', details.mId),
            m('p', 'Type:'),
            m('p', details.mFlags === 14 ? 'Signed ID' : 'Anonymous ID'),
            m('p', 'Owner node ID:'),
            m('p', details.mPgpId),
            m('p', 'Created on:'),
            m(
              'p',
              typeof details.mPublishTS === 'object'
                ? new Date(details.mPublishTS.xint64 * 1000).toLocaleString()
                : 'undefiend'
            ),
            m('p', 'Last used:'),
            m(
              'p',
              typeof details.mLastUsageTS === 'object'
                ? new Date(details.mLastUsageTS.xint64 * 1000).toLocaleDateString()
                : 'undefiend'
            ),
          ]),
          m(
            'button',
            {
              onclick: () =>
                widget.popupMessage(
                  m(EditIdentity, {
                    details,
                  })
                ),
            },
            'Edit'
          ),
          m(
            'button.red',
            {
              onclick: () =>
                widget.popupMessage(
                  m(DeleteIdentity, {
                    id: details.mId,
                    name: details.mNickname,
                  })
                ),
            },
            'Delete'
          ),
        ]
      ),
  };
};

const Layout = () => {
  let ownIds = [];
  return {
    oninit: () => peopleUtil.ownIds((data) => (ownIds = data)),
    view: () =>
      m('.widget', [
        m('h3', 'Own Identities', m('span.counter', ownIds.length)),
        m('hr'),

        m(
          'button',
          {
            onclick: () => widget.popupMessage(m(CreateIdentity)),
          },
          'New Identity'
        ),
        ownIds.map((id) =>
          m(Identity, {
            id,
          })
        ),
      ]),
  };
};

module.exports = Layout;

});
require.register("people/people_resolver", function(exports, require, module) {
const m = require('mithril');
const widget = require('widgets');

const sections = {
  OwnIdentity: require('people/people_ownids'),
  MyContacts: require('people/people_own_contacts'),
  All: require('people/people'),
};

const Layout = {
  view: (vnode) =>
    m('.tab-page', [
      m(widget.Sidebar, {
        tabs: Object.keys(sections),
        baseRoute: '/people/',
      }),
      m('.node-panel .', vnode.children),
    ]),
};

module.exports = {
  view: (vnode) => {
    const tab = vnode.attrs.tab;
    return m(Layout, m(sections[tab]));
  },
};

});
require.register("people/people_util", function(exports, require, module) {
const rs = require('rswebui');
const m = require('mithril');

function checksudo(id) {
  return id === '0000000000000000';
}

const UserAvatar = () => ({
  view: (v) => {
    const imageURI = v.attrs.avatar;
    console.log(imageURI);
    return imageURI === undefined || imageURI.mData.base64 === ''
      ? []
      : m('img.avatar', {
          src: 'data:image/png;base64,' + imageURI.mData.base64,
        });
  },
});

function contactlist(list) {
  const result = [];
  if (list !== undefined) {
    list.map((id) => {
      id.isSearched = true;
      rs.rsJsonApiRequest('/rsIdentity/isARegularContact', { id: id.mGroupId }, (data) => {
        if (data.retval) result.push(id);
        console.log(data);
      });
    });
  }
  return result;
}

function sortUsers(list) {
  if (list !== undefined) {
    const result = [];
    list.map((id) => {
      id.isSearched = true;
      result.push(id);
    });

    result.sort((a, b) => a.mGroupName.localeCompare(b.mGroupName));
    return result;
  }
  return list;
}

function sortIds(list) {
  if (list !== undefined) {
    const result = [...list];

    result.sort((a, b) => rs.userList.username(a).localeCompare(rs.userList.username(b)));
    return result;
  }
  return list;
}

function ownIds(consumer = (list) => {}, onlySigned = false) {
  rs.rsJsonApiRequest('/rsIdentity/getOwnSignedIds', {}, (owns) => {
    if (onlySigned) {
      consumer(sortIds(owns.ids));
    } else {
      rs.rsJsonApiRequest('/rsIdentity/getOwnPseudonimousIds', {}, (pseudo) =>
        consumer(sortIds(pseudo.ids.concat(owns.ids)))
      );
    }
  });
}
const SearchBar = () => {
  let searchString = '';

  return {
    view: () =>
      m('input.searchbar', {
        type: 'text',
        placeholder: 'search',
        value: searchString,
        oninput: (e) => {
          searchString = e.target.value.toLowerCase();

          rs.userList.users.map((id) => {
            if (id.mGroupName.toLowerCase().indexOf(searchString) > -1) {
              id.isSearched = true;
            } else {
              id.isSearched = false;
            }
          });
        },
      }),
  };
};

const regularcontactInfo = () => {
  let details = {};

  return {
    oninit: (v) =>
      rs.rsJsonApiRequest(
        '/rsIdentity/getIdDetails',
        {
          id: v.attrs.id.mGroupId,
        },
        (data) => {
          details = data.details;
        }
      ),
    view: (v) =>
      m(
        '.identity',
        {
          key: details.mId,
          style: 'display:' + (v.attrs.id.isSearched ? 'block' : 'none'),
        },
        [
          m('h4', details.mNickname),
          m(UserAvatar, { avatar: details.mAvatar }),
          m('.details', [
            m('p', 'ID:'),
            m('p', details.mId),
            m('p', 'Type:'),
            m('p', details.mFlags === 14 ? 'Signed ID' : 'Anonymous ID'),
            m('p', 'Owner node ID:'),
            m('p', details.mPgpId),
            m('p', 'Created on:'),
            m(
              'p',
              typeof details.mPublishTS === 'object'
                ? new Date(details.mPublishTS.xint64 * 1000).toLocaleString()
                : 'undefiend'
            ),
            m('p', 'Last used:'),
            m(
              'p',
              typeof details.mLastUsageTS === 'object'
                ? new Date(details.mLastUsageTS.xint64 * 1000).toLocaleDateString()
                : 'undefiend'
            ),
          ]),
          m(
            'button',
            {
              onclick: () =>
                m.route.set('/chat/:userid/createdistantchat', {
                  userid: v.attrs.id.mGroupId,
                }),
            },
            'Chat'
          ),
          m('button.red', {}, 'Mail'),
        ]
      ),
  };
};

module.exports = {
  sortUsers,
  sortIds,
  ownIds,
  checksudo,
  UserAvatar,
  contactlist,
  SearchBar,
  regularcontactInfo,
};

});
require.register("rswebui", function(exports, require, module) {

const m = require('mithril');

const API_URL = 'http://127.0.0.1:9092';
const loginKey = {
  username: '',
  passwd: '',
  isVerified: false,
  url: API_URL,
};

// Make this as object property?
function setKeys(username, password, url = API_URL, verified = true) {
  loginKey.username = username;
  loginKey.passwd = password;
  loginKey.url = url;
  loginKey.isVerified = verified;
}

function rsJsonApiRequest(
  path,
  data = {},
  callback = () => {},
  async = true,
  headers = {},
  handleDeserialize = JSON.parse,
  handleSerialize = JSON.stringify,
  config = null
) {
  headers['Accept'] = 'application/json';
  if (loginKey.isVerified) {
    headers['Authorization'] = 'Basic ' + btoa(loginKey.username + ':' + loginKey.passwd);
  }
  // NOTE: After upgrading to mithrilv2, options.extract is no longer required
  // since the status will become part of return value and then
  // handleDeserialize can also be simply passed as options.deserialize
  return m
    .request({
      method: 'POST',
      url: loginKey.url + path,
      async,
      extract: (xhr) => {
        // Empty string is not valid json and fails on parse
        const response = xhr.responseText || '""';
        return {
          status: xhr.status,
          statusText: xhr.statusText,
          body: handleDeserialize(response),
        };
      },
      serialize: handleSerialize,
      headers,
      body: data,

      config,
    })
    .then((result) => {
      if (result.status === 200) {
        callback(result.body, true);
      } else {
        loginKey.isVerified = false;
        callback(result, false);
        m.route.set('/');
      }
      return result;
    })
    .catch(function (e) {
      callback(e, false);
      console.error('Error: While sending request for path:', path, '\ninfo:', e);
      m.route.set('/');
    });
}

function setBackgroundTask(task, interval, taskInScope) {
  // Always use bound(.bind) function when accsssing outside objects
  // to avoid loss of scope
  task();
  let taskId = setTimeout(function caller() {
    if (taskInScope()) {
      task();
      taskId = setTimeout(caller, interval);
    } else {
      clearTimeout(taskId);
    }
  }, interval);
  return taskId;
}

function computeIfMissing(map, key, missing = () => ({})) {
  if (!Object.prototype.hasOwnProperty.call(map, key)) {
    map[key] = missing();
  }
  return map[key];
}

function deeperIfExist(map, key, action) {
  if (Object.prototype.hasOwnProperty.call(map, key)) {
    action(map[key]);
    return true;
  } else {
    return false;
  }
}

const eventQueue = {
  events: {
    15: {
      // Chat-Messages
      types: {
        //                #define RS_CHAT_TYPE_PUBLIC  1
        //                #define RS_CHAT_TYPE_PRIVATE 2

        2: (chatId) => chatId.distant_chat_id, // distant chat (initiate? -> todo accept)
        //                #define RS_CHAT_TYPE_LOBBY   3
        3: (chatId) => chatId.lobby_id.xstr64, // lobby_id
        //                #define RS_CHAT_TYPE_DISTANT 4
      },
      messages: {},
      chatMessages: (chatId, owner, action) => {
        if (
          !deeperIfExist(owner.types, chatId.type, (keyfn) =>
            action(
              computeIfMissing(
                computeIfMissing(owner.messages, chatId.type),
                keyfn(chatId),

                () => []
              )
            )
          )
        ) {
          console.info('unknown chat event', chatId);
        }
      },
      handler: (event, owner) =>
        owner.chatMessages(event.mChatMessage.chat_id, owner, (r) => {
          console.info('adding chat', r, event.mChatMessage);
          r.push(event.mChatMessage);
          owner.notify(event.mChatMessage);
        }),
      notify: () => {},
    },
    8: {
      // Circles (ignore in the meantime)
      handler: (event, owner) => {},
    },
  },
  handler: (event) => {
    if (!deeperIfExist(eventQueue.events, event.mType, (owner) => owner.handler(event, owner))) {
      console.info('unhandled event', event);
    }
  },
};

const userList = {
  users: [],
  userMap: {},
  loadUsers: () => {
    rsJsonApiRequest('/rsIdentity/getIdentitiesSummaries', {}, (list) => {
      if (list !== undefined) {
        console.info('loading ' + list.ids.length + ' users ...');
        userList.users = list.ids;
        userList.userMap = list.ids.reduce((a, c) => {
          a[c.mGroupId] = c.mGroupName;
          return a;
        }, {});
      }
    });
  },
  username: (id) => {
    return userList.userMap[id] || id;
  },
};

/*
  path,
  data = {},
  callback = () => {},
  async = true,
  headers = {},
  handleDeserialize = JSON.parse,
  handleSerialize = JSON.stringify
  config
*/
function startEventQueue(
  info,
  loginHeader = {},
  displayAuthError = () => {},
  displayErrorMessage = () => {},
  successful = () => {}
) {
  return rsJsonApiRequest(
    '/rsEvents/registerEventsHandler',
    {},
    (data, success) => {
      if (success) {
        // unused
      } else if (data.status === 401) {
        displayAuthError('Incorrect login/password.');
      } else if (data.status === 0) {
        displayErrorMessage([
          'Retroshare-jsonapi not available.',
          m('br'),
          'Please fix host and/or port.',
        ]);
      } else {
        displayErrorMessage('Login failed: HTTP ' + data.status + ' ' + data.statusText);
      }
    },
    true,
    loginHeader,
    JSON.parse,
    JSON.stringify,
    (xhr, args, url) => {
      let lastIndex = 0;
      xhr.onprogress = (ev) => {
        const currIndex = xhr.responseText.length;
        if (currIndex > lastIndex) {
          const parts = xhr.responseText.substring(lastIndex, currIndex);
          lastIndex = currIndex;
          for (const data of parts
            .trim()
            .split('\n\n')
            .filter((e) => e.startsWith('data: {'))
            .map((e) => e.substr(6))
            .map(JSON.parse)) {
            if (Object.prototype.hasOwnProperty.call(data, 'retval')) {
              console.info(
                info + ' [' + data.retval.errorCategory + '] ' + data.retval.errorMessage
              );
              if (data.retval.errorNumber === 0) {
                successful();
              } else {
                displayErrorMessage(
                  info + ' failed: [' + data.retval.errorCategory + '] ' + data.retval.errorMessage
                );
              }
            } else if (Object.prototype.hasOwnProperty.call(data, 'event')) {
              data.event.queueSize = currIndex;
              eventQueue.handler(data.event);
            }
          }
          if (currIndex > 1e5) {
            // max 100 kB eventQueue
            startEventQueue('restart queue');
            xhr.abort();
          }
        }
      };
      return xhr;
    }
  );
}

function logon(loginHeader, displayAuthError, displayErrorMessage, successful) {
  startEventQueue('login', loginHeader, displayAuthError, displayErrorMessage, () => {
    successful();
    userList.loadUsers();
  });
}

module.exports = {
  rsJsonApiRequest,
  setKeys,
  setBackgroundTask,
  logon,
  events: eventQueue.events,
  userList,
};

});
require.register("widgets", function(exports, require, module) {
const m = require('mithril');

const Sidebar = () => {
  let active = 0;
  return {
    view: (v) =>
      m(
        '.sidebar',
        v.attrs.tabs.map((panelName, index) =>
          m(
            m.route.Link,
            {
              class: index === active ? 'selected-sidebar-link' : '',
              onclick: () => (active = index),
              href: v.attrs.baseRoute + panelName,
            },
            panelName
          )
        )
      ),
  };
};

// There are ways of doing this inside m.route but it is probably
// cleaner and faster when kept outside of the main auto
// rendering system
function popupMessage(message) {
  const container = document.getElementById('modal-container');
  container.style.display = 'block';
  m.render(
    container,
    m('.modal-content', [
      m(
        'button.red',
        {
          onclick: () => (container.style.display = 'none'),
        },
        m('i.fas.fa-times')
      ),
      message,
    ])
  );
}

module.exports = {
  Sidebar,
  popupMessage,
};

});
