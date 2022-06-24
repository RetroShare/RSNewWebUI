const m = require('mithril');
const rs = require('rswebui');
const util = require('channels/channels_util');
const Data = util.Data;
const peopleUtil = require('people/people_util');

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

const AddComment = () => {
  let inputComment = '';
  return {
    view: (vnode) =>
      m('.widget', [
        m('h3', 'Add Comment'),
        m('hr'),
        (vnode.attrs.parent_comment !== '') > 0
          ? [m('h5', 'Reply to comment: '), m('p', vnode.attrs.parent_comment)]
          : '',
        m('textarea[rows=5][style="width: 90%; display: block;"]', {
          oninput: (e) => (inputComment = e.target.value),
          value: inputComment,
        }),
        m(
          'button',
          {
            onclick: async () => {
              const res = await rs.rsJsonApiRequest('/rsgxschannels/createCommentV2', {
                channelId: vnode.attrs.channelId,
                threadId: vnode.attrs.threadId,
                comment: inputComment,
                authorId: vnode.attrs.authorId,
                parentId: vnode.attrs.parentId,
              });

              res.body.retval === false
                ? util.popupMessage([m('h3', 'Error'), m('hr'), m('p', res.body.errorMessage)])
                : util.popupMessage([
                    m('h3', 'Success'),
                    m('hr'),
                    m('p', 'Comment added successfully'),
                  ]);
              util.updateDisplayChannels(vnode.attrs.channelId);
            },
          },
          'Add'
        ),
      ]),
  };
};
const PostView = () => {
  let post = {};
  let comments = {};
  const filesInfo = {};
  let ownId = {};
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
      peopleUtil.ownIds((data) => {
        ownId = data[0];
      });
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
          util.FilesTable,
          m(
            'tbody',
            post.mFiles.map((file) =>
              m('tr', [
                m('td', file.mName),
                m('td', util.formatBytes(file.mSize.xint64)),
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
                              flags: util.RS_FILE_REQ_ANONYMOUS_ROUTING,
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
          'button',
          {
            onclick: () => {
              util.popupMessage(
                m(AddComment, {
                  parent_comment: '',
                  channelId: v.attrs.channelId,
                  authorId: ownId,
                  threadId: v.attrs.msgId,
                  parentId: v.attrs.msgId,
                })
              );
            },
          },
          'Add Comment'
        ),
        m(
          util.CommentsTable,
          m(
            'tbody',
            Object.keys(comments).map((key, index) =>
              m('tr', [
                m('td', comments[key].mComment),
                m(
                  'select[id=options]',
                  {
                    onchange: (e) => {
                      if (e.target.selectedIndex === 1) {
                        util.popupMessage(
                          m(AddComment, {
                            parent_comment: comments[key].mComment,
                            channelId: v.attrs.channelId,
                            authorId: ownId,
                            threadId: comments[key].mMeta.mThreadId,
                            parentId: comments[key].mMeta.mMsgId,
                          })
                        );
                      }
                    },
                  },
                  [
                    m('option[hidden][selected]', 'Options'),
                    util.optionSelect.opts.map((option) =>
                      m('option', { value: option }, option.toLocaleString())
                    ),
                  ]
                ),
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

module.exports = {
  ChannelView,
  PostView,
};
