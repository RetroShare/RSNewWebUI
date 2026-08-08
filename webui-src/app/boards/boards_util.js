const m = require('mithril');
const rs = require('rswebui');

const GROUP_SUBSCRIBE_ADMIN = 0x01; // means: you have the admin key for this group
const GROUP_SUBSCRIBE_PUBLISH = 0x02; // means: you have the publish key for thiss group. Typical use: publish key in channels are shared with specific friends.
const GROUP_SUBSCRIBE_SUBSCRIBED = 0x04; // means: you are subscribed to a group, which makes you a source for this group to your friend nodes.
const GROUP_SUBSCRIBE_NOT_SUBSCRIBED = 0x08;
const GROUP_MY_BOARD = GROUP_SUBSCRIBE_ADMIN + GROUP_SUBSCRIBE_SUBSCRIBED + GROUP_SUBSCRIBE_PUBLISH;
const GXS_VOTE_DOWN = 0x0001;
const GXS_VOTE_UP = 0x0002;

// rsgxscircles.h:50
const PUBLIC = 1; // Public distribution
const EXTERNAL = 2; // Restricted to an external circle, based on GxsIds
const NODES_GROUP = 3;

const Data = {
  DisplayBoards: {}, // boardID -> board info
  Posts: {}, // boardID, PostID -> {post, isSearched}
  Comments: {}, // threadID, msgID -> {Comment, showReplies}
};

