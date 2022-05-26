const m = require('mithril');
const rs = require('rswebui');

const Data = {
  DisplayChannels: {},
};

async function updateDisplayChannels(keyid, details) {
  await rs
    .rsJsonApiRequest(
      '/rsgxschannels/getChannelsInfo',
      {
        chanIds: [keyid],
      },
      (data) => {
        details = data.channelsInfo[0];
      }
    )
    .then(() => {
      if (Data.DisplayChannels[keyid] === undefined) {
        Data.DisplayChannels[keyid] = {
          name: details.mMeta.mGroupName,
          isSearched: true,
        };
      }
    });
  console.log(Data.DisplayChannels[keyid]);
}
const DisplayChannels = () => {
  return {
    oninit: (v) => console.log(Data.DisplayChannels[v.attrs.id]),
    view: (v) =>
      m(
        'tr',
        {
          key: v.attrs.id,
          class: ( Data.DisplayChannels[v.attrs.id] && Data.DisplayChannels[v.attrs.id].isSearched) ? '' : 'hidden',
          onclick: () => {
            // console.log(Data.DisplayChannels[v.attrs.id].name);
            m.route.set('/channels/:tab/:mGroupId', {
              tab: v.attrs.category,
              mGroupId: v.attrs.id,
            });
          },
        },
        [m('td', (Data.DisplayChannels[v.attrs.id])?Data.DisplayChannels[v.attrs.id].name:'')]
      ),
  };
};

const ChannelSummary = () => {
  // let details = {};
  // let name = '';
  let keyid = {};
  return {
    oninit: (v) => {
      keyid = v.attrs.details.mGroupId;
      updateDisplayChannels(keyid);
    },

    view: (v) => {}
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
          m('button', 'Reply'),
          m('button', 'Reply All'),
          m('button', 'Forward'),
          m(
            'button',
            {
              onclick: () => {
                rs.rsJsonApiRequest('/rsMsgs/MessageToTrash', {
                  msgId: details.msgId,
                  bTrash: true,
                }),
                  rs.rsJsonApiRequest('/rsMsgs/MessageDelete', {
                    msgId: details.msgId,
                  });
              },
            },
            'Delete'
          ),
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
    view: (v) => m('table.channels', [m('tr', [m('th', 'Channel Name')]), v.children]),
  };
};
const SearchBar = () => {
  let searchString = '';
  return {
    view: (v) =>
      m('input[type=text][id=searchchannel][placeholder=Search Subject].searchbar', {
        value: searchString,
        oninput: (e) => {
          searchString = e.target.value.toLowerCase();
          for (const hash in Data.DisplayChannels) {
            if (Data.DisplayChannels[hash].name.toLowerCase().indexOf(searchString) > -1) {
              Data.DisplayChannels[hash].isSearched = true;
            } else {
              Data.DisplayChannels[hash].isSearched = false;
            }
          }
        },
      }),
  };
};

module.exports = {
  SearchBar,
  ChannelSummary,
  MessageView,
  DisplayChannels,
  Table,
};
