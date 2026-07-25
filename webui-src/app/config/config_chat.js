const m = require('mithril');
const rs = require('rswebui');
const peopleUtil = require('people/people_util');
const peopleState = require('people/people_state');

const ConfigChat = () => {
  let defaultIdentity = '';
  let ownIdentities = [];
  let acceptChatFrom = 0; // 0 = Everyone, 1 = Contacts Only, 2 = Nobody
  let maxStorageDays = 10;

  // History states
  let historyEnable = { private: true, distant: true, lobby: true };
  let historySaveCount = { private: 500, distant: 500, lobby: 500 };

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

    // Load Distant Chat Accept Permission Flags
    rs.rsJsonApiRequest('/rsChats/getDistantChatPermissionFlags', {}, (data) => {
      if (data && data.retval !== undefined) {
        acceptChatFrom = data.retval;
        m.redraw();
      }
    });

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
        m('.widget', [
          m('.widget__heading', m('h3', 'General Chat Settings')),
          m('.widget__body', [
            m('.config-grid', { style: 'display: grid; grid-template-columns: 200px 1fr; gap: 1rem; align-items: center;' }, [
              m('label', { style: 'font-weight: 500; color: #334155;' }, 'Default identity for chat rooms:'),
              m('.default-id-selector', { style: 'display: flex; align-items: center; gap: 0.5rem;' }, [
                m(peopleUtil.UserAvatar, {
                  avatar: selectedDetails ? selectedDetails.mAvatar : null,
                  identityId: defaultIdentity,
                  size: 24,
                }),
                m('select', {
                  style: 'padding: 0.35rem 0.6rem; border-radius: 0.375rem; border: 1px solid #cbd5e1; outline: none; background: #ffffff; min-width: 240px; font-weight: 600;',
                  value: defaultIdentity,
                  onchange: (e) => {
                    defaultIdentity = e.target.value;
                    rs.rsJsonApiRequest('/rsChats/setDefaultIdentityForChatLobby', { id: defaultIdentity }, () => {});
                  },
                }, [
                  m('option', { value: '' }, '-- Select Default Identity --'),
                  ownIdentities.map((id) => {
                    const det = peopleState.State.gxsIdToDetailsMap[id];
                    const nick = (det ? det.mNickname : null) || rs.userList.username(id) || id;
                    return m('option', { value: id }, nick);
                  }),
                ]),
              ]),

              m('label', { style: 'font-weight: 500; color: #334155;' }, 'Accept chat from:'),
              m('select', {
                style: 'padding: 0.35rem 0.6rem; border-radius: 0.375rem; border: 1px solid #cbd5e1; outline: none; background: #ffffff; max-width: 320px; font-weight: 600;',
                value: acceptChatFrom,
                onchange: (e) => {
                  acceptChatFrom = parseInt(e.target.value);
                  rs.rsJsonApiRequest('/rsChats/setDistantChatPermissionFlags', { flags: acceptChatFrom }, () => {});
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
        m('.widget', [
          m('.widget__heading', m('h3', 'Chat History Settings')),
          m('.widget__body', [
            m('.config-grid', { style: 'display: flex; align-items: center; justify-content: space-between; background: #f8fafc; padding: 0.75rem 1rem; border-radius: 0.5rem; border: 1px solid #e2e8f0; margin-bottom: 1.25rem; max-width: 500px; width: 100%;' }, [
              m('div', [
                m('span', { style: 'font-weight: 600; color: #1e293b; display: block;' }, 'Max Storage Duration'),
                m('span', { style: 'font-size: 0.8rem; color: #64748b;' }, 'Global expiration period for messages stored in history database'),
              ]),
              m('.storage-input-group', { style: 'display: flex; align-items: center; gap: 0.5rem;' }, [
                m('input[type=number][min=1][max=365]', {
                  style: 'width: 70px; padding: 0.35rem 0.5rem; border-radius: 0.375rem; border: 1px solid #cbd5e1; outline: none; font-weight: 600; text-align: center;',
                  value: maxStorageDays,
                  oninput: (e) => (maxStorageDays = parseInt(e.target.value) || 1),
                  onchange: () => {
                    rs.rsJsonApiRequest('/rsHistory/setMaxStorageDuration', { seconds: maxStorageDays * 86400 }, () => {}, true);
                  },
                }),
                m('span', { style: 'font-weight: 500; color: #475569; font-size: 0.85rem;' }, 'Days'),
              ]),
            ]),

            m('.table-container', { style: 'border: 1px solid #e2e8f0; border-radius: 0.5rem; overflow: hidden; background: #ffffff; max-width: 500px; width: 100%;' }, [
              m('table.history-config-table', { style: 'width: 100%; border-collapse: collapse; text-align: left;' }, [
                m('thead', [
                  m('tr', { style: 'background: #f8fafc; border-bottom: 1px solid #e2e8f0;' }, [
                    m('th', { style: 'padding: 0.75rem 0.75rem; color: #475569; font-weight: 600; font-size: 0.85rem; width: 220px; text-align: left;' }, 'Chat Type'),
                    m('th', { style: 'padding: 0.75rem 0.75rem; color: #475569; font-weight: 600; font-size: 0.85rem; width: 120px; text-align: center;' }, 'Enable History'),
                    m('th', { style: 'padding: 0.75rem 0.75rem; color: #475569; font-weight: 600; font-size: 0.85rem; width: 160px; text-align: center;' }, 'Max Saved Messages'),
                  ]),
                ]),
                m('tbody', [
                  [
                    { label: 'Direct Chat (Private)', icon: 'fa-user-lock', key: 'private', type: 1 },
                    { label: 'Distant Chat', icon: 'fa-network-wired', key: 'distant', type: 3 },
                    { label: 'Chat Rooms (Lobbies)', icon: 'fa-comments', key: 'lobby', type: 2 },
                  ].map(({ label, icon, key, type }) =>
                    m('tr', { style: 'border-bottom: 1px solid #f1f5f9; transition: background 0.15s ease;' }, [
                      m('td', { style: 'padding: 0.75rem 0.75rem; font-weight: 600; color: #1e293b; text-align: left;' }, [
                        m('i.fas.' + icon, { style: 'margin-right: 0.5rem; color: #64748b; font-size: 0.9rem;' }),
                        label,
                      ]),
                      m('td', { style: 'padding: 0.75rem 0.75rem; text-align: center;' }, [
                        m('input[type=checkbox]', {
                          style: 'width: 17px; height: 17px; cursor: pointer; accent-color: #3b82f6;',
                          checked: historyEnable[key],
                          oninput: (e) => {
                            historyEnable[key] = e.target.checked;
                            rs.rsJsonApiRequest('/rsHistory/setEnable', { chat_type: type, enable: historyEnable[key] }, () => {}, true);
                          },
                        }),
                      ]),
                      m('td', { style: 'padding: 0.75rem 0.75rem; text-align: center;' }, [
                        m('div', { style: 'display: flex; align-items: center; justify-content: center; gap: 0.4rem;' }, [
                          m('input[type=number][min=0][max=50000]', {
                            style: 'width: 80px; padding: 0.3rem 0.4rem; border-radius: 0.375rem; border: 1px solid #cbd5e1; outline: none; text-align: center; font-weight: 500;',
                            value: historySaveCount[key],
                            oninput: (e) => (historySaveCount[key] = parseInt(e.target.value) || 0),
                            onchange: () => {
                              rs.rsJsonApiRequest('/rsHistory/setSaveCount', { chat_type: type, count: historySaveCount[key] }, () => {}, true);
                            },
                          }),
                          m('span', { style: 'font-size: 0.8rem; color: #94a3b8;' }, 'msgs'),
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
