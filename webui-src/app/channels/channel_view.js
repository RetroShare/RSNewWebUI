const m = require('mithril');
const rs = require('rswebui');
const util = require('channels/channels_util');
const Data = util.Data;
const peopleUtil = require('people/people_util');
const sha1 = require('channels/sha1');

function parseFile(file, callback) {
  var fileSize = file.size;
  var chunkSize = 1024 * 1024; // bytes
  var offset = 0;
  var self = this; // we need a reference to the current object
  var chunkReaderBlock = null;
  var hash = sha1.create();

  var readEventHandler = function (evt) {
    if (evt.target.error == null) {
      offset += evt.target.result.length;
      // console.log(sha1(evt.target.result)); // callback for handling read chunk
      hash.update(evt.target.result);
    } else {
      console.log('Read error: ' + evt.target.error);
      return;
    }
    if (offset >= fileSize) {
      console.log(hash.hex());
      console.log('Done reading file');
      return;
    }

    // of to the next chunk
    chunkReaderBlock(offset, chunkSize, file);
  };

  chunkReaderBlock = function (_offset, length, _file) {
    var r = new FileReader();
    var blob = _file.slice(_offset, length + _offset);
    r.onload = readEventHandler;
    r.readAsText(blob);
  };

  // now let's start the read with the first block
  chunkReaderBlock(offset, chunkSize, file);
}

const AddPost = () => {
  let content = '';
  return {
    view: (vnode) =>
      m('.widget', [
        m('h3', 'Add Post'),
        m('hr'),
        m('label[for=thumbnail]', 'Thumbnail: '),
        m('input[type=file][name=files][id=thumbnail]', {
          onchange: (e) => {
            // sha1(e.target.files);
            // var hash = sha1.create();
            // // hash.update(e.target.files);
            // // hash.hex();
            // console.log(sha1(e.target.files[0]));
            // console.log(hash.update(e.target.files[0]));
            // console.log(hash.hex());
            // console.log(e.target.files[0]);
            parseFile(e.target.files[0]);
          },
        }),
        m('label[for=browse]', 'Attachments: '),
        m('input[type=file][name=files][id=browse][multiple=multiple]', {
          onchange: (e) => {
            console.log(e.target.files);
          },
        }),
        m('input[type=text][placeholder=Title]', {
          oninput: (e) => console.log(e.target.value),
        }),
        m('textarea[rows=5][style="width: 90%; display: block;"]', {
          oninput: (e) => (content = e.target.value),
          value: content,
        }),
        m('button', {}, 'Add'),
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
            m('button', { onclick: () => util.popupMessage(m(AddPost)) }, 'Add Post'),
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

function DisplayComment(comment, identity) {
  let showReplies = false;
  return {
    oninit: (v) => {
      console.log(comment.mComment);
      if (Data.ParentCommentMap[comment.mMeta.mMsgId]) {
        Data.ParentCommentMap[comment.mMeta.mMsgId].forEach((value) => console.log(value));
      }
    },
    view: (v) => [
      m('tr', [
        m('i.fas.fa-angle-right', {
          class: 'fa-rotate-' + (showReplies ? '90' : '0'),
          style: 'margin-top:12px',
          onclick: () => {
            showReplies = !showReplies;
            console.log(showReplies);
          },
        }),

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
      showReplies
        ? Data.ParentCommentMap[comment.mMeta.mMsgId]
          ? Data.ParentCommentMap[comment.mMeta.mMsgId].forEach(
              (value) => m(DisplayComment(value, identity))
              // console.log(value)
            )
          : 'undef'
        : 'toggle',
    ],
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
            Object.keys(topComments).map((key, index) => m(DisplayComment(topComments[key], ownId)))
          )
        ),
      ]),
  };
};

module.exports = {
  ChannelView,
  PostView,
};
