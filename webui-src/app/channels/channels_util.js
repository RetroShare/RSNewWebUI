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
};

async function updateContent(content, channelid) {
  const res = await rs.rsJsonApiRequest('/rsgxschannels/getChannelContent', {
    channelId: channelid,
    contentsIds: [content.mMsgId],
  });
  // console.log(res.body.posts);
  if (res.body.retval && res.body.posts.length > 0) {
    Data.Posts[channelid][content.mMsgId] = res.body.posts[0];
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
      if (vote.mVoteType == GXS_VOTE_UP) {
        Data.Comments[vote.mMeta.mThreadId][vote.mMeta.mParentId].mUpVotes += 1;
      }
      if (vote.mVoteType == GXS_VOTE_DOWN) {
        Data.Comments[vote.mMeta.mThreadId][vote.mMeta.mParentId].mDownVotes += 1;
      }
    }
  }
}

async function updateDisplayChannels(keyid, details) {
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
    all: details,
  };

  if (Data.Posts[keyid] === undefined) {
    Data.Posts[keyid] = {};
  }
  const res2 = await rs.rsJsonApiRequest('/rsgxschannels/getContentSummaries', {
    channelId: keyid,
  });

  if (res2.body.retval) {
    res2.body.summaries.map((content) => {
      updateContent(content, keyid);
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
      updateDisplayChannels(keyid);
    },

    view: (v) => {},
  };
};

