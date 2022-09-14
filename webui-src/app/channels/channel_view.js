const m = require('mithril');
const rs = require('rswebui');
const util = require('channels/channels_util');
const widget = require('widgets');
const Data = util.Data;
const peopleUtil = require('people/people_util');
const sha1 = require('channels/sha1');
const fileUtil = require('files/files_util');
const fileDown = require('files/files_downloads');

const filesUploadHashes = {
  // figure out a better way later.
  PostFiles: [],
  Thumbnail: [],
};

async function parsefile(file, type) {
  const fileSize = file.size;
  const chunkSize = 1024 * 1024; // bytes
  let offset = 0;
  let chunkreaderblock = null;
  const hash = sha1.create();
  const ansList = [];

  // const readEventHandler = async function (evt) {
  //   if (evt.target.error == null) {
  //     offset += evt.target.result.length;
  //     await hash.update(evt.target.result);
  //   } else {
  //     console.log('Read error: ' + evt.target.error);
  //     return;
  //   }
  //   if (offset >= fileSize) {
  //     const ans = await hash.hex();
  //     console.log(ans);
  //     ansList.push(ans);
  //     if (type.localeCompare('multiple') === 0) {
  //       filesUploadHashes.PostFiles.push(ans);
  //     } else {
  //       filesUploadHashes.Thumbnail.push(ans);
  //     }
  //     return;
  //   }

  //   // of to the next chunk
  //   await chunkreaderblock(offset, chunkSize, file);
  //   return ansList;
  // };

  chunkreaderblock = async function (_offset, length, _file) {
    // const reader = new FileReader();
    const blob = await _file.slice(_offset, length + _offset);
    const data = await blob.text();
    offset += data.length;
    await hash.update(data);
    if (offset >= fileSize) {
      const ans = await hash.hex();
      // console.log(ans);
      // ansList.push(ans);
      if (type.localeCompare('multiple') === 0) {
        filesUploadHashes.PostFiles.push(ans);
      } else {
        filesUploadHashes.Thumbnail.push(ans);
      }
      return;
    }

    // of to the next chunk
    await chunkreaderblock(offset, chunkSize, file);
  };

  // read with the first block
  await chunkreaderblock(offset, chunkSize, file);
  return ansList;
}
const messageGroups = ['Public', 'Restricted Circle', 'Restricted Node Group'];
const messageGroupsCode = [util.PUBLIC, util.EXTERNAL, util.NODES_GROUP]; //rsgxscirles.h:50

