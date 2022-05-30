const m = require('mithril');
const rs = require('rswebui');

const Data = {
  DisplayForums: {},
};

async function updateDisplayForums(keyid, details = {}) {
      await rs
    .rsJsonApiRequest(
      '/rsgxsforums/getForumsInfo',
      {
        forumIds: [keyid],
      },
      (data) => {
        details = data.forumsInfo[0];
        // console.log(details);
      }
    )
    .then(() => {
      if (Data.DisplayForums[keyid] === undefined) {
        Data.DisplayForums[keyid] = {
          name: details.mMeta.mGroupName,
          isSearched: true,
          description: details.mDescription,
        };
      }
    });
//   console.log(Data.DisplayForums[keyid]);
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
  let cname = '';
  return {
    oninit: (v) => {
      if (Data.DisplayForums[v.attrs.id]) {
        cname = Data.DisplayForums[v.attrs.id].name;
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
          m('h3', cname),
          m('[id=forumdetails]', [
            m('p', m('b', 'Posts: '), 'posts'),
            m('p', m('b', 'Date created: '), '1/1/11'),
            m('p', m('b', 'Admin: '), 'name_of_admin'),
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
          m('forumdesc', m('b', 'Description: '), Data.DisplayForums[v.attrs.id].description),
        ]
      ),
  };
};

const Table = () => {
  return {
    oninit: (v) => {},
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
};
