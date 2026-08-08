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
  loading: new Set(),
};

function getTimestampValue(ts) {
  if (!ts) return 0;
  if (typeof ts === 'object') {
    if (ts.xint64 !== undefined) return ts.xint64;
    if (ts.xstr64 !== undefined) return Number(ts.xstr64);
    return 0;
  }
  return ts;
}

function formatTimestamp(ts) {
  const val = getTimestampValue(ts);
  if (!val || val === 0) return '???';
  try {
    const localDate = new Date(val * 1000);
    const offset = localDate.getTimezoneOffset() * 60000;
    return new Date(localDate.getTime() - offset).toISOString().replace('T', ' ').slice(0, 16);
  } catch (e) {
    return 'Invalid Date';
  }
}

async function updatedisplayforums(keyid) {
  if (Data.loading.has(keyid)) return;
  Data.loading.add(keyid);

  try {
    const res1 = await rs.rsJsonApiRequest('/rsgxsforums/getForumsInfo', {
      forumIds: [keyid], // keyid: Forumid
    });
    if (res1 && res1.body && res1.body.retval && res1.body.forumsInfo && res1.body.forumsInfo.length > 0) {
      const forumInfo = res1.body.forumsInfo[0];
      Data.DisplayForums[keyid] = {
        // struct for a forum
        name: forumInfo.mMeta.mGroupName,
        author: forumInfo.mMeta.mAuthorId,
        isSearched: true,
        description: forumInfo.mDescription,
        isSubscribed:
          forumInfo.mMeta.mSubscribeFlags === GROUP_SUBSCRIBE_SUBSCRIBED ||
          forumInfo.mMeta.mSubscribeFlags === GROUP_MY_FORUM,
        activity: forumInfo.mMeta.mLastPost,
        created: forumInfo.mMeta.mPublishTs,
      };
      if (Data.Threads[keyid] === undefined) {
        Data.Threads[keyid] = {};
      }

      const res2 = await rs.rsJsonApiRequest('/rsgxsforums/getForumPostsHierarchy', {
        group: forumInfo,
      });

      if (res2 && res2.body && res2.body.vect) {
        const vect = res2.body.vect;
        // Index 0 is the root sentinel in GXS hierarchy
        const rootSentinel = vect[0];

        if (rootSentinel && rootSentinel.mChildren) {
          Data.ParentThreads[keyid] = {};
          rootSentinel.mChildren.forEach((topIndex) => {
            const EntryToThread = (entryIndex) => {
              const entry = vect[entryIndex];
              const replies = {};

              // Map ForumPostEntry to a structure compatible with the existing UI
              const meta = {
                mGroupId: keyid,
                mMsgId: entry.mMsgId,
                mOrigMsgId: entry.mMsgId,
                mThreadId: entry.mMsgId,
                mParentId:
                  entry.mParent !== 0
                    ? vect[entry.mParent].mMsgId
                    : '00000000000000000000000000000000',
                mAuthorId: entry.mAuthorId,
                mMsgName: entry.mTitle,
                mPublishTs: entry.mPublishTs,
                mMostRecentTsInThread: getTimestampValue(entry.mPublishTs),
                mMsgStatus: entry.mMsgStatus,
              };

              // Populate ParentThreadMap for compatibility
              if (meta.mParentId !== '00000000000000000000000000000000') {
                if (!Data.ParentThreadMap[meta.mParentId]) Data.ParentThreadMap[meta.mParentId] = {};
                Data.ParentThreadMap[meta.mParentId][meta.mMsgId] = meta;
              }

              const threadStruct = {
                thread: { mMeta: meta, mMsg: null },
                replies,
                showReplies: false,
              };

              // Add to flat map
              Data.Threads[keyid][meta.mMsgId] = threadStruct;

              if (entry.mChildren) {
                entry.mChildren.forEach((childIndex) => {
                  const childThread = EntryToThread(childIndex);
                  replies[childThread.thread.mMeta.mMsgId] = childThread;
                  const childTs = childThread.thread.mMeta.mMostRecentTsInThread || 0;
                  if (childTs > meta.mMostRecentTsInThread) meta.mMostRecentTsInThread = childTs;
                });
              }

              return threadStruct;
            };

            const topThread = EntryToThread(topIndex);
            Data.ParentThreads[keyid][topThread.thread.mMeta.mMsgId] = topThread.thread.mMeta;
          });
        }
      }
      m.redraw();
    }
  } catch (e) {
    console.error('[RS] Error updating forum display for:', keyid, e);
  } finally {
    Data.loading.delete(keyid);
    m.redraw(); // Final redraw just in case
  }
}

/**
 * Load the body (mMsg) of a single forum post on demand.
 * Returns a Promise that resolves to the body string, or null on failure.
 */
async function loadPostContent(forumId, msgId) {
  // If body is already loaded, return it immediately
  if (
    Data.Threads[forumId] &&
    Data.Threads[forumId][msgId] &&
    Data.Threads[forumId][msgId].thread.mMsg !== null
  ) {
    return Data.Threads[forumId][msgId].thread.mMsg;
  }

  try {
    const res = await rs.rsJsonApiRequest('/rsgxsforums/getForumContent', {
      forumId,
      msgsIds: [msgId],
    });
    if (res && res.body && res.body.retval && res.body.msgs && res.body.msgs.length > 0) {
      const body = res.body.msgs[0].mMsg;
      // Cache the body in the existing thread entry
      if (Data.Threads[forumId] && Data.Threads[forumId][msgId]) {
        Data.Threads[forumId][msgId].thread.mMsg = body;
      }
      m.redraw();
      return body;
    }
  } catch (e) {
    console.error('[RS] Error loading post content:', forumId, msgId, e);
  }
  return null;
}

const DisplayForumsFromList = () => {
  return {
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
      updatedisplayforums(keyid);
    },
    view: (v) => { },
  };
};

const ForumTable = () => {
  return {
    view: (v) => m('table.forums', [m('tr', [m('th', 'Forum Name')]), v.children]),
  };
};
const ThreadsTable = () => {
  return {
    oninit: (v) => { },
    view: (v) =>
      m('table.threads', [
        v.children,
      ]),
  };
};
const ThreadsReplyTable = () => {
  return {
    oninit: (v) => { },
    view: (v) =>
      m('table.threadreply', [
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
  ForumSummary,
  DisplayForumsFromList,
  ForumTable,
  ThreadsTable,
  ThreadsReplyTable,
  popupmessage,
  updatedisplayforums,
  loadPostContent,
  getTimestampValue,
  formatTimestamp,
  GROUP_SUBSCRIBE_ADMIN,
  GROUP_SUBSCRIBE_NOT_SUBSCRIBED,
  GROUP_SUBSCRIBE_PUBLISH,
  GROUP_SUBSCRIBE_SUBSCRIBED,
  GROUP_MY_FORUM,
  THREAD_UNREAD,
};