function createchannel() {
  let title;
  let body;
  let identity;
  let thumbnail;
  let selectedGroup = messageGroups[0];
  let selectedGroupCode = messageGroupsCode[0];
  let selectedCircle;
  let circles;
  return {
    oninit: async (vnode) => {
      if (vnode.attrs.authorId) {
        identity = vnode.attrs.authorId[0];
      }

      const res = await rs.rsJsonApiRequest('/rsgxscircles/getCirclesSummaries');
      if (res.body.retval) {
        circles = res.body.circles;
        selectedCircle = circles[0].mGroupName;
      }
    },
    view: (vnode) =>
      m('.widget', [
        m('h3', 'Create Channel'),
        m('hr'),
        m('input[type=text][placeholder=Title]', {
          style: { float: 'left' },
          oninput: (e) => (title = e.target.value),
        }),
        m('div', { style: { float: 'right', marginTop: '10px', marginBottom: '10px' } }, [
          m('label[for=thumbnail]', 'Thumbnail: '),
          m('input[type=file][name=files][id=thumbnail][accept=image/*]', {
            onchange: async (e) => {
              let reader = new FileReader();
              reader.onloadend = function () {
                thumbnail = reader.result.substring(reader.result.indexOf(',') + 1);
              };
              reader.readAsDataURL(e.target.files[0]);
            },
          }),
        ]),

        m('div', { style: { float: 'right', marginTop: '10px', marginBottom: '10px' } }, [
          m('label[for=idtags]', 'Select identity: '),
          m(
            'select[id=idtags]',
            {
              value: identity,
              onchange: (e) => {
                identity = vnode.attrs.authorId[e.target.selectedIndex];
              },
            },
            [
              vnode.attrs.authorId &&
                vnode.attrs.authorId.map((o) =>
                  m(
                    'option',
                    { value: o },
                    rs.userList.userMap[o]
                      ? rs.userList.userMap[o].toLocaleString() + ' (' + o.slice(0, 8) + '...)'
                      : 'No Signature'
                  )
                ),
            ]
          ),
        ]),
        m('div', { style: { float: 'left', marginTop: '10px', marginBottom: '10px' } }, [
          m('label[for=mtags]', 'Message Distribution: '),
          m(
            'select[id=mtags]',
            {
              value: selectedGroup,
              onchange: (e) => {
                selectedGroup = messageGroups[e.target.selectedIndex];
                selectedGroupCode = messageGroupsCode[e.target.selectedIndex];
                widget.popupMessage(m(createchannel, { authorId: vnode.attrs.authorId }));
              },
            },
            [messageGroups.map((group) => m('option', { value: group }, group))]
          ),
        ]),
        circles &&
          m(
            'div',
            {
              style: {
                float: 'left',
                marginTop: '10px',
                marginBottom: '10px',
                display: selectedGroupCode === util.EXTERNAL ? 'block' : 'none',
              },
            },
            [
              m('label[for=circlestag]', 'Circles: '),
              m(
                'select[id=circlestag]',
                {
                  value: selectedCircle,
                  onchange: (e) => {
                    selectedCircle = circles[e.target.selectedIndex];
                    // selectedGroupCode = messageGroupsCode[e.target.selectedIndex];
                  },
                },
                [
                  circles.map((circle) =>
                    m('option', { value: circle.mGroupName }, circle.mGroupName)
                  ),
                ]
              ),
            ]
          ),
        m('textarea[rows=5][placeholder=Description]', {
          style: { width: '100%', display: 'block' },
          oninput: (e) => (body = e.target.value),
          value: body,
        }),
        m(
          'button',
          {
            onclick: async () => {
              const res = await rs.rsJsonApiRequest('/rsgxschannels/createChannelV2', {
                name: title,
                description: body,
                thumbnail: { mData: { base64: thumbnail } },
                ...(Number(identity) !== 0 && { authorId: identity }), //checks if some identity has to be assigned
                circleType: selectedGroupCode,
                ...(selectedGroupCode === util.EXTERNAL &&
                  selectedCircle && { circleId: selectedCircle.mGroupId }), //checks if the selectedGroup code is EXTERNAL
              });
              if (res.body.retval) {
                util.updatedisplaychannels(res.body.channelId);
                m.redraw();
              }
              res.body.retval === false
                ? widget.popupMessage([m('h3', 'Error'), m('hr'), m('p', res.body.errorMessage)])
                : widget.popupMessage([
                    m('h3', 'Success'),
                    m('hr'),
                    m('p', 'Channel created successfully'),
                  ]);
            },
          },
          'Create'
        ),
      ]),
  };
}

