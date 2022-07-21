const m = require('mithril');
const rs = require('rswebui');

const GROUP_SUBSCRIBE_ADMIN = 0x01; // means: you have the admin key for this group
const GROUP_SUBSCRIBE_PUBLISH = 0x02; // means: you have the publish key for thiss group. Typical use: publish key in channels are shared with specific friends.
const GROUP_SUBSCRIBE_SUBSCRIBED = 0x04; // means: you are subscribed to a group, which makes you a source for this group to your friend nodes.
const GROUP_SUBSCRIBE_NOT_SUBSCRIBED = 0x08;
const GROUP_MY_CHANNEL =
  GROUP_SUBSCRIBE_ADMIN + GROUP_SUBSCRIBE_SUBSCRIBED + GROUP_SUBSCRIBE_PUBLISH;
const RS_FILE_REQ_ANONYMOUS_ROUTING = 0x00000040;
const GXS_VOTE_DOWN = 0x0001;
const GXS_VOTE_UP = 0x0002;

const Data = {
  DisplayChannels: {},
  Posts: {},
  Comments: {},
  TopComments: {},
  ParentCommentMap: {},
};

async function updatecontent(content, channelid) {
  const res = await rs.rsJsonApiRequest('/rsgxschannels/getChannelContent', {
    channelId: channelid,
    contentsIds: [content.mMsgId],
  });
  if (res.body.retval && res.body.posts.length > 0) {
    Data.Posts[channelid][content.mMsgId] = { post: res.body.posts[0], isSearched: true };
  } else if (res.body.retval && res.body.comments.length > 0) {
    if (Data.Comments[content.mThreadId] === undefined) {
      Data.Comments[content.mThreadId] = {};
    }
    Data.Comments[content.mThreadId][content.mMsgId] = {
      comment: res.body.comments[0],
      showReplies: false,
    }; // Comments[post][comment]
    const comm = res.body.comments[0];
    if (Data.TopComments[comm.mMeta.mThreadId] === undefined) {
      Data.TopComments[comm.mMeta.mThreadId] = {};
    }
    if (comm.mMeta.mThreadId === comm.mMeta.mParentId) {
      Data.TopComments[comm.mMeta.mThreadId][comm.mMeta.mMsgId] = comm; // pushing top comments respective to post
    } else {
      if (Data.ParentCommentMap[comm.mMeta.mParentId] === undefined) {
        Data.ParentCommentMap[comm.mMeta.mParentId] = {};
      }
      Data.ParentCommentMap[comm.mMeta.mParentId][comm.mMeta.mMsgId] = comm;
    }
  } else if (res.body.retval && res.body.votes.length > 0) {
    const vote = res.body.votes[0];
    if (
      Data.Comments[vote.mMeta.mThreadId] &&
      Data.Comments[vote.mMeta.mThreadId][vote.mMeta.mParentId] // finding [post][comment]
    ) {
      if (vote.mVoteType === GXS_VOTE_UP) {
        Data.Comments[vote.mMeta.mThreadId][vote.mMeta.mParentId].comment.mUpVotes += 1;
      }
      if (vote.mVoteType === GXS_VOTE_DOWN) {
        Data.Comments[vote.mMeta.mThreadId][vote.mMeta.mParentId].comment.mDownVotes += 1;
      }
    }
  }
}

async function updatedisplaychannels(keyid, details) {
  const res1 = await rs.rsJsonApiRequest('/rsgxschannels/getChannelsInfo', {
    chanIds: [keyid],
  });
  details = res1.body.channelsInfo[0];
  Data.DisplayChannels[keyid] = {
    name: details.mMeta.mGroupName,
    isSearched: true,
    description: details.mDescription,
    image: details.mImage,
    author: details.mMeta.mAuthorId,
    isSubscribed:
      details.mMeta.mSubscribeFlags === GROUP_SUBSCRIBE_SUBSCRIBED ||
      details.mMeta.mSubscribeFlags === GROUP_MY_CHANNEL,
    posts: details.mMeta.mVisibleMsgCount,
    activity: details.mMeta.mLastPost,
    created: details.mMeta.mPublishTs,
  };

  if (Data.Posts[keyid] === undefined) {
    Data.Posts[keyid] = {};
  }
  const res2 = await rs.rsJsonApiRequest('/rsgxschannels/getContentSummaries', {
    channelId: keyid,
  });

  if (res2.body.retval) {
    res2.body.summaries.map((content) => {
      updatecontent(content, keyid);
    });
  }
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
      updatedisplaychannels(keyid);
    },

    view: (v) => {},
  };
};

const CommentsTable = () => {
  return {
    oninit: (v) => {},
    view: (v) =>
      m('table.comments', [
        m('tr', [
          m('th', ''),
          m('th', 'Comment'),
          m('th', 'Author'),
          m('th', 'Date'),
          m('th', 'Score'),
          m('th', 'Upvotes'),
          m('th', 'DownVotes'),
          m('th', 'OwnVote'),
        ]),
        v.children,
      ]),
  };
};


const FilesTable = () => {
  return {
    oninit: (v) => {},
    view: (v) =>
      m('table.files', [
        m('tr', [m('th', 'File Name'), m('th', 'Size'), m('th', m('i.fas.fa-download'))]),
        v.children,
      ]),
  };
};

function formatbytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

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

const ChannelTable = () => {
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
        placeholder:
          v.attrs.category.localeCompare('channels') === 0 ? 'Search Channels' : 'Search Posts',
        oninput: (e) => {
          searchString = e.target.value.toLowerCase();
          if (v.attrs.category.localeCompare('channels') === 0) {
            for (const hash in Data.DisplayChannels) {
              if (Data.DisplayChannels[hash].name.toLowerCase().indexOf(searchString) > -1) {
                Data.DisplayChannels[hash].isSearched = true;
              } else {
                Data.DisplayChannels[hash].isSearched = false;
              }
            }
          } else {
            for (const hash in Data.Posts[v.attrs.channelId]) {
              if (
                Data.Posts[v.attrs.channelId][hash].post.mMeta.mMsgName
                  .toLowerCase()
                  .indexOf(searchString) > -1
              ) {
                Data.Posts[v.attrs.channelId][hash].isSearched = true;
              } else {
                Data.Posts[v.attrs.channelId][hash].isSearched = false;
              }
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
  ChannelSummary,
  formatbytes,
  DisplayChannelsFromList,
  updatedisplaychannels,
  ChannelTable,
  FilesTable,
  CommentsTable,
  GROUP_SUBSCRIBE_ADMIN,
  GROUP_SUBSCRIBE_NOT_SUBSCRIBED,
  GROUP_SUBSCRIBE_PUBLISH,
  GROUP_SUBSCRIBE_SUBSCRIBED,
  GROUP_MY_CHANNEL,
  GXS_VOTE_DOWN,
  GXS_VOTE_UP,
  RS_FILE_REQ_ANONYMOUS_ROUTING,
};
