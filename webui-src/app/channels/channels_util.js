const m = require('mithril');
const rs = require('rswebui');

const GROUP_SUBSCRIBE_ADMIN = 0x01; // means: you have the admin key for this group
const GROUP_SUBSCRIBE_PUBLISH = 0x02; // means: you have the publish key for thiss group. Typical use: publish key in channels are shared with specific friends.
const GROUP_SUBSCRIBE_SUBSCRIBED = 0x04; // means: you are subscribed to a group, which makes you a source for this group to your friend nodes.
const GROUP_SUBSCRIBE_NOT_SUBSCRIBED = 0x08;

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
        // console.log(details);
      }
    )
    .then(() => {
      if (Data.DisplayChannels[keyid] === undefined) {
        Data.DisplayChannels[keyid] = {
          name: details.mMeta.mGroupName,
          isSearched: true,
          description: details.mDescription,
          image: details.mImage,
          author: details.mMeta.mAuthorId,
          isSubscribed: details.mMeta.mSubscribeFlags === GROUP_SUBSCRIBE_SUBSCRIBED,
        };
      }
    });
  // console.log(Data.DisplayChannels[keyid]);
}
const DisplayChannelsFromList = () => {
  return {
    oninit: (v) => {},
    view: (v) =>
      m(
        'tr',
        {
          key: v.attrs.id,
          class:
            Data.DisplayChannels[v.attrs.id] && Data.DisplayChannels[v.attrs.id].isSearched
              ? ''
              : 'hidden',
          onclick: () => {
            m.route.set('/channels/:tab/:mGroupId', {
              tab: v.attrs.category,
              mGroupId: v.attrs.id,
            });
          },
        },
        [m('td', Data.DisplayChannels[v.attrs.id] ? Data.DisplayChannels[v.attrs.id].name : '')]
      ),
  };
};

const ChannelSummary = () => {
  let keyid = {};
  return {
    oninit: (v) => {
      keyid = v.attrs.details.mGroupId;
      updateDisplayChannels(keyid);
    },

    view: (v) => {},
  };
};

const MessageView = () => {
  let cname = '';
  let cimage = '';
  let cauthor = '';
  let csubscribed = {};
  return {
    oninit: (v) => {
      if (Data.DisplayChannels[v.attrs.id]) {
        cname = Data.DisplayChannels[v.attrs.id].name;
        cimage = Data.DisplayChannels[v.attrs.id].image;
        if (rs.userList.userMap[Data.DisplayChannels[v.attrs.id].author]) {
          cauthor = rs.userList.userMap[Data.DisplayChannels[v.attrs.id].author];
        } else if (Number(Data.DisplayChannels[v.attrs.id].author) === 0) {
          cauthor = 'No Contact Author';
        } else {
          cauthor = 'Unknown';
        }
        csubscribed = Data.DisplayChannels[v.attrs.id].isSubscribed;
        // console.log(typeof(Data.DisplayChannels[v.attrs.id].author));
      }
    },
    view: (v) =>
      m(
        '.widget',
        {
          key: v.attrs.id,
        },
        [
          m(
            'a[title=Back]',
            {
              onclick: () =>
                m.route.set('/channels/:tab', {
                  tab: m.route.param().tab,
                }),
            },
            m('i.fas.fa-arrow-left')
          ),
          m('h3', cname),
          m(
            'button',
            {
              onclick: () => {
                if(!Data.DisplayChannels[v.attrs.id].isSubscribed){
                  rs.rsJsonApiRequest(
                    '/rsgxschannels/subscribeToChannel',
                    {
                      channelId: v.attrs.id,
                      subscribe: true,
                    },
                    (data) => {
                      console.log(data);
                    }
                  ).then( () => {
                    updateDisplayChannels(v.attrs.id);
                  });
                }
                else
                {
                  rs.rsJsonApiRequest(
                    '/rsgxschannels/subscribeToChannel',
                    {
                      channelId: v.attrs.id,
                      subscribe: false,
                    },
                    (data) => {
                      console.log(data);
                    }
                  ).then( () => {
                    updateDisplayChannels(v.attrs.id);
                  });
                }
              },
            },
            (csubscribed)?'Subscribed':'Subscribe'
          ),
          m('img.channelpic', {
            src: 'data:image/png;base64,' + cimage.mData.base64,
          }),
          m('[id=channeldetails]', [
            m('p', m('b', 'Posts: '), 'posts'),
            m('p', m('b', 'Date created: '), '1/1/11'),
            m('p', m('b', 'Admin: '), cauthor),
            m('p', m('b', 'Last activity: '), '1/1/11'),
          ]),
          // m('button', 'Reply'),
          // m('button', 'Reply All'),
          // m('button', 'Forward'),
          // m(
          //   'button',
          //   {
          //     onclick: () => {
          //       rs.rsJsonApiRequest('/rsMsgs/MessageToTrash', {
          //         msgId: details.msgId,
          //         bTrash: true,
          //       }),
          //         rs.rsJsonApiRequest('/rsMsgs/MessageDelete', {
          //           msgId: details.msgId,
          //         });
          //     },
          //   },
          //   'Delete'
          // ),
          m('hr'),
          m('channeldesc', m('b', 'Description: '), Data.DisplayChannels[v.attrs.id].description),
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
  DisplayChannelsFromList,
  Table,
  GROUP_SUBSCRIBE_ADMIN,
  GROUP_SUBSCRIBE_NOT_SUBSCRIBED,
  GROUP_SUBSCRIBE_PUBLISH,
  GROUP_SUBSCRIBE_SUBSCRIBED,
};