const AddPost = () => {
  let content = '';
  let ptitle = '';
  let pthumbnail = [];
  let pfiles = [];
  let uploadFiles = true;
  return {
    view: (vnode) =>
      m('.widget', [
        m('h3', 'Add Post'),
        m('hr'),
        m('label[for=thumbnail]', 'Thumbnail: '),
        m('input[type=file][name=files][id=thumbnail][accept=image/*]', {
          onchange: async (e) => {
            let reader = new FileReader();
            reader.onloadend = function () {
              pthumbnail = reader.result.substring(reader.result.indexOf(',') + 1);
            };
            reader.readAsDataURL(e.target.files[0]); // converts into base64 string
          },
        }),
        m('label[for=browse]', 'Attachments: '),
        m('input[type=file][name=files][id=browse][multiple=multiple]', {
          // attachments option wrong hash, not working
          onchange: async (e) => {
            uploadFiles = false;
            filesUploadHashes.PostFiles = [];
            pfiles = [];
            for (let i = 0; i < e.target.files.length; i++) {
              await parsefile(e.target.files[i], 'multiple');
            }
            // console.log(filesUploadHashes.PostFiles, filesUploadHashes.PostFiles.length);

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
        m('textarea[rows=5]', {
          style: { width: '90%', display: 'block' },
          oninput: (e) => (content = e.target.value),
          value: content,
        }),
        m(
          'button',
          {
            onclick: async () => {
              if (uploadFiles) {
                // console.log(vnode.attrs.chanId, ptitle, content, pfiles, pthumbnail);
                const res = await rs.rsJsonApiRequest('/rsgxschannels/createPostV2', {
                  channelId: vnode.attrs.chanId,
                  title: ptitle,
                  mBody: content,
                  files: pfiles, //does not work for now
                  thumbnail: { mData: { base64: pthumbnail } },
                });
                res.body.retval === false
                  ? widget.popupMessage([m('h3', 'Error'), m('hr'), m('p', res.body.errorMessage)])
                  : widget.popupMessage([
                      m('h3', 'Success'),
                      m('hr'),
                      m('p', 'Post added successfully'),
                    ]);
                util.updatedisplaychannels(vnode.attrs.chanId);
                m.redraw();
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
  let mychannel = false;
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
        mychannel = Data.DisplayChannels[v.attrs.id].mychannel;
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
            src:
              cimage.mData.base64 === ''
                ? 'data/streaming.png'
                : 'data:image/png;base64,' + cimage.mData.base64,
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
            mychannel &&
              m(
                'button',
                { onclick: () => widget.popupMessage(m(AddPost, { chanId: v.attrs.id })) },
                ['Add Post', m('i.fas.fa-edit')]
              ),
            m('hr'),

            m(
              '[id=grid]',
              Object.keys(plist).map((key, index) => [
                m(
                  'div',
                  {
                    class: 'card',
                    style: 'display: ' + (plist[key].isSearched ? 'block' : 'none'), // for search
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
                      src:
                        plist[key].post.mThumbnail.mData.base64 === ''
                          ? 'data/streaming.png'
                          : 'data:image/png;base64,' + plist[key].post.mThumbnail.mData.base64,

                      alt: '',
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

async function addvote(voteType, vchannelId, vpostId, vauthorId, vcommentId) {
  const res = await rs.rsJsonApiRequest('/rsgxschannels/voteForComment', {
    channelId: vchannelId,
    postId: vpostId,
    authorId: vauthorId,
    commentId: vcommentId,
    vote: voteType,
  });
  if (res.body.retval) {
    util.updatedisplaychannels(vchannelId);
    m.redraw();
  }
}

const AddComment = () => {
  let inputComment = '';
  let identity;
  return {
    oninit: (vnode) => {
      if (vnode.attrs.authorId) {
        identity = vnode.attrs.authorId[0];
      }
    },
    view: (vnode) =>
      m('.widget', [
        m('h3', 'Add Comment'),
        m('label[for=tags]', 'Select identity'),
        m(
          'select[id=idtags]',
          {
            value: identity,
            onchange: (e) => {
              identity = vnode.attrs.authorId[e.target.selectedIndex];
            },
          },
          [
            vnode.attrs.authorId &&
              vnode.attrs.authorId.map((o) =>
                m(
                  'option',
                  { value: o },
                  rs.userList.userMap[o].toLocaleString() + ' (' + o.slice(0, 8) + '...)'
                )
              ),
          ]
        ),
        m('hr'),
        (vnode.attrs.parent_comment !== '') > 0
          ? [m('h5', 'Reply to comment: '), m('p', vnode.attrs.parent_comment)] // if it is add reply option
          : '',
        m('textarea[rows=5]', {
          style: { width: '90%', display: 'block' },
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
                authorId: identity,
                parentId: vnode.attrs.parentId,
              });

              res.body.retval === false
                ? widget.popupMessage([m('h3', 'Error'), m('hr'), m('p', res.body.errorMessage)])
                : widget.popupMessage([
                    m('h3', 'Success'),
                    m('hr'),
                    m('p', 'Comment added successfully'),
                  ]);
              util.updatedisplaychannels(vnode.attrs.channelId);
              m.redraw();
            },
          },
          'Add'
        ),
      ]),
  };
};
function displaycomment() {
  // recursive function to display comments
  return {
    oninit: (v) => {},
    view: ({ attrs: { commentStruct, identity, replyDepth, voteIdentity } }) => {
      const comment = commentStruct.comment;
      let cUpVotes = 0; 
      let cDownVotes = 0;
      let parMap = {};
      if (Data.ParentCommentMap[comment.mMeta.mMsgId]) {
        parMap = Data.ParentCommentMap[comment.mMeta.mMsgId];
      }
      if(Data.Votes[comment.mMeta.mThreadId] && Data.Votes[comment.mMeta.mThreadId][comment.mMeta.mMsgId])
      {
        cUpVotes = Data.Votes[comment.mMeta.mThreadId][comment.mMeta.mMsgId].upvotes;
        cDownVotes = Data.Votes[comment.mMeta.mThreadId][comment.mMeta.mMsgId].downvotes;
      }
      return [
        m('tr', [
          Object.keys(parMap).length // if it has replies
            ? m(
                'td',
                m('i.fas.fa-angle-right', {
                  class: 'fa-rotate-' + (commentStruct.showReplies ? '90' : '0'),
                  style: 'cursor:pointer',
                  onclick: () => {
                    commentStruct.showReplies = !commentStruct.showReplies;
                  },
                })
              )
            : m('td', ''),

          m(
            'td',
            {
              style: {
                position: 'relative',
                '--replyDepth': replyDepth,
                left: 'calc(30px*var(--replyDepth))', // shifts the reply by 30px
              },
            },
            [
              comment.mComment,
              m('options', { style: 'display:block' }, [
                m(
                  'button',
                  {
                    style: 'font-size:15px',
                    onclick: () =>
                      widget.popupMessage(
                        m(AddComment, {
                          parent_comment: comment.mComment,
                          channelId: comment.mMeta.mGroupId,
                          authorId: identity,
                          threadId: comment.mMeta.mThreadId,
                          parentId: comment.mMeta.mMsgId,
                        })
                      ),
                  },
                  'Reply'
                ),
                voteIdentity &&
                  m(
                    'button',
                    {
                      style: 'font-size:15px',
                      onclick: () =>
                        addvote(
                          util.GXS_VOTE_UP,
                          comment.mMeta.mGroupId,
                          comment.mMeta.mThreadId,
                          voteIdentity,
                          comment.mMeta.mMsgId
                        ),
                    },
                    m('i.fas.fa-thumbs-up')
                  ),
                voteIdentity &&
                  m(
                    'button',
                    {
                      style: 'font-size:15px',
                      onclick: () =>
                        addvote(
                          util.GXS_VOTE_DOWN,
                          comment.mMeta.mGroupId,
                          comment.mMeta.mThreadId,
                          voteIdentity,
                          comment.mMeta.mMsgId
                        ),
                    },
                    m('i.fas.fa-thumbs-down')
                  ),
              ]),
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
          m('td', cUpVotes),
          m('td', cDownVotes),
        ]),
        commentStruct.showReplies && // recursive calls for the replies
          // parMap.map((value) =>
          Object.keys(parMap).map((key, index) =>
            m(displaycomment, {
              commentStruct: Data.Comments[parMap[key].mMeta.mThreadId][parMap[key].mMeta.mMsgId],
              voteIdentity,
              identity,
              replyDepth: replyDepth + 1, // for the css
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
  let voteIdentity;
  let ownId;
  return {
    oninit: async (v) => {
      if (Data.Posts[v.attrs.channelId] && Data.Posts[v.attrs.channelId][v.attrs.msgId]) {
        post = Data.Posts[v.attrs.channelId][v.attrs.msgId].post;
      }
      if (Data.TopComments[v.attrs.msgId]) {
        topComments = Data.TopComments[v.attrs.msgId]; // get all the top level parent comments
      }
      if (post) {
        post.mFiles.map(async (file) => {
          const res = await rs.rsJsonApiRequest('/rsfiles/alreadyHaveFile', {
            // checks if the file is already there with the user
            hash: file.mHash,
          });
          filesInfo[file.mHash] = res.body;
        });
      }
      await peopleUtil.ownIds((data) => {
        ownId = data;
        for (let i = 0; i < ownId.length; i++) {
          if (Number(ownId[i]) === 0) {
            ownId.splice(i, 1); // workaround for id '0'
          }
        }
        voteIdentity = ownId[0];
      });
      fileDown.Downloads.loadStatus(); // for retrieving downloading files.
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
                m('td', util.formatbytes(file.mSize.xint64)),
                m(
                  'button',
                  {
                    style: { fontSize: '0.9em' },
                    onclick: async () =>
                      widget.popupMessage([
                        m('p', 'Start Download?'),
                        m(
                          'button',
                          {
                            onclick: async () => {
                              if (filesInfo[file.mHash] && !filesInfo[file.mHash].retval) {
                                const res = await rs.rsJsonApiRequest('/rsFiles/FileRequest', {
                                  fileName: file.mName,
                                  hash: file.mHash,
                                  flags: util.RS_FILE_REQ_ANONYMOUS_ROUTING,
                                  size: {
                                    xstr64: file.mSize.xstr64,
                                  },
                                });
                                res.body.retval === false
                                  ? widget.popupMessage([
                                      m('h3', 'Error'),
                                      m('hr'),
                                      m('p', res.body.errorMessage),
                                    ])
                                  : widget.popupMessage([
                                      m('h3', 'Success'),
                                      m('hr'),
                                      m('p', 'Download Started'),
                                    ]);
                                m.redraw();
                              }
                            },
                          },
                          'Start Download'
                        ),
                      ]),
                  },
                  filesInfo[file.mHash]
                    ? filesInfo[file.mHash].retval
                      ? 'Open File'
                      : ['Download', m('i.fas.fa-download')]
                    : 'Please Wait...'
                ),
                fileDown.list[file.mHash] && // using the file from files_util to display download.
                  m(fileUtil.File, {
                    info: fileDown.list[file.mHash],
                    direction: 'down',
                    transferred: fileDown.list[file.mHash].transfered.xint64,
                    parts: [],
                  }),
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
              widget.popupMessage(
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
          'label[for=idtags',
          {
            style: { marginLeft: '10px' },
          },
          'Voter ID: '
        ),
        m(
          'select[id=idtags]',
          {
            value: voteIdentity,
            onchange: (e) => {
              voteIdentity = ownId[e.target.selectedIndex];
            },
          },
          [
            ownId &&
              ownId.map((o) =>
                m(
                  'option',
                  { value: o },
                  rs.userList.userMap[o].toLocaleString() + ' (' + o.slice(0, 8) + '...)'
                )
              ),
          ]
        ),
        m(
          util.CommentsTable,
          m(
            'tbody',
            Object.keys(topComments).map((key, index) =>
              Data.Comments[topComments[key].mMeta.mThreadId] &&
              Data.Comments[topComments[key].mMeta.mThreadId][topComments[key].mMeta.mMsgId]
                ? m(displaycomment, {
                    // calls the recursive function for all the parents.
                    identity: ownId,
                    voteIdentity,
                    commentStruct:
                      Data.Comments[topComments[key].mMeta.mThreadId][
                        topComments[key].mMeta.mMsgId
                      ],
                    replyDepth: 0,
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
  createchannel,
};
