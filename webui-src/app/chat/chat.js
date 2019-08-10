let m = require('mithril');
let rs = require('rswebui');


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
    rs.rsJsonApiRequest('/rsMsgs/getChatLobbyList', {},
      data => data.map(id => {
        rs.rsJsonApiRequest('/rsMsgs/getChatLobbyInfo', {
            id,
          },
          detail => ChatRoomsModel.subscribedRooms[id] = detail.info,
          true, {},
          undefined,
          // Custom serializer NOTE:
          // Since id represents 64-bit int(see deserializer note below)
          // Instead of using JSON.stringify, this function directly
          // creates a json string manually.
          () => '{"id":' + id + '}')
      }),
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
};

const Lobby = () => {
  let info = {};
  return {
    oninit: (v) => info = v.attrs.info,
    view: (v) => m('.lobby', {
      key: v.attrs.id
    }, [
      m('h5', info.lobby_name),
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
      ChatRoomsModel.allRooms.map(info => m(Lobby, {
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

module.exports = {
  view: (vnode) => {
    return m(Layout);
  },
};

