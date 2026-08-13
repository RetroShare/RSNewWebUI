const m = require('mithril');
const rs = require('rswebui');
const util = require('channels/channels_util');
const widget = require('widgets');
const Data = util.Data;
const peopleUtil = require('people/people_util');
const sha1 = require('channels/sha1');
const fileUtil = require('files/files_util');
const fileDown = require('files/files_downloads');
const chatEmoji = require('chat/chat_emoji');

const filesUploadHashes = {
  // figure out a better way later.
  PostFiles: [],
  Thumbnail: [],
};

function channelThumbnailSrc(post) {
  const thumbnail = post && (post.mThumbnail || post.thumbnail || post.mImage);
  const base64 = thumbnail && thumbnail.mData && thumbnail.mData.base64
    ? thumbnail.mData.base64
    : typeof thumbnail === 'string'
      ? thumbnail
      : thumbnail && thumbnail.base64;
  if (!base64 || !String(base64).trim()) return '';
  return String(base64).startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
}

const ChannelFallbackThumbnail = () => ({
  view: (vnode) => m('.channel-post__placeholder', { style: {
    display: vnode.attrs.hidden ? 'none' : 'flex', flex: '1 1 auto', minHeight: '0',
    flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '.35rem',
    color: '#64748b', background: 'linear-gradient(135deg, #f8fafc, #dbe5f1)',
  } }, [
    m('i.fas.fa-image[aria-hidden=true]', { style: { fontSize: '1.35rem', color: '#64748b' } }),
    m('span', { style: { fontSize: '2rem', fontWeight: '700', color: '#2563eb' } }, (vnode.attrs.title || 'Post').trim().slice(0, 1).toUpperCase()),
    m('small', { style: { fontSize: '.72rem', fontWeight: '600' } }, 'No image'),
  ]),
});

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
const messageGroupLabels = ['🌐  Public', '◉  Restricted Circle', '⬢  Restricted Node Group'];
const messageGroupsCode = [util.PUBLIC, util.EXTERNAL, util.NODES_GROUP]; // rsgxscirles.h:50

