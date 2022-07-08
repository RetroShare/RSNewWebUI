const m = require('mithril');
const rs = require('rswebui');
const util = require('channels/channels_util');
const Data = util.Data;
const peopleUtil = require('people/people_util');
const sha1 = require('channels/sha1');

const filesUploadHashes = {
  // not a good practice, figure out a better way later.
  PostFiles: [],
  Thumbnail: [],
};

async function parseFile(file, type) {
  const fileSize = file.size;
  const chunkSize = 1024 * 1024; // bytes
  let offset = 0;
  let chunkReaderBlock = null;
  const hash = sha1.create();

  const readEventHandler = async function (evt) {
    if (evt.target.error == null) {
      offset += evt.target.result.length;
      await hash.update(evt.target.result);
    } else {
      console.log('Read error: ' + evt.target.error);
      return;
    }
    if (offset >= fileSize) {
      const ans = await hash.hex();
      console.log(ans);
      if (type.localeCompare('multiple') === 0) {
        filesUploadHashes.PostFiles.push(ans);
      } else {
        filesUploadHashes.Thumbnail.push(ans);
      }
      return;
    }

    // of to the next chunk
    await chunkReaderBlock(offset, chunkSize, file);
  };

  chunkReaderBlock = async function (_offset, length, _file) {
    const reader = new FileReader();
    const blob = await _file.slice(_offset, length + _offset);
    reader.onload = readEventHandler;
    await reader.readAsText(blob);
  };

  // read with the first block
  await chunkReaderBlock(offset, chunkSize, file);
}