const ChannelView = () => {
  let cname = '';
  let cimage = '';
  let cauthor = '';
  let csubscribed = {};
  let cposts = 0;
  let plist = {};
  let createDate = {};
  let lastActivity = {};
  return {
    oninit: (v) => {
      if (Data.DisplayChannels[v.attrs.id]) {
        cname = Data.DisplayChannels[v.attrs.id].name;
        cimage = Data.DisplayChannels[v.attrs.id].image;
        if (rs.userList.userMap[Data.DisplayChannels[v.attrs.id].author]) {
          cauthor = rs.userList.userMap[Data.DisplayChannels[v.attrs.id].author];
        } else if (Number(Data.DisplayChannels[v.attrs.id].author) === 0) {
          cauthor = 'No Contact Author';
        } else {
          cauthor = 'Unknown';
        }
        csubscribed = Data.DisplayChannels[v.attrs.id].isSubscribed;
        cposts = Data.DisplayChannels[v.attrs.id].posts;
        createDate = Data.DisplayChannels[v.attrs.id].created;
        lastActivity = Data.DisplayChannels[v.attrs.id].activity;
      }
      if (Data.Posts[v.attrs.id]) {
        plist = Data.Posts[v.attrs.id];
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
                m.route.set('/channels/:tab', {
                  tab: m.route.param().tab,
                }),
            },
            m('i.fas.fa-arrow-left')
          ),
          m('h3', cname),

          m(
            'button',
            {
              onclick: async () => {
                const res = await rs.rsJsonApiRequest('/rsgxschannels/subscribeToChannel', {
                  channelId: v.attrs.id,
                  subscribe: !csubscribed,
                });
                if (res.body.retval) {
                  csubscribed = !csubscribed;
                  Data.DisplayChannels[v.attrs.id].isSubscribed = csubscribed;
                }
              },
            },
            csubscribed ? 'Subscribed' : 'Subscribe'
          ),
          m('img.channelpic', {
            src: 'data:image/png;base64,' + cimage.mData.base64,
          }),
          m('[id=channeldetails]', [
            m('p', m('b', 'Posts: '), cposts),
            m(
              'p',
              m('b', 'Date created: '),
              typeof createDate === 'object'
                ? new Date(createDate.xint64 * 1000).toLocaleString()
                : 'undefined'
            ),
            m('p', m('b', 'Admin: '), cauthor),
            m(
              'p',
              m('b', 'Last activity: '),
              typeof lastActivity === 'object'
                ? new Date(lastActivity.xint64 * 1000).toLocaleString()
                : 'undefined'
            ),
          ]),
          m('hr'),
          m('channeldesc', m('b', 'Description: '), Data.DisplayChannels[v.attrs.id].description),
          m('hr'),
          m(
            'postdetails',
            {
              style: 'display:' + (csubscribed ? 'block' : 'none'),
            },
            m('h3', 'Posts'),

            m(
              '[id=grid]',
              Object.keys(plist).map((key, index) => [
                m(
                  'div',
                  {
                    class: 'card',
                    onclick: () => {
                      m.route.set('/channels/:tab/:mGroupId/:mMsgId', {
                        tab: m.route.param().tab,
                        mGroupId: v.attrs.id,
                        mMsgId: key,
                      });
                    },
                  },
                  [
                    m('img', {
                      class: 'card-img',
                      src: 'data:image/png;base64,' + plist[key].mThumbnail.mData.base64,

                      alt: 'No Thumbnail',
                    }),
                    m('div', { class: 'card-info' }, [
                      m('h4', { class: 'card-title' }, plist[key].mMeta.mMsgName),
                    ]),
                  ]
                ),
              ])
            )
          ),
        ]
      ),
  };
};
const CommentsTable = () => {
  return {
    oninit: (v) => {},
    view: (v) =>
      m('table.comments', [
        m('tr', [
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

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const PostView = () => {
  let post = {};
  let comments = {};
  const filesInfo = {};
  return {
    oninit: (v) => {
      if (Data.Posts[v.attrs.channelId] && Data.Posts[v.attrs.channelId][v.attrs.msgId]) {
        post = Data.Posts[v.attrs.channelId][v.attrs.msgId];
      }
      if (Data.Comments[v.attrs.msgId]) {
        comments = Data.Comments[v.attrs.msgId];
      }
      if (post) {
        post.mFiles.map(async (file) => {
          const res = await rs.rsJsonApiRequest('/rsfiles/alreadyHaveFile', {
            hash: file.mHash,
          });
          filesInfo[file.mHash] = res.body;
        });
      }
    },
    view: (v) =>
      m('.widget', { key: v.attrs.msgId }, [
        m(
          'a[title=Back]',
          {
            onclick: () =>
              m.route.set('/channels/:tab/:mGroupId', {
                tab: m.route.param().tab,
                mGroupId: m.route.param().mGroupId,
              }),
          },
          m('i.fas.fa-arrow-left')
        ),
        m('h3', post.mMeta.mMsgName),
        m('p', m.trust(post.mMsg)),
        m('hr'),
        m('h3', 'Files(' + post.mAttachmentCount + ')'),
        m(
          FilesTable,
          m(
            'tbody',
            post.mFiles.map((file) =>
              m('tr', [
                m('td', file.mName),
                m('td', formatBytes(file.mSize.xint64)),
                m(
                  'button',
                  {
                    onclick: async () => {
                      filesInfo[file.mHash]
                        ? filesInfo[file.mHash].retval
                          ? ''
                          : await rs.rsJsonApiRequest('/rsFiles/FileRequest', {
                              fileName: file.mName,
                              hash: file.mHash,
                              flags: RS_FILE_REQ_ANONYMOUS_ROUTING,
                              size: {
                                xstr64: file.mSize.xstr64,
                              },
                            })
                        : '';
                    },
                  },
                  filesInfo[file.mHash]
                    ? filesInfo[file.mHash].retval
                      ? 'Open File'
                      : ['Download', m('i.fas.fa-download')]
                    : 'Please Wait...'
                ),
              ])
            )
          )
        ),
        m('hr'),
        m('h3', 'Comments'),
        m(
          CommentsTable,
          m(
            'tbody',
            Object.keys(comments).map((key, index) =>
              m('tr', [
                m('td', comments[key].mComment),
                m('td', rs.userList.userMap[comments[key].mMeta.mAuthorId]),
                m(
                  'td',
                  typeof comments[key].mMeta.mPublishTs === 'object'
                    ? new Date(comments[key].mMeta.mPublishTs.xint64 * 1000).toLocaleString()
                    : 'undefined'
                ),
                m('td', comments[key].mScore),
                m('td', comments[key].mUpVotes),
                m('td', comments[key].mDownVotes),
              ])
            )
          )
        ),
      ]),
  };
};

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
        oninput: (e) => {
          searchString = e.target.value.toLowerCase();
          for (const hash in Data.DisplayChannels) {
            if (Data.DisplayChannels[hash].name.toLowerCase().indexOf(searchString) > -1) {
              Data.DisplayChannels[hash].isSearched = true;
            } else {
              Data.DisplayChannels[hash].isSearched = false;
            }
          }
        },
      }),
  };
};

module.exports = {
  SearchBar,
  ChannelSummary,
  ChannelView,
  PostView,
  DisplayChannelsFromList,
  ChannelTable,
  GROUP_SUBSCRIBE_ADMIN,
  GROUP_SUBSCRIBE_NOT_SUBSCRIBED,
  GROUP_SUBSCRIBE_PUBLISH,
  GROUP_SUBSCRIBE_SUBSCRIBED,
  GROUP_MY_CHANNEL,
};