function createchannel() {
  let title;
  let body;
  let identity;
  let thumbnail;
  let thumbnailPreview = '';
  let thumbnailFileName = '';
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
        selectedCircle = circles[0];
      }
    },
    view: (vnode) =>
      m('.widget.create-channel-form', [
        m('.create-channel-form__heading', [
          m('h3', 'Create Channel'),
          m('p', 'Set up the channel appearance and publishing options.'),
        ]),
        m('input.create-channel-form__title[type=text][placeholder=Channel title]', {
          oninput: (e) => (title = e.target.value),
        }),
        m('.create-channel-form__thumbnail', [
          m('.channel-thumbnail-preview', [
            thumbnailPreview
              ? m('img', { src: thumbnailPreview, alt: 'Channel thumbnail preview' })
              : m('.channel-thumbnail-preview__placeholder', [
                m('i.fas.fa-image'),
                m('span', 'Channel logo'),
                m('small', 'No image selected'),
              ]),
          ]),
          m('span.create-channel-form__thumbnail-label', 'Thumbnail'),
          m('input.create-channel-form__file-input[type=file][name=files][id=thumbnail][accept=image/*]', {
            onchange: async (e) => {
              const file = e.target.files[0];
              if (!file) {
                thumbnail = undefined;
                thumbnailPreview = '';
                thumbnailFileName = '';
                return;
              }
              thumbnailFileName = file.name;
              const reader = new FileReader();
              reader.onloadend = function () {
                thumbnailPreview = reader.result;
                thumbnail = thumbnailPreview.substring(thumbnailPreview.indexOf(',') + 1);
                m.redraw();
              };
              reader.readAsDataURL(file);
            },
          }),
          m('label.create-channel-form__file-button[for=thumbnail]', {
            title: thumbnailFileName || 'Choose a channel thumbnail',
          }, [m('i.fas.fa-upload'), thumbnailPreview ? ' Change image' : ' Choose image']),
          m('small', 'Square images work best.'),
        ]),

        m('.create-channel-form__field.create-channel-form__identity', [
          m('label[for=idtags]', 'Publishing identity'),
          m(
            'select.config-style-select[id=idtags]',
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
                    Number(o) === 0
                      ? 'No Signature'
                      : `${rs.userList.username(o)} (${o.slice(0, 8)}...)`
                  )
                ),
            ]
          ),
        ]),
        m('.create-channel-form__field.create-channel-form__distribution', [
          m('label[for=mtags]', 'Message distribution'),
          m(
            'select.config-style-select[id=mtags]',
            {
              value: selectedGroup,
              onchange: (e) => {
                selectedGroup = messageGroups[e.target.selectedIndex];
                selectedGroupCode = messageGroupsCode[e.target.selectedIndex];
              },
            },
            [messageGroups.map((group, index) => m(
              'option',
              { value: group },
              messageGroupLabels[index]
            ))]
          ),
        ]),
        circles && selectedGroupCode === util.EXTERNAL &&
          m(
            '.create-channel-form__field.create-channel-form__circle',
            [
              m('label[for=circlestag]', 'Circle'),
              m(
                'select.config-style-select[id=circlestag]',
                {
                  value: selectedCircle && selectedCircle.mGroupName,
                  onchange: (e) => {
                    selectedCircle = circles[e.target.selectedIndex];
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
        m('textarea.create-channel-form__description[rows=5][placeholder=Describe your channel]', {
          oninput: (e) => (body = e.target.value),
          value: body,
        }),
        m(
          'button.create-channel-form__submit',
          {
            onclick: async () => {
              const res = await rs.rsJsonApiRequest('/rsgxschannels/createChannelV2', {
                name: title,
                description: body,
                thumbnail: { mData: { base64: thumbnail } },
                ...(Number(identity) !== 0 && { authorId: identity }), // checks if some identity has to be assigned
                circleType: selectedGroupCode,
                ...(selectedGroupCode === util.EXTERNAL &&
                  selectedCircle && { circleId: selectedCircle.mGroupId }), // checks if the selectedGroup code is EXTERNAL
              });
              if (res.body.retval) {
                await util.updatedisplaychannels(res.body.channelId, undefined, false);
                if (vnode.attrs.onCreated) await vnode.attrs.onCreated();
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
  let pthumbnail;
  let thumbnailPreview = '';
  let thumbnailFileName = '';
  let attachmentLabel = 'Choose files';
  const attachmentItems = [];
  const pfiles = [];
  let uploadFiles = true;
  return {
    view: (vnode) =>
      m('.widget.create-channel-post-form', [
        m('.create-channel-post-form__heading', [
          m('h3', 'Create Channel Post'),
          m('p', 'Add a title, thumbnail, message, and optional attachments.'),
        ]),
        m('input.create-channel-post-form__title[type=text][placeholder=Post title]', {
          value: ptitle,
          oninput: (e) => (ptitle = e.target.value),
        }),
        m('.create-channel-post-form__thumbnail', [
          m('.channel-post-thumbnail-preview', [
            thumbnailPreview
              ? m('img', { src: thumbnailPreview, alt: 'Post thumbnail preview' })
              : m('.channel-post-thumbnail-preview__placeholder', [
                m('i.fas.fa-image'),
                m('span', 'Post thumbnail'),
                m('small', 'No image selected'),
              ]),
          ]),
          m('span.create-channel-post-form__thumbnail-label', 'Thumbnail'),
          m('input.create-channel-post-form__file-input[type=file][name=files][id=channel-post-thumbnail][accept=image/*]', {
          onchange: (e) => {
            const file = e.target.files[0];
            if (!file) return;
            thumbnailFileName = file.name;
            const reader = new FileReader();
            reader.onloadend = function () {
              thumbnailPreview = reader.result;
              pthumbnail = thumbnailPreview.substring(thumbnailPreview.indexOf(',') + 1);
              m.redraw();
            };
            reader.readAsDataURL(file);
          },
          }),
          m('label.create-channel-post-form__file-button[for=channel-post-thumbnail]', {
            title: thumbnailFileName || 'Choose a post thumbnail',
          }, [m('i.fas.fa-upload'), thumbnailPreview ? ' Change image' : ' Choose image']),
          m('small', 'Square images work best.'),
        ]),
        m('.create-channel-post-form__attachments', [
          m('label', 'Attachments'),
          m('input.create-channel-post-form__file-input[type=file][name=files][id=channel-post-files][multiple=multiple]', {
          disabled: !uploadFiles,
          // attachments option wrong hash, not working
          onchange: async (e) => {
            const input = e.target;
            const existingKeys = new Set(attachmentItems.map((file) => file.key));
            const newFiles = Array.from(input.files).filter((file) => {
              const key = `${file.name}:${file.size}:${file.lastModified}`;
              return !existingKeys.has(key);
            });
            input.value = '';
            if (newFiles.length === 0) return;

            attachmentItems.push(...newFiles.map((file) => ({
              key: `${file.name}:${file.size}:${file.lastModified}`,
              name: file.name,
              size: file.size,
              hash: '',
            })));
            attachmentLabel = `${attachmentItems.length} file${attachmentItems.length === 1 ? '' : 's'} selected`;
            uploadFiles = false;
            filesUploadHashes.PostFiles = [];
            m.redraw();
            for (let i = 0; i < newFiles.length; i++) {
              await parsefile(newFiles[i], 'multiple');
            }
            // console.log(filesUploadHashes.PostFiles, filesUploadHashes.PostFiles.length);

            if (filesUploadHashes.PostFiles.length === newFiles.length) {
              for (let i = 0; i < newFiles.length; i++) {
                pfiles.push({
                  name: newFiles[i].name,
                  size: newFiles[i].size,
                  hash: filesUploadHashes.PostFiles[i],
                });
              }
              uploadFiles = true;
              attachmentItems.forEach((item, index) => {
                item.hash = pfiles[index] && pfiles[index].hash;
              });
              m.redraw();
            }
          },
          }),
          m('label.create-channel-post-form__attachment-button[for=channel-post-files]', [
            m('i.fas.fa-paperclip'), ` ${attachmentLabel}`,
          ]),
          !uploadFiles && m('small', 'Preparing attachments...'),
          attachmentItems.length > 0 && m('.create-channel-post-form__attachment-list',
            attachmentItems.map((file, index) => m('.create-channel-post-form__attachment-item', [
              m('i.fas.fa-file'),
              m('.create-channel-post-form__attachment-info', [
                m('span', { title: file.name }, file.name),
                m('small', rs.formatBytes(file.size)),
              ]),
              m('button.create-channel-post-form__attachment-remove[type=button][title=Remove attachment]', {
                disabled: !uploadFiles,
                onclick: () => {
                  attachmentItems.splice(index, 1);
                  pfiles.splice(index, 1);
                  attachmentLabel = attachmentItems.length
                    ? `${attachmentItems.length} file${attachmentItems.length === 1 ? '' : 's'} selected`
                    : 'Choose files';
                },
              }, m('i.fas.fa-times')),
            ]))
          ),
        ]),
        m('textarea.create-channel-post-form__description[rows=7][placeholder=Write your post]', {
          oninput: (e) => (content = e.target.value),
          value: content,
        }),
        m(
          'button.create-channel-post-form__submit',
          {
            disabled: !uploadFiles || !ptitle.trim(),
            onclick: async () => {
              if (uploadFiles) {
                // console.log(vnode.attrs.chanId, ptitle, content, pfiles, pthumbnail);
                const res = await rs.rsJsonApiRequest('/rsgxschannels/createPostV2', {
                  channelId: vnode.attrs.chanId,
                  title: ptitle.trim(),
                  mBody: content,
                  files: pfiles, // does not work for now
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
          uploadFiles ? 'Create Post' : 'Preparing…'
        ),
      ]),
  };
};

//  When each channel last had its content pulled, so that stepping in and out
//  of a channel does not redownload it every time. Module level: the component
//  is rebuilt at every visit, a field of it would forget instantly.
const contentLoadedAt = {};
const CONTENT_CACHE_MS = 60000;

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
        //  Same as forum_view: userMap stores objects, username() is the only
        //  accessor that yields a string.
        if (Number(Data.DisplayChannels[v.attrs.id].author) === 0) {
          cauthor = 'No Contact Author';
        } else if (Data.DisplayChannels[v.attrs.id].author) {
          cauthor = rs.userList.username(Data.DisplayChannels[v.attrs.id].author);
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
      //  Channel lists load metadata only, so the content is fetched here, on
      //  opening. oninit runs again on every visit though, and a 2000 item
      //  channel would redownload its whole content, images included, each time
      //  the user steps in and out. Skip it while the copy in memory is fresh,
      //  and let it age so posts published meanwhile still show up. The callers
      //  that publish or delete call updatedisplaychannels directly and are not
      //  affected by this guard.
      const lastLoad = contentLoadedAt[v.attrs.id] || 0;
      if (Object.keys(plist).length > 0 && Date.now() - lastLoad < CONTENT_CACHE_MS) return;
      contentLoadedAt[v.attrs.id] = Date.now();
      util.updatedisplaychannels(v.attrs.id).then(() => {
        plist = Data.Posts[v.attrs.id] || {};
        m.redraw();
      });
    },
    view: (v) => [
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
      m('.widget__heading', [
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
      ]),
      m('.widget__body', [
        m('.media-item', [
          m('.media-item__details', [
            cimage && cimage.mData && cimage.mData.base64
              ? m('img', {
                src: `data:image/png;base64,${cimage.mData.base64}`,
                alt: `${cname} channel thumbnail`,
              })
              : m('.channel-detail-default-thumbnail[role=img][aria-label=Default channel thumbnail]',
                m('i.fas.fa-tv')
              ),
            m('.media-item__details-info', [
              m('div', [m('b', 'Posts: '), m('span', cposts)]),
              m('div', [
                m('b', 'Date created: '),
                m(
                  'span',
                  typeof createDate === 'object'
                    ? new Date(createDate.xint64 * 1000).toLocaleString()
                    : 'Unknown'
                ),
              ]),
              m('div', [m('b', 'Admin: '), m('span', cauthor)]),
              m('div', [
                m('b', 'Last activity: '),
                m(
                  'span',
                  typeof lastActivity === 'object'
                    ? new Date(lastActivity.xint64 * 1000).toLocaleString()
                    : 'Unknown'
                ),
              ]),
            ]),
          ]),
          m('.media-item__desc', [
            m('b', 'Description: '),
            m('span', Data.DisplayChannels[v.attrs.id].description || 'No Description'),
          ]),
        ]),
        m(
          '.posts',
          {
            style: 'display: ' + (csubscribed ? 'flex' : 'none'),
          },
          [
            m('.posts__heading.channel-posts-heading', [
              m('h3', 'Posts'),
              mychannel &&
                m(
                  'button.channel-posts-heading__create[type=button][title=Add Post][aria-label=Add Post]',
                  { onclick: () => widget.popupMessage(
                    m(AddPost, { chanId: v.attrs.id }),
                    'create-channel-post-modal'
                  ) },
                  [m('i.fas.fa-edit'), m('span', 'Add Post')]
                ),
            ]),
            m(
              '.posts-container',
              Object.keys(plist).map((key, index) => [
                m(
                  '.posts-container-card',
                  {
                    style: {
                      display: plist[key].isSearched ? 'flex' : 'none', // for search
                      height: '240px',
                      minHeight: '0',
                      overflow: 'hidden',
                      flexDirection: 'column',
                      alignSelf: 'start',
                    },
                    onclick: () => {
                      m.route.set('/channels/:tab/:mGroupId/:mMsgId', {
                        tab: m.route.param().tab,
                        mGroupId: v.attrs.id,
                        mMsgId: key,
                      });
                    },
                  },
                  [
                    channelThumbnailSrc(plist[key].post)
                      ? [
                          m('img', {
                            src: channelThumbnailSrc(plist[key].post),
                            alt: plist[key].post.mMeta.mMsgName || 'Post thumbnail',
                            onerror: (e) => {
                              e.target.style.display = 'none';
                              if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                            },
                          }),
                          m(ChannelFallbackThumbnail, { title: plist[key].post.mMeta.mMsgName, hidden: true }),
                        ]
                      : m(ChannelFallbackThumbnail, { title: plist[key].post.mMeta.mMsgName }),
                    m('p', plist[key].post.mMeta.mMsgName),
                  ]
                ),
              ])
            ),
          ]
        ),
      ]),
    ],
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

/* Modern threaded comment experience for channel posts. */
const ChannelComments = () => {
  let replyTo = null;
  let text = '';
  let identity = null;
  let submitting = false;
  let error = '';
  let showEmojiPicker = false;
  const expandedReplies = {};

  const metaOf = (comment) => (comment && comment.mMeta) || {};
  const idOf = (comment) => metaOf(comment).mMsgId || comment.msgId;
  const nameOf = (id) => rs.userList.username(id) || rs.userList.userMap[id] || `${String(id || 'Unknown').slice(0, 10)}…`;
  const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const dateOf = (value) => {
    const seconds = value && typeof value === 'object' ? value.xint64 : value;
    return Number(seconds) ? new Date(Number(seconds) * 1000).toLocaleString() : '';
  };

  function tree(threadId) {
    const nodes = {};
    const roots = [];
    Object.keys(Data.Comments[threadId] || {}).forEach((key) => {
      const entry = Data.Comments[threadId][key];
      const comment = entry.comment || entry;
      if (idOf(comment)) nodes[idOf(comment)] = { comment, children: [] };
    });
    Object.keys(nodes).forEach((key) => {
      const node = nodes[key];
      const parent = metaOf(node.comment).mParentId;
      if (parent && parent !== threadId && nodes[parent]) nodes[parent].children.push(node);
      else roots.push(node);
    });
    const chronological = (a, b) => Number(metaOf(a.comment).mPublishTs && (metaOf(a.comment).mPublishTs.xint64 || metaOf(a.comment).mPublishTs)) - Number(metaOf(b.comment).mPublishTs && (metaOf(b.comment).mPublishTs.xint64 || metaOf(b.comment).mPublishTs));
    roots.sort(chronological);
    Object.keys(nodes).forEach((key) => nodes[key].children.sort(chronological));
    return roots;
  }

  async function submit(vnode) {
    const comment = text.trim();
    if (!comment || !identity || submitting) return;
    submitting = true;
    error = '';
    try {
      const res = await rs.rsJsonApiRequest('/rsgxschannels/createCommentV2', {
        channelId: vnode.attrs.channelId,
        threadId: vnode.attrs.threadId,
        comment,
        authorId: identity,
        parentId: replyTo ? idOf(replyTo) : vnode.attrs.threadId,
      });
      if (!res || !res.body || res.body.retval === false) {
        error = (res && res.body && res.body.errorMessage) || 'Your comment could not be posted.';
        return;
      }
      text = '';
      replyTo = null;
      await util.updatedisplaychannels(vnode.attrs.channelId);
    } catch (submitError) {
      console.warn('Channel comment submission failed', submitError);
      error = 'Your comment could not be posted. Please try again.';
    } finally {
      submitting = false;
      m.redraw();
    }
  }

  function renderComment(node, vnode) {
    const comment = node.comment;
    const meta = metaOf(comment);
    const id = idOf(comment);
    const name = nameOf(meta.mAuthorId);
    const votes = (Data.Votes[meta.mThreadId] && Data.Votes[meta.mThreadId][id]) || { upvotes: 0, downvotes: 0 };
    const repliesExpanded = expandedReplies[id] === true;
    return m('.board-comment', { key: id }, [
      m('.board-comment-avatar', initials(name)),
      m('.board-comment__content', [
        m('.board-comment__header', [
          m('.board-comment__meta', [m('b', name), dateOf(meta.mPublishTs) ? m('span', dateOf(meta.mPublishTs)) : null]),
          m('button.board-comment__menu[type=button][aria-label=Comment options]', m('i.fas.fa-ellipsis-v')),
        ]),
        m('p.board-comment__text', comment.mComment || comment.comment || ''),
        m('.board-comment__actions', [
          m('button[type=button]', { disabled: !vnode.attrs.voteIdentity, onclick: () => addvote(util.GXS_VOTE_UP, vnode.attrs.channelId, vnode.attrs.threadId, vnode.attrs.voteIdentity, id) }, [m('i.fas.fa-thumbs-up'), ` ${votes.upvotes || 0}`]),
          m('button[type=button]', { disabled: !vnode.attrs.voteIdentity, onclick: () => addvote(util.GXS_VOTE_DOWN, vnode.attrs.channelId, vnode.attrs.threadId, vnode.attrs.voteIdentity, id) }, m('i.fas.fa-thumbs-down')),
          m('button[type=button]', { onclick: () => { replyTo = comment; text = ''; error = ''; } }, 'Reply'),
        ]),
        node.children.length ? m('button.board-comment__replies-toggle[type=button]', { 'aria-expanded': repliesExpanded, onclick: () => { expandedReplies[id] = !repliesExpanded; } }, [`${node.children.length} ${node.children.length === 1 ? 'reply' : 'replies'} `, m('i.fas', { class: repliesExpanded ? 'fa-chevron-up' : 'fa-chevron-down' })]) : null,
        node.children.length && repliesExpanded ? m('.board-comment__replies', node.children.map((child) => renderComment(child, vnode))) : null,
      ]),
    ]);
  }

  return {
    view: (vnode) => {
      const identities = (vnode.attrs.identities || []).filter((id) => Number(id) !== 0);
      if (!identity && identities.length) identity = identities[0];
      const comments = tree(vnode.attrs.threadId);
      return m('.board-comments.channel-comments', [
        m('.board-comments__heading', [
          m('h3', `${Object.keys(Data.Comments[vnode.attrs.threadId] || {}).length} Comment${Object.keys(Data.Comments[vnode.attrs.threadId] || {}).length === 1 ? '' : 's'}`),
          m('span', [m('i.fas.fa-sort-amount-down'), ' Oldest first']),
          m('.board-comments__voter', [
            m('label[for=channel-comment-voter]', 'Voter identity'),
            m('select#channel-comment-voter', {
              value: vnode.attrs.voteIdentity || '',
              disabled: identities.length === 0,
              onchange: (e) => vnode.attrs.onVoteIdentity(e.target.value),
            }, identities.length
              ? identities.map((id) => m('option', { value: id }, nameOf(id)))
              : m('option', { value: '' }, vnode.attrs.identitiesLoading ? 'Loading identities…' : 'No identity available')),
          ]),
        ]),
        m('.board-comment-composer', [
          m('.board-comment-avatar', initials(nameOf(identity))),
          m('.board-comment-composer__body', [
            replyTo ? m('.board-comment-composer__replying', ['Replying to ', m('b', nameOf(metaOf(replyTo).mAuthorId)), m('button[type=button][aria-label=Cancel reply]', { onclick: () => { replyTo = null; text = ''; } }, m('i.fas.fa-times'))]) : null,
            identities.length ? m('select.board-comment-composer__identity', { value: identity, onchange: (e) => { identity = e.target.value; } }, identities.map((id) => m('option', { value: id }, nameOf(id)))) : null,
            m('textarea.board-comment-composer__input[rows=1][placeholder=Add a comment…]', { value: text, disabled: !identity || submitting, oninput: (e) => { text = e.target.value; }, onkeydown: (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submit(vnode); } }),
            !identity ? m('p.board-comment-composer__hint', vnode.attrs.identitiesLoading ? 'Loading identities…' : 'Create or select an identity to post a comment.') : null,
            error ? m('p.board-comment-composer__error', error) : null,
            m('.board-comment-composer__actions', [
              m('.board-comment-composer__emoji', { style: { position: 'relative', marginRight: 'auto' } }, [
                m('button[type=button][title=Insert emoji][aria-label=Insert emoji]', { style: { width: '32px', height: '32px', padding: '0', borderRadius: '50%', border: '0', boxShadow: 'none', background: showEmojiPicker ? '#e0f2fe' : 'transparent', color: '#475569', fontSize: '1.15rem' }, onclick: () => { showEmojiPicker = !showEmojiPicker; } }, m('i.fas.fa-smile')),
                showEmojiPicker ? m('.board-comment-emoji-popover', { style: { position: 'absolute', zIndex: '20', top: '38px', left: '0', width: '250px', maxHeight: '180px', overflowY: 'auto', padding: '.5rem', display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '.2rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', boxShadow: '0 8px 20px rgba(0,0,0,.16)' } }, chatEmoji.EMOJI_DATA.Smileys.slice(0, 48).map((emoji) => m('button[type=button]', { style: { width: '28px', height: '28px', padding: '0', border: '0', boxShadow: 'none', background: 'transparent', fontSize: '1.1rem' }, onclick: () => { text += emoji; showEmojiPicker = false; } }, emoji))) : null,
              ]),
              text || replyTo ? m('button.board-comment-composer__cancel[type=button]', { onclick: () => { text = ''; replyTo = null; error = ''; } }, 'Cancel') : null,
              m('button.board-comment-composer__submit[type=button]', { disabled: !text.trim() || !identity || submitting, onclick: () => submit(vnode) }, submitting ? 'Posting…' : 'Comment'),
            ]),
          ]),
        ]),
        comments.length ? m('.board-comments__list', comments.map((node) => renderComment(node, vnode))) : m('.board-comments__empty', [m('i.fas.fa-comment'), m('p', 'No comments yet. Start the conversation.')]),
      ]);
    },
  };
};

const PostView = () => {
  let post = {};
  const filesInfo = {};
  let voteIdentity;
  let ownId;
  let identitiesLoading = true;
  let messageExpanded = false;
  return {
    oninit: async (v) => {
      if (Data.Posts[v.attrs.channelId] && Data.Posts[v.attrs.channelId][v.attrs.msgId]) {
        post = Data.Posts[v.attrs.channelId][v.attrs.msgId].post;
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
        identitiesLoading = false;
      });
      fileDown.Downloads.loadStatus(); // for retrieving downloading files.
    },
    view: (v) => {
      const message = post.mMsg || '';
      const messageText = String(message).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const hasEmbeddedImage = /<img\b|data:image\//i.test(String(message));
      const hasLongMessage = messageText.length > 280 || hasEmbeddedImage;
      return [
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
      m('.widget__heading', m('h3', post.mMeta.mMsgName)),
      m('.widget__body', [
        message ? m('.post-description', [
          m('.post-description__text', {
            style: {
              maxHeight: messageExpanded ? 'none' : '4.5em',
              overflow: 'hidden',
              lineHeight: '1.5',
            },
          }, m.trust(message)),
          hasLongMessage ? m('button.post-description__toggle[type=button]', {
            style: { marginTop: '.35rem', padding: '0', border: '0', boxShadow: 'none', background: 'transparent', color: '#0f172a', fontSize: '.85rem', fontWeight: '700' },
            onclick: () => { messageExpanded = !messageExpanded; },
          }, messageExpanded ? 'Show less' : '…more') : null,
        ]) : null,
        m('.file-section', [
          m('h3', 'Files(' + post.mAttachmentCount + ')'),
          m(
            util.FilesTable,
            m(
              'tbody',
              post.mFiles.map((file) =>
                m('tr', [
                  m('td.channel-file__name[data-label=File name]', file.mName),
                  m('td.channel-file__size[data-label=Size]', rs.formatBytes(file.mSize.xint64)),
                  m('td.channel-file__action[data-label=Download]', [
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
                          : ['Download ', m('i.fas.fa-download')]
                        : 'Please Wait...'
                    ),
                    fileDown.list[file.mHash] && m(fileUtil.File, {
                      info: fileDown.list[file.mHash],
                      direction: 'down',
                      transferred: fileDown.list[file.mHash].transfered.xint64,
                      parts: [],
                    }),
                  ]),
                ])
              )
            )
          ),
        ]),
        m(ChannelComments, {
          channelId: v.attrs.channelId,
          threadId: v.attrs.msgId,
          identities: ownId,
          voteIdentity,
          identitiesLoading,
          onVoteIdentity: (id) => { voteIdentity = id; },
        }),
      ]),
      ];
    },
  };
};

module.exports = {
  ChannelView,
  PostView,
  createchannel,
};
