const m = require('mithril');
const rs = require('rswebui');

// rstypes.h:96
const GROUP_SUBSCRIBE_ADMIN = 0x01; //  means: you have the admin key for this group
const GROUP_SUBSCRIBE_PUBLISH = 0x02; //  means: you have the publish key for thiss group. Typical use: publish key in channels are shared with specific friends.
const GROUP_SUBSCRIBE_SUBSCRIBED = 0x04; //  means: you are subscribed to a group, which makes you a source for this group to your friend nodes.
const GROUP_SUBSCRIBE_NOT_SUBSCRIBED = 0x08;

const GROUP_MY_CHANNEL =
  GROUP_SUBSCRIBE_ADMIN + GROUP_SUBSCRIBE_SUBSCRIBED + GROUP_SUBSCRIBE_PUBLISH;

// rsfiles.h:168
const RS_FILE_REQ_ANONYMOUS_ROUTING = 0x00000040;

// rsgxscommon.h:194
const GXS_VOTE_DOWN = 0x0001;
const GXS_VOTE_UP = 0x0002;

// rsgxscircles.h:50
const PUBLIC = 1; // Public distribution
const EXTERNAL = 2; // Restricted to an external circle, based on GxsIds
const NODES_GROUP = 3;

const Data = {
  DisplayChannels: {}, // chanID -> channel info
  Posts: {}, // chanID, PostID -> {post, isSearched}
  Comments: {}, // threadID, msgID -> {Comment, showReplies}
  TopComments: {}, // threadID, msgID -> comment(Top thread comment)
  ParentCommentMap: {}, // stores replies of a comment threadID, msgID -> comment
  Votes: {},
};

//  getChannelContent takes a set of ids, so a whole channel is fetched in a few
//  requests instead of one per item. Chunked rather than sent as a single call so
//  that no request grows unbounded and so the UI can paint as batches land.
const CONTENT_BATCH_SIZE = 25;

function storePost(post, channelid) {
  const msgId = post.mMeta && post.mMeta.mMsgId;
  if (!msgId) {
    return;
  }
  Data.Posts[channelid][msgId] = { post, isSearched: true };
}

function storeComment(comm) {
  const meta = comm.mMeta;
  if (!meta) {
    return;
  }
  if (Data.Comments[meta.mThreadId] === undefined) {
    Data.Comments[meta.mThreadId] = {};
  }
  Data.Comments[meta.mThreadId][meta.mMsgId] = { comment: comm, showReplies: false }; //  Comments[post][comment]
  if (Data.TopComments[meta.mThreadId] === undefined) {
    Data.TopComments[meta.mThreadId] = {};
  }
  if (meta.mThreadId === meta.mParentId) {
    // this is a check for the top level comments
    Data.TopComments[meta.mThreadId][meta.mMsgId] = comm;
    //  pushing top comments respective to post
  } else {
    if (Data.ParentCommentMap[meta.mParentId] === undefined) {
      Data.ParentCommentMap[meta.mParentId] = {};
    }
    Data.ParentCommentMap[meta.mParentId][meta.mMsgId] = comm;
  }
}

function storeVote(vote) {
  const meta = vote.mMeta;
  if (!meta) {
    return;
  }
  if (Data.Votes[meta.mThreadId] === undefined) {
    Data.Votes[meta.mThreadId] = {};
  }
  if (Data.Votes[meta.mThreadId][meta.mParentId] === undefined) {
    Data.Votes[meta.mThreadId][meta.mParentId] = { upvotes: 0, downvotes: 0 };
  }
  if (vote.mVoteType === GXS_VOTE_UP) {
    Data.Votes[meta.mThreadId][meta.mParentId].upvotes += 1;
  }

  if (vote.mVoteType === GXS_VOTE_DOWN) {
    Data.Votes[meta.mThreadId][meta.mParentId].downvotes += 1;
  }
}

async function updatecontent(contentIds, channelid) {
  const ids = Array.isArray(contentIds) ? contentIds : [contentIds];
  if (ids.length === 0) {
    return true;
  }
  const res = await rs.rsJsonApiRequest('/rsgxschannels/getChannelContent', {
    channelId: channelid,
    contentsIds: ids,
  });
  //  rsJsonApiRequest resolves to undefined when the request never made it out
  if (!res || !res.body || !res.body.retval) {
    return false;
  }
  //  A batch mixes the three kinds, so all three lists have to be walked. The
  //  metadata of each item is used rather than the summary it was asked from.
  (res.body.posts || []).forEach((post) => storePost(post, channelid));
  (res.body.comments || []).forEach(storeComment);
  (res.body.votes || []).forEach(storeVote);
  return true;
}