const AddPost = () => {
  let content = '';
  let ptitle = '';
  const pthumbnail = [];
  const pfiles = [];
  let uploadFiles = false;
  let uploadThumbnail = false;

  return {
    view: (vnode) =>
      m('.widget', [
        m('h3', 'Add Post'),
        m('hr'),
        m('label[for=thumbnail]', 'Thumbnail: '),
        m('input[type=file][name=files][id=thumbnail][accept=image/*]', {
          onchange: async (e) => {
            filesUploadHashes.Thumbnail = [];
            await parseFile(e.target.files[0], '');
            console.log(filesUploadHashes.Thumbnail, filesUploadHashes.Thumbnail.length);

            if (filesUploadHashes.Thumbnail.length === e.target.files.length) {
              pthumbnail.push({
                name: e.target.files[0].name,
                size: e.target.files[0].size,
                hash: filesUploadHashes.Thumbnail[0],
              });
              uploadThumbnail = true;
            }
          },
        }),
        m('label[for=browse]', 'Attachments: '),
        m('input[type=file][name=files][id=browse][multiple=multiple]', {
          onchange: async (e) => {
            filesUploadHashes.PostFiles = [];
            for (let i = 0; i < e.target.files.length; i++) {
              await parseFile(e.target.files[i], 'multiple');
            }
            console.log(filesUploadHashes.PostFiles, filesUploadHashes.PostFiles.length);

            if (filesUploadHashes.PostFiles.length === e.target.files.length) {
              for (let i = 0; i < e.target.files.length; i++) {
                pfiles.push({
                  name: e.target.files[i].name,
                  size: e.target.files[i].size,
                  hash: filesUploadHashes.PostFiles[i],
                });
              }
              uploadFiles = true;
            }
          },
        }),
        m('input[type=text][placeholder=Title]', {
          oninput: (e) => (ptitle = e.target.value),
        }),
        m('textarea[rows=5][style="width: 90%; display: block;"]', {
          oninput: (e) => (content = e.target.value),
          value: content,
        }),
        m(
          'button',
          {
            onclick: async () => {
              if (uploadFiles && uploadThumbnail) {
                console.log(vnode.attrs.chanId, ptitle, content, pfiles, pthumbnail);
                // const res = await rs.rsJsonApiRequest('/rsgxschannels/createPostV2', {
                //   channelId: vnode.attrs.chanId,
                //   title: ptitle,
                //   mBody: content,
                //   files: pfiles,
                //   thumbnail: pthumbnail,
                // });
                // res.body.retval === false
                //   ? util.popupMessage([m('h3', 'Error'), m('hr'), m('p', res.body.errorMessage)])
                //   : util.popupMessage([
                //       m('h3', 'Success'),
                //       m('hr'),
                //       m('p', 'Post added successfully'),
                //     ]);
              }
            },
          },
          'Add'
        ),
      ]),
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
              'button',
              { onclick: () => util.popupMessage(m(AddPost, { chanId: v.attrs.id })) },
              'Add Post'
            ),
            m('hr'),

            m(
              '[id=grid]',
              Object.keys(plist).map((key, index) => [
                m(
                  'div',
                  {
                    class: 'card',
                    style: 'display: ' + (plist[key].isSearched ? 'block' : 'none'),
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
                      src: 'data:image/png;base64,' + plist[key].post.mThumbnail.mData.base64,

                      alt: 'No Thumbnail',
                    }),
                    m('div', { class: 'card-info' }, [
                      m('h4', { class: 'card-title' }, plist[key].post.mMeta.mMsgName),
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

async function AddVote(voteType, vchannelId, vpostId, vauthorId, vcommentId) {
  // const res = await rs.rsJsonApiRequest('/rsgxschannels/createVoteV2', {
  //   channelId: vchannelId,
  //   postId: vpostId,
  //   authorId: vauthorId,
  //   commentId: vcommentId,
  //   vote: voteType,
  // });
  // if (res.body.retval) util.updateDisplayChannels(vchannelId);
}

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
function DisplayComment() {
  // No reliance on initialisation signature
  return {
    oninit: (v) => {
      console.log(v.attrs.commentStruct.comment.mComment);
    },
    view: ({ attrs: { commentStruct, identity } }) => {
      // Use component / vnode interface instead
      const comment = commentStruct.comment;
      let parMap = [];
      if (Data.ParentCommentMap[comment.mMeta.mMsgId]) {
        parMap = Array.from(Data.ParentCommentMap[comment.mMeta.mMsgId]);
      } // console.log(parMap);
      // console.log(Array.from(Data.ParentCommentMap[comment.mMeta.mMsgId]));
      return [
        m('tr', [
          (parMap.length > 0)?m('td', m('i.fas.fa-angle-right', {
            class: 'fa-rotate-' + (commentStruct.showReplies ? '90' : '0'),
            style: 'margin-top:12px',
            onclick: () => {
              commentStruct.showReplies = !commentStruct.showReplies;
            },
          })):m('td', ''),

          m('td', comment.mComment),
          m(
            'select[id=options]',
            {
              onchange: (e) => {
                if (e.target.selectedIndex === 1) {
                  // reply
                  util.popupMessage(
                    m(AddComment, {
                      parent_comment: comment.mComment,
                      channelId: comment.mMeta.mGroupId,
                      authorId: identity,
                      threadId: comment.mMeta.mThreadId,
                      parentId: comment.mMeta.mMsgId,
                    })
                  );
                } else if (e.target.selectedIndex === 2) {
                  // voteUP
                  AddVote(
                    util.GXS_VOTE_UP,
                    comment.mMeta.mGroupId,
                    comment.mMeta.mThreadId,
                    identity,
                    comment.mMeta.mMsgId
                  );
                } else if (e.target.selectedIndex === 3) {
                  AddVote(
                    util.GXS_VOTE_DOWN,
                    comment.mMeta.mGroupId,
                    comment.mMeta.mThreadId,
                    identity,
                    comment.mMeta.mMsgId
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
          m('td', rs.userList.userMap[comment.mMeta.mAuthorId]),
          m(
            'td',
            typeof comment.mMeta.mPublishTs === 'object'
              ? new Date(comment.mMeta.mPublishTs.xint64 * 1000).toLocaleString()
              : 'undefined'
          ),
          m('td', comment.mScore),
          m('td', comment.mUpVotes),
          m('td', comment.mDownVotes),
        ]),
        commentStruct.showReplies &&
          // Data.ParentCommentMap[comment.mMeta.mMsgId] &&
          // Data.ParentCommentMap[comment.mMeta.mMsgId].forEach(
          //   (value) =>
          parMap.map(
            (value) =>
            // console.log(value)
            // Data.Comments[Data.ParentCommentMap[comment.mMeta.mMsgId][key].mMeta.mThreadId] &&
            // Data.Comments[Data.ParentCommentMap[comment.mMeta.mMsgId][key].mMeta.mThreadId][
            //   Data.ParentCommentMap[comment.mMeta.mMsgId][key].mMeta.mMsgId
            // ] &&
            m(DisplayComment, {
              commentStruct:
                Data.Comments[value.mMeta.mThreadId][
                  value.mMeta.mMsgId
                ],
              identity,
            })
          ),
      ];
    },
  };
}

const PostView = () => {
  let post = {};
  let topComments = {};
  const filesInfo = {};
  let ownId = {};
  return {
    oninit: (v) => {
      if (Data.Posts[v.attrs.channelId] && Data.Posts[v.attrs.channelId][v.attrs.msgId]) {
        post = Data.Posts[v.attrs.channelId][v.attrs.msgId].post;
      }
      if (Data.TopComments[v.attrs.msgId]) {
        topComments = Data.TopComments[v.attrs.msgId];
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
            Object.keys(topComments).map((key, index) =>
              Data.Comments[topComments[key].mMeta.mThreadId] &&
              Data.Comments[topComments[key].mMeta.mThreadId][topComments[key].mMeta.mMsgId]
                ? m(DisplayComment, {
                    // Do not call DisplayComment as a function, invoke like a component
                    identity: ownId, // supply the input as named attributes
                    commentStruct:
                      Data.Comments[topComments[key].mMeta.mThreadId][
                        topComments[key].mMeta.mMsgId
                      ],
                  })
                : ''
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
