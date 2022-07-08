const m = require('mithril');
const rs = require('rswebui');

const GROUP_SUBSCRIBE_ADMIN = 0x01; // means: you have the admin key for this group
const GROUP_SUBSCRIBE_PUBLISH = 0x02; // means: you have the publish key for thiss group. Typical use: publish key in forums are shared with specific friends.
const GROUP_SUBSCRIBE_SUBSCRIBED = 0x04; // means: you are subscribed to a group, which makes you a source for this group to your friend nodes.
const GROUP_SUBSCRIBE_NOT_SUBSCRIBED = 0x08;
const GROUP_MY_FORUM =
  GROUP_SUBSCRIBE_ADMIN + GROUP_SUBSCRIBE_SUBSCRIBED + GROUP_SUBSCRIBE_PUBLISH;


const Data = {
  DisplayForums: {},
};

async function updateDisplayForums(keyid, details = {}) {
  const res = await rs.rsJsonApiRequest('/rsgxsforums/getForumsInfo', {
    forumIds: [keyid],
  });
  details = res.body.forumsInfo[0];
  if (Data.DisplayForums[keyid] === undefined) {
    Data.DisplayForums[keyid] = {
      name: details.mMeta.mGroupName,
      isSearched: true,
      description: details.mDescription,
      isSubscribed: details.mMeta.mSubscribeFlags === GROUP_SUBSCRIBE_SUBSCRIBED,
    };
  }
}

const DisplayForumsFromList = () => {
  return {
    oninit: (v) => {},
    view: (v) =>
      m(
        'tr',
        {
          key: v.attrs.id,
          class:
            Data.DisplayForums[v.attrs.id] && Data.DisplayForums[v.attrs.id].isSearched
              ? ''
              : 'hidden',
          onclick: () => {
            m.route.set('/forums/:tab/:mGroupId', {
              tab: v.attrs.category,
              mGroupId: v.attrs.id,
            });
          },
        },
        [m('td', Data.DisplayForums[v.attrs.id] ? Data.DisplayForums[v.attrs.id].name : '')]
      ),
  };
};

const ForumSummary = () => {
  let keyid = {};
  return {
    oninit: (v) => {
      keyid = v.attrs.details.mGroupId;
      updateDisplayForums(keyid);
    },

    view: (v) => {},
  };
};

const MessageView = () => {
  let fname = '';
  let fsubscribed = {};
  return {
    oninit: (v) => {
      if (Data.DisplayForums[v.attrs.id]) {
        fname = Data.DisplayForums[v.attrs.id].name;
        fsubscribed = Data.DisplayForums[v.attrs.id].isSubscribed;
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
                m.route.set('/forums/:tab', {
                  tab: m.route.param().tab,
                }),
            },
            m('i.fas.fa-arrow-left')
          ),
          m(
            'button',
            {
              onclick: async () => {
                const res = await rs.rsJsonApiRequest('/rsgxsforums/subscribeToForum', {
                  forumId: v.attrs.id,
                  subscribe: !fsubscribed,
                });
                if (res.body.retval) {
                  fsubscribed = !fsubscribed;
                  Data.DisplayForums[v.attrs.id].isSubscribed = fsubscribed;
                }
              },
            },
            fsubscribed ? 'Subscribed' : 'Subscribe'
          ),
          m('h3', fname),
          m('[id=forumdetails]', [
            m('p', m('b', 'Posts: '), 'posts'),
            m('p', m('b', 'Date created: '), '1/1/11'),
            m('p', m('b', 'Admin: '), 'name_of_admin'),
            m('p', m('b', 'Last activity: '), '1/1/11'),
          ]),
          m('hr'),
          m('forumdesc', m('b', 'Description: '), Data.DisplayForums[v.attrs.id].description),
        ]
      ),
  };
};

const Table = () => {
  return {
    view: (v) => m('table.forums', [m('tr', [m('th', 'Forum Name')]), v.children]),
  };
};
const SearchBar = () => {
  let searchString = '';
  return {
    view: (v) =>
      m('input[type=text][id=searchforum][placeholder=Search Subject].searchbar', {
        value: searchString,
        oninput: (e) => {
          searchString = e.target.value.toLowerCase();
          for (const hash in Data.DisplayForums) {
            if (Data.DisplayForums[hash].name.toLowerCase().indexOf(searchString) > -1) {
              Data.DisplayForums[hash].isSearched = true;
            } else {
              Data.DisplayForums[hash].isSearched = false;
            }
          }
        },
      }),
  };
};

module.exports = {
  SearchBar,
  ForumSummary,
  MessageView,
  DisplayForumsFromList,
  Table,
  GROUP_SUBSCRIBE_ADMIN,
  GROUP_SUBSCRIBE_NOT_SUBSCRIBED,
  GROUP_SUBSCRIBE_PUBLISH,
  GROUP_SUBSCRIBE_SUBSCRIBED,
  GROUP_MY_FORUM
};
