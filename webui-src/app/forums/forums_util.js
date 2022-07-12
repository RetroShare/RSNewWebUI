const m = require('mithril');
const rs = require('rswebui');

const GROUP_SUBSCRIBE_ADMIN = 0x01; // means: you have the admin key for this group
const GROUP_SUBSCRIBE_PUBLISH = 0x02; // means: you have the publish key for thiss group. Typical use: publish key in forums are shared with specific friends.
const GROUP_SUBSCRIBE_SUBSCRIBED = 0x04; // means: you are subscribed to a group, which makes you a source for this group to your friend nodes.
const GROUP_SUBSCRIBE_NOT_SUBSCRIBED = 0x08;
const GROUP_MY_FORUM = GROUP_SUBSCRIBE_ADMIN + GROUP_SUBSCRIBE_SUBSCRIBED + GROUP_SUBSCRIBE_PUBLISH;

const Data = {
  DisplayForums: {},
  Posts: {},
  ParentThreads: {},
};

async function updateDisplayForums(keyid, details = {}) {
  const res = await rs.rsJsonApiRequest('/rsgxsforums/getForumsInfo', {
    forumIds: [keyid],
  });
  details = res.body.forumsInfo[0];
  Data.DisplayForums[keyid] = {
    name: details.mMeta.mGroupName,
    author: details.mMeta.mAuthorId,
    isSearched: true,
    description: details.mDescription,
    isSubscribed:
      details.mMeta.mSubscribeFlags === GROUP_SUBSCRIBE_SUBSCRIBED ||
      details.mMeta.mSubscribeFlags === GROUP_MY_FORUM,
    activity: details.mMeta.mLastPost,
    created: details.mMeta.mPublishTs,
  };
  if (Data.Posts[keyid] === undefined) {
    Data.Posts[keyid] = {};
  }
  const res2 = await rs.rsJsonApiRequest('/rsgxsforums/getForumMsgMetaData', {
    forumId: keyid,
  });
  if (res2.body.retval) {
    res2.body.msgMetas.map((thread) => {
      if (Data.ParentThreads[thread.mGroupId] === undefined) {
        Data.ParentThreads[thread.mGroupId] = {};
      }
      if (thread.mThreadId === thread.mParentId) {
        Data.ParentThreads[thread.mGroupId][thread.mMsgId] = thread;
      }
    });
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

const ForumTable = () => {
  return {
    view: (v) => m('table.forums', [m('tr', [m('th', 'Forum Name')]), v.children]),
  };
};
const ThreadsTable = () => {
  return {
    oninit: (v) => {},
    view: (v) =>
      m('table.threads', [
        m('tr', [
          m('th', 'Comment'),
          m('th', 'Author'),
          m('th', 'Date'),
        ]),
        v.children,
      ]),
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
  Data,
  SearchBar,
  ForumSummary,
  DisplayForumsFromList,
  ForumTable,
  ThreadsTable,
  GROUP_SUBSCRIBE_ADMIN,
  GROUP_SUBSCRIBE_NOT_SUBSCRIBED,
  GROUP_SUBSCRIBE_PUBLISH,
  GROUP_SUBSCRIBE_SUBSCRIBED,
  GROUP_MY_FORUM,
};
