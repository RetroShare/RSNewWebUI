const m = require('mithril');
const rs = require('rswebui');
const peopleUtil = require('people/people_util');
const peopleState = require('people/people_state');
const icon = require('icon');

const ConfigChat = () => {
  let defaultIdentity = '';
  let ownIdentities = [];
  let acceptChatFrom = 0; // 0 = Everyone, 1 = Contacts Only, 2 = Nobody
  let maxStorageDays = 10;

  // History states
  const historyEnable = { private: true, distant: true, lobby: true };
  const historySaveCount = { private: 500, distant: 500, lobby: 500 };

  function loadSettings() {
    // Load Own Identities
    peopleUtil.ownIds((ids) => {
      ownIdentities = ids || [];
      ownIdentities.forEach((id) => {
        peopleState.fetchIdDetails(id);
      });
      m.redraw();
    });

    // Load Default Lobby Identity
    rs.rsJsonApiRequest('/rsChats/getDefaultIdentityForChatLobby', {}, (data) => {
      if (data && data.id) {
        defaultIdentity = data.id;
        peopleState.fetchIdDetails(defaultIdentity);
        m.redraw();
      }
    });

    // Load Distant Chat Accept Permission Flags (silent error fallback)
    rs.rsJsonApiRequest('/rsChats/getDistantChatPermissionFlags', {}, (data, success) => {
      if (success && data && data.retval !== undefined) {
        acceptChatFrom = data.retval;
        m.redraw();
      }
    }, true);

    // Load Max Storage Duration (silent error fallback)
    rs.rsJsonApiRequest('/rsHistory/getMaxStorageDuration', {}, (data, success) => {
      if (success && data && data.retval !== undefined) {
        maxStorageDays = Math.round(data.retval / 86400);
        m.redraw();
      }
    }, true);

    // Load History Enables & Save Counts
    const types = [
      { key: 'private', type: 1 },
      { key: 'distant', type: 3 },
      { key: 'lobby', type: 2 },
    ];

    types.forEach(({ key, type }) => {
      rs.rsJsonApiRequest('/rsHistory/getEnable', { chat_type: type }, (data, success) => {
        if (success && data && data.retval !== undefined) {
          historyEnable[key] = data.retval;
          m.redraw();
        }
      }, true);
      rs.rsJsonApiRequest('/rsHistory/getSaveCount', { chat_type: type }, (data, success) => {
        if (success && data && data.retval !== undefined) {
          historySaveCount[key] = data.retval;
          m.redraw();
        }
      }, true);
    });
  }

  return {
    oninit: () => {
      loadSettings();
    },
    view: () => {
      const selectedDetails = defaultIdentity ? peopleState.State.gxsIdToDetailsMap[defaultIdentity] : null;

      return m('.node-config', [
        // General Chat Settings
        m('.panel', [
          m('.panel__head', m('h3', 'General Chat Settings')),
          m('.panel__body', [
            m('.config-grid', [
              m('label.cfg-label', 'Default identity for chat rooms:'),
              m('.default-id-selector', [
                m(peopleUtil.UserAvatar, {
                  avatar: selectedDetails ? selectedDetails.mAvatar : null,
                  identityId: defaultIdentity,
                  size: 24,
                }),
                m('select.cfg-select', {
                  value: defaultIdentity,
                  onchange: (e) => {
                    defaultIdentity = e.target.value;
                    rs.rsJsonApiRequest('/rsChats/setDefaultIdentityForChatLobby', { id: defaultIdentity }, () => {});
                  },
                }, [
                  m('option', { value: '' }, 'Select an identity'),
                  ownIdentities.map((id) => {
                    const det = peopleState.State.gxsIdToDetailsMap[id];
                    const nick = (det ? det.mNickname : null) || rs.userList.username(id) || id;
                    return m('option', { value: id }, nick);
                  }),
                ]),
              ]),

              m('label.cfg-label', 'Accept chat from:'),
              m('select.cfg-select', {
                value: acceptChatFrom,
                onchange: (e) => {
                  acceptChatFrom = parseInt(e.target.value);
                  rs.rsJsonApiRequest('/rsChats/setDistantChatPermissionFlags', { flags: acceptChatFrom }, () => {}, true);
                },
              }, [
                m('option', { value: 0 }, 'Everyone'),
                m('option', { value: 1 }, 'Contacts Only'),
                m('option', { value: 2 }, 'Nobody'),
              ]),
            ]),
          ]),
        ]),

        // Chat History Settings
        m('.panel', [
          m('.panel__head', m('h3', 'Chat History Settings')),
          m('.panel__body', [
            m('.storage-row', [
              m('div', [
                m('span.storage-row__title', 'Max Storage Duration'),
                m('span.storage-row__hint', 'Global expiration period for messages stored in history database'),
              ]),
              m('.storage-input-group', [
                m('input[type=number][min=1][max=365].cfg-num', {
                  value: maxStorageDays,
                  oninput: (e) => (maxStorageDays = parseInt(e.target.value) || 1),
                  onchange: () => {
                    rs.rsJsonApiRequest('/rsHistory/setMaxStorageDuration', { seconds: maxStorageDays * 86400 }, () => {}, true);
                  },
                }),
                m('span.cfg-unit', 'Days'),
              ]),
            ]),

            m('.table-container', [
              m('table.history-config-table', [
                m('thead', [
                  m('tr', [
                    m('th.col-type', 'Chat Type'),
                    m('th.col-enable', 'Enable History'),
                    m('th.col-count', 'Max Saved Messages'),
                  ]),
                ]),
                m('tbody', [
                  [
                    { label: 'Direct Chat (Private)', icon: 'user-lock', key: 'private', type: 1 },
                    { label: 'Distant Chat', icon: 'network-wired', key: 'distant', type: 3 },
                    { label: 'Chat Rooms (Lobbies)', icon: 'comments', key: 'lobby', type: 2 },
                  ].map(({ label, icon: iconName, key, type }) =>
                    m('tr', [
                      m('td.col-type', [
                        icon(iconName, { size: 18, class: 'col-type__icon' }),
                        label,
                      ]),
                      m('td.col-enable', [
                        m('input[type=checkbox]', {
                          checked: historyEnable[key],
                          oninput: (e) => {
                            historyEnable[key] = e.target.checked;
                            rs.rsJsonApiRequest('/rsHistory/setEnable', { chat_type: type, enable: historyEnable[key] }, () => {}, true);
                          },
                        }),
                      ]),
                      m('td.col-count', [
                        m('.count-group', [
                          m('input[type=number][min=0][max=50000].cfg-num', {
                            value: historySaveCount[key],
                            oninput: (e) => (historySaveCount[key] = parseInt(e.target.value) || 0),
                            onchange: () => {
                              rs.rsJsonApiRequest('/rsHistory/setSaveCount', { chat_type: type, count: historySaveCount[key] }, () => {}, true);
                            },
                          }),
                          m('span.cfg-unit', 'msgs'),
                        ]),
                      ]),
                    ])
                  ),
                ]),
              ]),
            ]),
          ]),
        ]),
      ]);
    },
  };
};

module.exports = ConfigChat;