// Large posts can contain base64 media. If RetroShare truncates a response,
// retry it as two smaller requests until the problematic batch is isolated.
async function updateContentBatch(contentIds, channelid) {
  const loaded = await updatecontent(contentIds, channelid);
  if (loaded || contentIds.length <= 1) {
    if (!loaded) {
      console.warn('Unable to load channel content item', contentIds[0]);
    }
    return;
  }

  const middle = Math.ceil(contentIds.length / 2);
  await updateContentBatch(contentIds.slice(0, middle), channelid);
  await updateContentBatch(contentIds.slice(middle), channelid);
}

async function updatedisplaychannels(keyid, details, loadContent = true) {
  const res1 = await rs.rsJsonApiRequest('/rsgxschannels/getChannelsInfo', {
    chanIds: [keyid],
  });
  if (!res1 || !res1.body || !Array.isArray(res1.body.channelsInfo) || !res1.body.channelsInfo[0]) {
    return;
  }
  details = res1.body.channelsInfo[0];
  Data.DisplayChannels[keyid] = {
    // struct for a channel
    name: details.mMeta.mGroupName,
    isSearched: true,
    description: details.mDescription,
    image: details.mImage,
    author: details.mMeta.mAuthorId,
    isSubscribed:
      details.mMeta.mSubscribeFlags === GROUP_SUBSCRIBE_SUBSCRIBED ||
      details.mMeta.mSubscribeFlags === GROUP_MY_CHANNEL,
    mychannel: details.mMeta.mSubscribeFlags === GROUP_MY_CHANNEL,
    posts: details.mMeta.mVisibleMsgCount,
    activity: details.mMeta.mLastPost,
    created: details.mMeta.mPublishTs,
  };

  if (Data.Posts[keyid] === undefined) {
    Data.Posts[keyid] = {};
  }
  // Channel lists only need metadata. Fetching every post, comment, vote and
  // embedded image for every listed channel made large lists extremely slow.
  if (!loadContent) {
    return;
  }
  const res2 = await rs.rsJsonApiRequest('/rsgxschannels/getContentSummaries', {
    channelId: keyid,
  });

  if (!res2 || !res2.body || !res2.body.retval || !Array.isArray(res2.body.summaries)) {
    return;
  }

  const ids = res2.body.summaries.map((content) => content.mMsgId).filter(Boolean);
  //  Sequential on purpose: this runs once per channel of the list, so firing the
  //  batches concurrently would put the browser back where it started.
  for (let i = 0; i < ids.length; i += CONTENT_BATCH_SIZE) {
    await updateContentBatch(ids.slice(i, i + CONTENT_BATCH_SIZE), keyid);
    m.redraw();
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
      updatedisplaychannels(keyid, undefined, false);
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
      m('table.files.channel-files', [
        m('thead', m('tr', [m('th', 'File Name'), m('th', 'Size'), m('th', m('i.fas.fa-download'))])),
        v.children,
      ]),
  };
};

const ChannelTable = () => {
  return {
    view: (v) => m('table.channels', [m('tr', [m('th', 'Channel Name')]), v.children]),
  };
};
const SearchBar = () => {
  // same search bar is used for both channels and posts
  let searchString = '';
  return {
    view: (v) =>
      m('input[type=text][placeholder=Search Subject].searchbar', {
        value: searchString,
        placeholder:
          v.attrs.category.localeCompare('channels') === 0 ? 'Search Channels' : 'Search Posts',
        oninput: (e) => {
          searchString = e.target.value.toLowerCase();
          if (v.attrs.category.localeCompare('channels') === 0) {
            // for channels
            for (const hash in Data.DisplayChannels) {
              if (Data.DisplayChannels[hash].name.toLowerCase().indexOf(searchString) > -1) {
                Data.DisplayChannels[hash].isSearched = true;
              } else {
                Data.DisplayChannels[hash].isSearched = false;
              }
            }
          } else {
            for (const hash in Data.Posts[v.attrs.channelId]) {
              // for posts
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
  ChannelSummary,
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
  PUBLIC,
  EXTERNAL,
  NODES_GROUP,
  RS_FILE_REQ_ANONYMOUS_ROUTING,
};
