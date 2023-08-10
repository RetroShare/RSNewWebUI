const m = require('mithril');
const rs = require('rswebui');

const GROUP_SUBSCRIBE_ADMIN = 0x01; // means: you have the admin key for this group
const GROUP_SUBSCRIBE_PUBLISH = 0x02; // means: you have the publish key for thiss group. Typical use: publish key in forums are shared with specific friends.
const GROUP_SUBSCRIBE_SUBSCRIBED = 0x04; // means: you are subscribed to a group, which makes you a source for this group to your friend nodes.
const GROUP_SUBSCRIBE_NOT_SUBSCRIBED = 0x08;
const GROUP_MY_FORUM = GROUP_SUBSCRIBE_ADMIN + GROUP_SUBSCRIBE_SUBSCRIBED + GROUP_SUBSCRIBE_PUBLISH;

const THREAD_UNREAD = 0x00000003;

const Data = {
  DisplayForums: {},
  Threads: {},
  ParentThreads: {},
  ParentThreadMap: {},
};

async function cachedForumFetch(url, options, cacheKey) {
  const expiry = 10 * 60; // 10 minute default
  const cachedDetails = sessionStorage.getItem(cacheKey);
  const cachedTs = sessionStorage.getItem(`${cacheKey}:ts`);
  // check if cachedDetails was already in sessionStorage
  if (cachedDetails !== null && cachedTs !== null) {
    const age = (Date.now() - cachedTs) / 1000;
    if (age < expiry) {
      return await JSON.parse(cachedDetails);
    } else {
      // clean up old cache
      sessionStorage.removeItem(cacheKey);
      sessionStorage.removeItem(`${cacheKey}:ts`);
    }
  }
  const res = await rs.rsJsonApiRequest(url, options);
  if (res.body.retval) {
    sessionStorage.setItem(cacheKey, JSON.stringify(res.body));
    sessionStorage.setItem(`${cacheKey}:ts`, Date.now());
    return res.body;
  } else return res.body.retval;
}

async function updatedisplayforums(forumId, category) {
  const response = await cachedForumFetch(
    '/rsgxsforums/getForumsInfo',
    { forumIds: [forumId] },
    forumId
  );
  if (response === false) return;
  const details = response.forumsInfo[0];
  Data.DisplayForums[forumId] = {
    // struct for a forum
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

  // Check and only proceed if forum is SubscribedForums
  if (category !== 'SubscribedForums') return;

  if (Data.Threads[forumId] === undefined) {
    Data.Threads[forumId] = {};
  }
  const res = await rs.rsJsonApiRequest('/rsgxsforums/getForumMsgMetaData', {
    forumId,
  });
  if (res.body.retval) {
    res.body.msgMetas.map(async (thread) => {
      const response2 = await cachedForumFetch(
        '/rsgxsforums/getForumContent',
        { forumId, msgsIds: [thread.mMsgId] },
        thread.mMsgId
      );
      if (response2 === false) return;
      const threadContent = response2.msgs[0];
      if (
        Data.Threads[forumId][thread.mOrigMsgId] === undefined ||
        Data.Threads[forumId][thread.mOrigMsgId].thread.mMeta.mPublishTs.xint64 <
          thread.mPublishTs.xint64
      ) {
        // here we get the latest edited thread for each thread by comparing the publish time
        Data.Threads[forumId][thread.mOrigMsgId] = {
          thread: threadContent,
          showReplies: false,
        };
        if (
          Data.Threads[forumId][thread.mOrigMsgId] &&
          Data.Threads[forumId][thread.mOrigMsgId].thread.mMeta.mMsgStatus === THREAD_UNREAD
        ) {
          let parent = Data.Threads[forumId][thread.mOrigMsgId].thread.mMeta.mParentId;
          while (Data.Threads[forumId][parent]) {
            // to mark all parent threads of an inread thread
            Data.Threads[forumId][parent].thread.mMeta.mMsgStatus = THREAD_UNREAD;
            parent = Data.Threads[forumId][parent].thread.mMeta.mParentId;
          }
        }

        if (Data.ParentThreads[forumId] === undefined) {
          Data.ParentThreads[forumId] = {};
        }
        if (thread.mThreadId === thread.mParentId) {
          // top level thread.
          Data.ParentThreads[forumId][thread.mOrigMsgId] =
            Data.Threads[forumId][thread.mOrigMsgId].thread.mMeta;
        } else {
          if (Data.ParentThreadMap[thread.mParentId] === undefined) {
            Data.ParentThreadMap[thread.mParentId] = {};
          }
          Data.ParentThreadMap[thread.mParentId][thread.mOrigMsgId] = thread;
        }
      }
    });
  }
}

const DisplayForumsFromList = () => {
  let forumId;
  return {
    oninit: async (v) => {
      forumId = await v.attrs.id;
    },
    view: (v) =>
      m(
        'tr',
        {
          key: forumId,
          class:
            Data.DisplayForums[forumId] && Data.DisplayForums[forumId].isSearched ? '' : 'hidden',
          onclick: () => {
            m.route.set('/forums/:tab/:mGroupId', {
              tab: v.attrs.category,
              mGroupId: forumId,
            });
          },
        },
        [m('td', Data.DisplayForums[forumId] ? Data.DisplayForums[forumId].name : '')]
      ),
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
        m('tr', [m('th', 'Comment'), m('th', 'Date'), m('th', 'Author')]),
        v.children,
      ]),
  };
};
const ThreadsReplyTable = () => {
  return {
    oninit: (v) => {},
    view: (v) =>
      m('table.threadreply', [
        m('tr', [
          m('th', ''),
          m('th', 'Comment'),
          m('th', 'Unread'),
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
function popupmessage(message) {
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
  Data,
  SearchBar,
  DisplayForumsFromList,
  ForumTable,
  ThreadsTable,
  ThreadsReplyTable,
  popupmessage,
  updatedisplayforums,
  GROUP_SUBSCRIBE_ADMIN,
  GROUP_SUBSCRIBE_NOT_SUBSCRIBED,
  GROUP_SUBSCRIBE_PUBLISH,
  GROUP_SUBSCRIBE_SUBSCRIBED,
  GROUP_MY_FORUM,
  THREAD_UNREAD,
};
