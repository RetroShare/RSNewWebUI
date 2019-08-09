let m = require('mithril');
let rs = require('rswebui');


const Lobby = () => {
  let info = {};
  return {
    oninit: (v) => rs.rsJsonApiRequest('/rsMsgs/getChatLobbyInfo', {
        id: v.attrs.id,
      },
      data => info = data.info,
      true, {},
      undefined,
      // Custom serializer NOTE:
      // Since id represents 64-bit int(see deserializer note below)
      // Instead of using JSON.stringify, this function directly
      // creates a json string by hand.
      // SUGGESTION: is it safe like this or should this be
      // implemented properly by using regex replace?
      (data) => '{"id":' + v.attrs.id + '}'),
    view: (v) => m('.lobby', {
      key: v.attrs.id
    }, info.lobby_name),
  };
};

const SubscribedLobbies = () => {
  lobbies = [];
  return {
    oninit: () => rs.rsJsonApiRequest('/rsMsgs/getChatLobbyList', {},
      data => lobbies = data,
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
    ),
    view: () => m('.widget', [
      m('h3', 'Subscribed chat rooms'),
      m('hr'),
      lobbies.map(id => m(Lobby, {
        id
      })),
    ]),
  };
};

const Layout = () => {
  return {
    view: vnode => m('.tab-page', [
      m(SubscribedLobbies),
    ]),
  };
};

module.exports = {
  view: (vnode) => {
    return m(Layout);
  },
};

