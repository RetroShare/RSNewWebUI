const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const icon = require('icon');

const GROUP_SUBSCRIBE_ADMIN = 0x01; // means: you have the admin key for this group
const GROUP_SUBSCRIBE_PUBLISH = 0x02; // means: you have the publish key for thiss group. Typical use: publish key in forums are shared with specific friends.
const GROUP_SUBSCRIBE_SUBSCRIBED = 0x04; // means: you are subscribed to a group, which makes you a source for this group to your friend nodes.
const GROUP_SUBSCRIBE_NOT_SUBSCRIBED = 0x08;
const GROUP_MY_FORUM = GROUP_SUBSCRIBE_ADMIN + GROUP_SUBSCRIBE_SUBSCRIBED + GROUP_SUBSCRIBE_PUBLISH;

//  rsgxsflags.h: GXS_MSG_STATUS_GUI_UNREAD. It is one bit among several in
//  mMsgStatus, so it has to be tested, not compared -- `status === 3` was true
//  for almost no post, which left the Unread column permanently empty.
const GXS_MSG_STATUS_GUI_UNREAD = 0x00000002;

function isUnread(msgStatus) {
  return (msgStatus & GXS_MSG_STATUS_GUI_UNREAD) !== 0;
}

const Data = {
  DisplayForums: {},
  Threads: {},
  ParentThreads: {},
  ParentThreadMap: {},
  loading: new Set(),
};

//  'forumId/msgId' of the post bodies currently being fetched, see
//  loadPostContent(). Module level rather than in Data: it is plumbing, not
//  forum content.
const bodyRequestsInFlight = new Set();
const FAILED_BODY_RETRY_MS = 5 * 60 * 1000;

//  Both live in rswebui now; forums, channels and the views all format the
//  same core timestamps.
const { getTimestampValue, formatTimestamp } = rs;

/**
 * How long this forum keeps posts and how far back it syncs them. Two calls,
 * so they run beside the hierarchy rather than holding it up.
 */
async function loadRetentionPeriods(keyid) {
  const [sync, storage] = await Promise.all([
    rs.rsJsonApiRequest('/rsgxsforums/getSyncPeriod', { groupId: keyid }),
    rs.rsJsonApiRequest('/rsgxsforums/getStoragePeriod', { groupId: keyid }),
  ]);
  const entry = Data.DisplayForums[keyid];
  if (!entry) return;
  if (sync && sync.body) entry.syncPeriod = sync.body.retval;
  if (storage && storage.body) entry.storagePeriod = storage.body.retval;
  m.redraw();
}

//  The list filter. Module level, like the flags it sets on Data.DisplayForums:
//  the search field is unmounted on a forum's own page and recreated on the
//  way back, and must come back showing the filter that is still applied.
let forumsSearchString = '';