// Older Qt clients store board notes as rich HTML. Render them as readable,
// inert text in the web UI instead of exposing the markup and embedded CSS.
function plainText(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (!/<\/?[a-z][^>]*>/i.test(text)) return text.trim();
  return text
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(nbsp|#160);/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, '\'')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

async function updateContent(content, boardid) {
  const msgId = content.mMsgId || content.msgId || content;
  try {
    const res = await rs.rsJsonApiRequest('/rsPosted/getBoardContent', {
      boardId: boardid,
      contentsIds: [msgId],
    });
    if (res && res.body && res.body.retval) {
      const posts = res.body.posts || res.body.postList || [];
      const comments = res.body.comments || res.body.commentList || [];
      const votes = res.body.votes || res.body.voteList || [];

      if (posts.length > 0) {
        if (!Data.Posts[boardid]) Data.Posts[boardid] = {};
        Data.Posts[boardid][msgId] = { post: posts[0], isSearched: true };
        m.redraw();
      } else if (comments.length > 0) {
        const threadId = content.mThreadId || comments[0].mMeta.mThreadId;
        if (Data.Comments[threadId] === undefined) {
          Data.Comments[threadId] = {};
        }
        Data.Comments[threadId][msgId] = comments[0];
        m.redraw();
      } else if (votes.length > 0) {
        const vote = votes[0];
        if (
          Data.Comments[vote.mMeta.mThreadId] &&
          Data.Comments[vote.mMeta.mThreadId][vote.mMeta.mParentId]
        ) {
          if (vote.mVoteType === GXS_VOTE_UP) {
            Data.Comments[vote.mMeta.mThreadId][vote.mMeta.mParentId].mUpVotes += 1;
          }
          if (vote.mVoteType === GXS_VOTE_DOWN) {
            Data.Comments[vote.mMeta.mThreadId][vote.mMeta.mParentId].mDownVotes += 1;
          }
          m.redraw();
        }
      }
    }
  } catch (err) {
    console.warn('updateContent error:', err);
  }
}

const inFlightBoards = {};

async function updateDisplayBoards(keyid, details) {
  if (!keyid) return Promise.resolve();

  // 1. Fast path: if posts for this board are already loaded in memory, render instantly and do not re-fetch
  if (Data.DisplayBoards[keyid] && Data.Posts[keyid] && Object.keys(Data.Posts[keyid]).length > 0) {
    m.redraw();
    return Promise.resolve();
  }

  // 2. Prevent duplicate concurrent HTTP requests for the same board ID
  if (inFlightBoards[keyid]) {
    return inFlightBoards[keyid];
  }

  inFlightBoards[keyid] = (async () => {
    try {
      // Fetch board info metadata if missing
      if (!Data.DisplayBoards[keyid]) {
        const res1 = await rs.rsJsonApiRequest('/rsPosted/getBoardsInfo', {
          boardsIds: [keyid],
        });
        if (res1 && res1.body && res1.body.boardsInfo && res1.body.boardsInfo.length > 0) {
          details = res1.body.boardsInfo[0];
          Data.DisplayBoards[keyid] = {
            name: details.mMeta.mGroupName,
            isSearched: true,
            description: details.mDescription,
            image: details.mGroupImage,
            author: details.mMeta.mAuthorId,
            isSubscribed:
              details.mMeta.mSubscribeFlags === GROUP_SUBSCRIBE_SUBSCRIBED ||
              details.mMeta.mSubscribeFlags === GROUP_MY_BOARD,
            posts: details.mMeta.mVisibleMsgCount,
            activity: details.mMeta.mLastPost,
            created: details.mMeta.mPublishTs,
            all: details,
          };
          m.redraw();
        }
      }

      if (!Data.Posts[keyid]) {
        Data.Posts[keyid] = {};
      }

      // Fetch all board content via /rsPosted/getBoardAllContent
      const resAll = await rs.rsJsonApiRequest('/rsPosted/getBoardAllContent', {
        boardId: keyid,
        groupId: keyid,
        handle: keyid,
      });

      if (resAll && resAll.body && resAll.body.retval) {
        const posts = resAll.body.posts || resAll.body.postList || [];
        if (posts.length > 0) {
          posts.forEach((post) => {
            const msgId = (post.mMeta && post.mMeta.mMsgId) ? post.mMeta.mMsgId : post.mMsgId;
            if (msgId) {
              Data.Posts[keyid][msgId] = { post, isSearched: true };
            }
          });
          m.redraw();
        }
      }
    } catch (err) {
      console.warn('updateDisplayBoards network error for board:', keyid, err);
    } finally {
      delete inFlightBoards[keyid];
    }
  })();

  return inFlightBoards[keyid];
}

const BoardSummary = () => {
  return {
    view: (vnode) => {
      const details = vnode.attrs.details;
      const bname = details.mGroupName || details.name || '';
      const bsubscribed =
        details.mSubscribeFlags === GROUP_SUBSCRIBE_SUBSCRIBED ||
        details.mSubscribeFlags === GROUP_MY_BOARD;
      const bposts = details.mVisibleMsgCount || details.posts || 0;
      const createDate = details.mPublishTs || details.created;
      const lastActivity = details.mLastPost || details.activity;

      return m(
        'tr',
        {
          key: details.mGroupId,
          onclick: () => {
            m.route.set('/boards/:tab/:mGroupId', {
              tab: vnode.attrs.category,
              mGroupId: details.mGroupId,
            });
          },
        },
        [
          m('td', bname),
        ]
      );
    },
  };
};

const BoardTable = () => {
  return {
    view: (vnode) =>
      m('table.board-table', [
        m('thead', [
          m('tr', [
            m('th', 'Board Name'),
          ]),
        ]),
        vnode.children,
      ]),
  };
};

const SearchBar = () => {
  let searchString = '';
  return {
    view: (vnode) =>
      m('.search-bar', [
        m('input[type=text][placeholder=Search Boards...]', {
          value: searchString,
          oninput: (e) => {
            searchString = e.target.value;
            const query = searchString.toLowerCase();
            if (vnode.attrs.list) {
              vnode.attrs.list.forEach((board) => {
                const name = (board.mGroupName || board.name || '').toLowerCase();
                board.isSearched = name.includes(query);
              });
            }
          },
        }),
      ]),
  };
};

function popupmessage(message) {
  const container = document.getElementById('modal-container');
  if (!container) return;
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

async function voteForPost(postGrpId, postMsgId, voteType, voterId = null) {
  try {
    let authorId = voterId;
    if (!authorId) {
      const resId = await rs.rsJsonApiRequest('/rsIdentity/getOwnIds', {});
      const ownIds = (resId && resId.body && resId.body.ids) ? resId.body.ids : [];
      if (ownIds.length === 0) {
        alert('No identity found to vote.');
        return false;
      }
      authorId = ownIds[0];
    }

    const res = await rs.rsJsonApiRequest('/rsPosted/voteForPost', {
      postGrpId,
      postMsgId,
      authorId,
      vote: voteType,
    });

    if (res && res.body && res.body.retval) {
      updateDisplayBoards(postGrpId);
      m.redraw();
      return true;
    }
  } catch (e) {
    console.error('voteForPost error:', e);
  }
  return false;
}

module.exports = {
  Data,
  updateDisplayBoards,
  updateContent,
  BoardSummary,
  BoardTable,
  SearchBar,
  popupmessage,
  voteForPost,
  plainText,
  GXS_VOTE_UP,
  GXS_VOTE_DOWN,
  GROUP_SUBSCRIBE_ADMIN,
  GROUP_SUBSCRIBE_PUBLISH,
  GROUP_SUBSCRIBE_SUBSCRIBED,
  GROUP_SUBSCRIBE_NOT_SUBSCRIBED,
  GROUP_MY_BOARD,
  PUBLIC,
  EXTERNAL,
  NODES_GROUP,
};
