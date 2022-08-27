const m = require('mithril');
const rs = require('rswebui');

const GROUP_SUBSCRIBE_ADMIN          = 0x01;// means: you have the admin key for this group
const GROUP_SUBSCRIBE_PUBLISH        = 0x02;// means: you have the publish key for thiss group. Typical use: publish key in channels are shared with specific friends.
const GROUP_SUBSCRIBE_SUBSCRIBED     = 0x04;// means: you are subscribed to a group, which makes you a source for this group to your friend nodes.
const GROUP_SUBSCRIBE_NOT_SUBSCRIBED = 0x08;
const GROUP_MY_BOARD = GROUP_SUBSCRIBE_ADMIN + GROUP_SUBSCRIBE_SUBSCRIBED + GROUP_SUBSCRIBE_PUBLISH;
const GXS_VOTE_DOWN = 0x0001;
const GXS_VOTE_UP = 0x0002;

const Data = {
  DisplayBoards: {},
  Posts: {},
  Comments: {},
};

async function updateContent(content, boardid) {
  const res = await rs.rsJsonApiRequest('/rsPosted/getBoardContent', {
    boardId: boardid,
    contentsIds: [content.mMsgId],
  });
  if (res.body.retval && res.body.posts.length > 0) {
    Data.Posts[boardid][content.mMsgId] = { post: res.body.posts[0], isSearched: true };
  } else if (res.body.retval && res.body.comments.length > 0) {
    if (Data.Comments[content.mThreadId] === undefined) {
      Data.Comments[content.mThreadId] = {};
    }
    Data.Comments[content.mThreadId][content.mMsgId] = res.body.comments[0];
  } else if (res.body.retval && res.body.votes.length > 0) {
    const vote = res.body.votes[0];
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
    }
  }
}

async function updateDisplayBoards(keyid, details) {
  const res1 = await rs.rsJsonApiRequest('/rsPosted/getBoardsInfo', {
    boardsIds: [keyid],
  });
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

  if (Data.Posts[keyid] === undefined) {
    Data.Posts[keyid] = {};
  }

  /*const res2 = await rs.rsJsonApiRequest('/rsPosted/getContentSummaries', {
    boardId: keyid,
  });

  if (res2.body.retval) {
    res2.body.summaries.map((content) => {
      updateContent(content, keyid);
    });
  }*/
 
}

const DisplayBoardsFromList = () => {
  return {
    oninit: (v) => {},
    view: (v) =>
      m(
        'tr',
        {
          key: v.attrs.id,
          class:
            Data.DisplayBoards[v.attrs.id] && Data.DisplayBoards[v.attrs.id].isSearched
              ? ''
              : 'hidden',
          onclick: () => {
            m.route.set('/boards/:tab/:mGroupId', {
              tab: v.attrs.category,
              mGroupId: v.attrs.id,
            });
          },
        },
        [m('td', Data.DisplayBoards[v.attrs.id] ? Data.DisplayBoards[v.attrs.id].name : '')]
      ),
  };
};

const BoardSummary = () => {
  let keyid = {};
  return {
    oninit: (v) => {
      keyid = v.attrs.details.mGroupId;
      updateDisplayBoards(keyid);
    },

    view: (v) => {},
  };
};

const BoardTable = () => {
  return {
    oninit: (v) => {},
    view: (v) => m('table.boards', [m('tr', [m('th', 'Board Name')]), v.children]),
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

const SearchBar = () => {
  let searchString = '';
  return {
    view: (v) =>
      m('input[type=text][id=searchboard][placeholder=Search Subject].searchbar', {
        value: searchString,
        oninput: (e) => {
          searchString = e.target.value.toLowerCase();
          for (const hash in Data.DisplayBoards) {
            if (Data.DisplayBoards[hash].name.toLowerCase().indexOf(searchString) > -1) {
              Data.DisplayBoards[hash].isSearched = true;
            } else {
              Data.DisplayBoards[hash].isSearched = false;
            }
          }
        },
      }),
  };
};

module.exports = {
  Data,
  SearchBar,
  popupmessage,
  BoardSummary,
  DisplayBoardsFromList,
  updateDisplayBoards,
  BoardTable,
  GROUP_SUBSCRIBE_ADMIN,
  GROUP_SUBSCRIBE_NOT_SUBSCRIBED,
  GROUP_SUBSCRIBE_PUBLISH,
  GROUP_SUBSCRIBE_SUBSCRIBED,
  GROUP_MY_BOARD,
  GXS_VOTE_DOWN,
  GXS_VOTE_UP,
};