async function updatedisplayforums(keyid) {
  if (Data.loading.has(keyid)) return;
  Data.loading.add(keyid);

  try {
    const res1 = await rs.rsJsonApiRequest('/rsgxsforums/getForumsInfo', {
      forumIds: [keyid], // keyid: Forumid
    });
    if (res1 && res1.body && res1.body.retval && res1.body.forumsInfo && res1.body.forumsInfo.length > 0) {
      const forumInfo = res1.body.forumsInfo[0];
      const meta = forumInfo.mMeta;
      const subscribed =
        meta.mSubscribeFlags === GROUP_SUBSCRIBE_SUBSCRIBED ||
        meta.mSubscribeFlags === GROUP_MY_FORUM;
      Data.DisplayForums[keyid] = {
        // struct for a forum
        name: meta.mGroupName,
        author: meta.mAuthorId,
        isSearched: true,
        description: forumInfo.mDescription,
        isSubscribed: subscribed,
        activity: meta.mLastPost,
        created: meta.mPublishTs,
        //  The rest of what the details panel shows.
        subscribers: meta.mPop,
        visibleMsgCount: meta.mVisibleMsgCount,
        circleType: meta.mCircleType,
        circleId: meta.mCircleId,
        signFlags: meta.mSignFlags,
        lastSeen: meta.mLastSeen,
      };
      if (Data.Threads[keyid] === undefined) {
        Data.Threads[keyid] = {};
      }

      //  Only a forum you carry has a sync and storage window of its own.
      if (subscribed) loadRetentionPeriods(keyid);

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

              //  This runs again on every refresh. Without carrying the body
              //  over, an open post loses it and flashes back to "Loading
              //  content..." while it is fetched a second time.
              const cached = Data.Threads[keyid][entry.mMsgId];
              const threadStruct = {
                thread: { mMeta: meta, mMsg: cached ? cached.thread.mMsg : null },
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

  //  This is called straight from the view (forum_view.js, the 'Loading
  //  content...' branch), and the body stays null for the whole round trip, so
  //  without this guard every redraw fires another getForumContent for the same
  //  post -- and a redraw happens on each of the other posts' answers. An open
  //  thread would multiply one request per post into one per post per redraw.
  const inFlightKey = forumId + '/' + msgId;
  if (bodyRequestsInFlight.has(inFlightKey)) return null;
  bodyRequestsInFlight.add(inFlightKey);

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
      //  The cached body is what stops the view from asking again, so the
      //  key is released only once it is in place.
      bodyRequestsInFlight.delete(inFlightKey);
      m.redraw();
      return body;
    }
  } catch (e) {
    console.error('[RS] Error loading post content:', forumId, msgId, e);
  }
  //  Failure. The view fires this again on EVERY redraw while the body stays
  //  null, and each completed request triggers a redraw of its own -- so
  //  releasing the key here (a finally) makes an unfetchable post a
  //  self-sustaining request loop at redraw rate. Keep the key, release it
  //  after a while: one request per post per five minutes is storm-proof,
  //  and a body the core could not return still gets another chance.
  setTimeout(() => bodyRequestsInFlight.delete(inFlightKey), FAILED_BODY_RETRY_MS);
  return null;
}

const DisplayForumsFromList = () => {
  return {
    //  Everything here comes from the summary that arrived with the list. It
    //  used to ask the core about each forum one by one, which meant one
    //  request per row before the list could draw.
    view: (v) => {
      const summary = v.attrs.details || {};
      return m(
        'tr.group-row',
        {
          key: v.attrs.id,
          class: summary.isSearched === false ? 'hidden' : '',
          onclick: () => {
            m.route.set('/forums/:tab/:mGroupId', {
              tab: v.attrs.category,
              mGroupId: v.attrs.id,
            });
          },
        },
        [
          m('td.group-row__name', m('.group-row__inner', [
            m('.group-row__mark', icon('bullhorn')),
            m('.group-row__text', [
              m('span.group-row__title', summary.mGroupName || ''),
              summary.description
                ? m('span.group-row__desc', summary.description)
                : null,
            ]),
          ])),
          m('td.group-row__posts', summary.mVisibleMsgCount || 0),
          m('td.group-row__activity', formatTimestamp(summary.mLastPost)),
        ]
      );
    },
  };
};

const ForumTable = () => {
  return {
    view: (v) => m('table.group-table.forums', [
      m('thead', m('tr', [
        m('th.group-row__name', 'Forum'),
        m('th.group-row__posts', 'Posts'),
        m('th.group-row__activity', 'Last post'),
      ])),
      v.children,
    ]),
  };
};
//  The wrapper is the scroller: a <table> cannot scroll itself, and in the
//  split view the thread list has to scroll without moving the reading pane.
const ThreadsTable = () => {
  return {
    view: (v) => m('.threads-scroll', m('table.threads', [v.children])),
  };
};

//  Flags the summaries the list is already holding. Every tab's array is built
//  by filtering the same objects, so one pass covers all of them.
function filterForums(list, query) {
  (list || []).forEach((forum) => {
    forum.isSearched = !query || (forum.mGroupName || '').toLowerCase().includes(query);
  });
}

const SearchBar = () => {
  return {
    view: (v) => {
      filterForums(v.attrs.list, forumsSearchString);
      return m(widget.SearchField, {
        placeholder: 'Search forums',
        value: forumsSearchString,
        onclear: () => {
          forumsSearchString = '';
          filterForums(v.attrs.list, '');
        },
        oninput: (e) => {
          forumsSearchString = e.target.value;
          filterForums(v.attrs.list, forumsSearchString.toLowerCase());
        },
      });
    },
  };
};
function popupmessage(message, modalClass = '', options = {}) {
  widget.popupMessage(message, modalClass, options);
}

module.exports = {
  Data,
  SearchBar,
  DisplayForumsFromList,
  ForumTable,
  ThreadsTable,
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
  isUnread,
};
