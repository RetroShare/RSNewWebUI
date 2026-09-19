const m = require('mithril');
const rs = require('rswebui');
const util = require('channels/channels_util');
const widget = require('widgets');
const Data = util.Data;
const peopleUtil = require('people/people_util');
const sha1 = require('channels/sha1');
const fileUtil = require('files/files_util');
const fileDown = require('files/files_downloads');
const icon = require('icon');
const { CommentsSection } = require('comments');
const toast = require('toast');

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

function channelPostPublishTime(post) {
  const timestamp = post && post.mMeta && post.mMeta.mPublishTs;
  const value = Number(timestamp && typeof timestamp === 'object'
    ? timestamp.xint64 ?? timestamp.xstr64
    : timestamp);
  return Number.isFinite(value) ? value : 0;
}

function channelPostCommentCount(postId, post) {
  const loadedComments = Data.Comments[postId];
  if (loadedComments) return Object.keys(loadedComments).length;

  const meta = (post && post.mMeta) || {};
  const count = post && (post.mComments ?? post.mCommentCount ?? post.commentCount);
  return Number(count ?? meta.mComments ?? meta.mCommentCount ?? 0) || 0;
}

//  Shown in place of a post's image when it has none, or when it failed.
const ChannelFallbackThumbnail = () => ({
  view: (vnode) => m('.channel-post__placeholder', [
    icon('image'),
    m('span', (vnode.attrs.title || 'Post').trim().slice(0, 1).toUpperCase()),
    m('small', 'No image'),
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
        m('input.create-channel-form__title[type=text][placeholder=Channel title]', {
          oninput: (e) => (title = e.target.value),
        }),
        m('.create-channel-form__thumbnail', [
          m('.channel-thumbnail-preview', [
            thumbnailPreview
              ? m('img', { src: thumbnailPreview, alt: 'Channel thumbnail preview' })
              : m('.channel-thumbnail-preview__placeholder', [
                icon('image'),
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
          }, [icon('upload'), thumbnailPreview ? ' Change image' : ' Choose image']),
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
        m('button.create-channel-form__submit.is-primary',
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
                //  The form is done: close it before the toast, or a second
                //  click would create the channel again.
                widget.closePopupMessage();
                m.redraw();
              }
              res.body.retval === false
                ? toast.error(res.body.errorMessage)
                : toast.success('Channel created successfully');
            },
          }, [icon('plus'), 'Create']),
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
        m('input.create-channel-post-form__title[type=text][placeholder=Post title]', {
          value: ptitle,
          oninput: (e) => (ptitle = e.target.value),
        }),
        m('.create-channel-post-form__thumbnail', [
          m('.channel-post-thumbnail-preview', [
            thumbnailPreview
              ? m('img', { src: thumbnailPreview, alt: 'Post thumbnail preview' })
              : m('.channel-post-thumbnail-preview__placeholder', [
                icon('image'),
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
          }, [icon('upload'), thumbnailPreview ? ' Change image' : ' Choose image']),
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
            icon('paperclip'), ` ${attachmentLabel}`,
          ]),
          !uploadFiles && m('small', 'Preparing attachments...'),
          attachmentItems.length > 0 && m('.create-channel-post-form__attachment-list',
            attachmentItems.map((file, index) => m('.create-channel-post-form__attachment-item', [
              icon('file'),
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
              }, icon('times')),
            ]))
          ),
        ]),
        m('textarea.create-channel-post-form__description[rows=7][placeholder=Write your post]', {
          oninput: (e) => (content = e.target.value),
          value: content,
        }),
        m('button.create-channel-post-form__submit.is-primary',
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
                if (res.body.retval === false) {
                  toast.error(res.body.errorMessage);
                } else {
                  widget.closePopupMessage();
                  toast.success('Post added successfully');
                }
                util.updatedisplaychannels(vnode.attrs.chanId);
                m.redraw();
              }
            },
          }, [icon('plus'), uploadFiles ? 'Create Post' : 'Preparing…']),
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
  let cdescription = '';
  let cauthor = '';
  let csubscribed = {};
  let mychannel = false;
  let cposts = 0;
  let plist = {};
  let createDate = {};
  let lastActivity = {};
  //  Posts whose thumbnail failed to load, so the card can draw the fallback
  //  instead of both at once.
  const brokenThumbnails = new Set();
  const toggleSubscription = async (attrs) => {
    const res = await rs.rsJsonApiRequest('/rsgxschannels/subscribeToChannel', {
      channelId: attrs.id, subscribe: !csubscribed,
    });
    if (res.body.retval) {
      csubscribed = !csubscribed;
      Data.DisplayChannels[attrs.id].isSubscribed = csubscribed;
      if (attrs.onSubscriptionChange) attrs.onSubscriptionChange();
      m.redraw();
    }
  };
  //  Read on every render, not once in oninit. The summaries arrive after this
  //  component mounts -- reliably so on a phone, where the request is slower
  //  than the route change -- and oninit never runs again, so a channel opened
  //  from a link or a reload kept the empty values it was born with.
  function readChannel(id) {
    const c = Data.DisplayChannels[id];
    if (!c) return;
    cname = c.name;
    cimage = c.image;
    cdescription = c.description;
    //  Same as forum_view: userMap stores objects, username() is the only
    //  accessor that yields a string.
    if (Number(c.author) === 0) {
      cauthor = 'No Contact Author';
    } else if (c.author) {
      cauthor = rs.userList.username(c.author);
    } else {
      cauthor = 'Unknown';
    }
    csubscribed = c.isSubscribed;
    mychannel = c.mychannel;
    cposts = c.posts;
    createDate = c.created;
    lastActivity = c.activity;
  }

  return {
    oninit: (v) => {
      readChannel(v.attrs.id);
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
        //  Again, because the first call ran before the channel's own details
        //  had arrived and left the header blank.
        readChannel(v.attrs.id);
        plist = Data.Posts[v.attrs.id] || {};
        m.redraw();
      });
    },
    view: (v) => [
      m(widget.PageHead, {
        class: 'channel-detail-head',
        back: {
          label: 'Back to channels',
          onclick: () => m.route.set('/channels/:tab', { tab: m.route.param().tab }),
        },
        title: cname,
        actions: [
          m('.channel-mobile-search', [
            m(util.SearchBar, { category: 'posts', channelId: v.attrs.id }),
          ]),
          mychannel && csubscribed && m('button.channel-mobile-create[type=button][title=Add Post][aria-label=Add Post]', {
            onclick: () => widget.popupMessage(
              m(AddPost, { chanId: v.attrs.id }),
              'create-channel-post-modal',
              {
                title: 'Create Channel Post',
                lead: 'Add a title, thumbnail, message, and optional attachments.',
              }
            ),
          }, icon('plus')),
          m('button.is-primary',
            {
              class: csubscribed ? 'channel-subscription--subscribed' : '',
              onclick: () => toggleSubscription(v.attrs),
            }, [icon('bookmark'), csubscribed ? 'Subscribed' : 'Subscribe']),
          m(widget.Menu, {
            class: 'channel-mobile-actions',
            mark: 'ellipsis-v',
            title: 'Channel actions',
            items: [{
              label: csubscribed ? 'Unsubscribe' : 'Subscribe',
              icon: 'bookmark',
              danger: csubscribed,
              onclick: () => toggleSubscription(v.attrs),
            }],
          }),
        ],
      }),
      m('.widget__body', [
        m('.media-item', [
          m('.media-item__details', [
            cimage && cimage.mData && cimage.mData.base64
              ? m('img', {
                src: `data:image/png;base64,${cimage.mData.base64}`,
                alt: `${cname} channel thumbnail`,
              })
              : m('.channel-detail-default-thumbnail[role=img][aria-label=Default channel thumbnail]',
                icon('tv')
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
            m('span', cdescription || 'No Description'),
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
                m('button.channel-posts-heading__create.is-primary[type=button][title=Add Post][aria-label=Add Post]',
                  { onclick: () => widget.popupMessage(
                    m(AddPost, { chanId: v.attrs.id }),
                    'create-channel-post-modal',
                    {
                      title: 'Create Channel Post',
                      lead: 'Add a title, thumbnail, message, and optional attachments.',
                    }
                  ) },
                  [icon('edit'), m('span', 'Add Post')]
                ),
            ]),
            m(
              '.posts-container',
              Object.keys(plist).sort((a, b) =>
                channelPostPublishTime(plist[b].post) - channelPostPublishTime(plist[a].post)
              ).map((key) => {
                const commentCount = channelPostCommentCount(key, plist[key].post);
                const thumbSrc = channelThumbnailSrc(plist[key].post);
                //  Keyed: newest-first means every card shifts when a post
                //  arrives, and an unkeyed list makes mithril reuse DOM by
                //  position -- the imperative onerror display:none of one
                //  post's broken thumbnail then sticks to whatever post
                //  shifts into that slot, blanking a valid image.
                return m(
                  '.posts-container-card',
                  {
                    key,
                    style: {
                      display: plist[key].isSearched ? 'flex' : 'none', // for search
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
                    commentCount > 0 && m('.channel-post-comment-badge', {
                      title: `${commentCount} comment${commentCount === 1 ? '' : 's'}`,
                      'aria-label': `${commentCount} comment${commentCount === 1 ? '' : 's'}`,
                    }, [
                      icon('comment'),
                      m('span', commentCount),
                    ]),
                    thumbSrc && !brokenThumbnails.has(key)
                      ? m('img.posts-container-card__image', {
                        src: thumbSrc,
                        alt: plist[key].post.mMeta.mMsgName || 'Post thumbnail',
                        onerror: () => {
                          brokenThumbnails.add(key);
                          m.redraw();
                        },
                      })
                      : m(ChannelFallbackThumbnail, { title: plist[key].post.mMeta.mMsgName }),
                    m('p.posts-container-card__title', plist[key].post.mMeta.mMsgName),
                  ]
                );
              })
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
      m(widget.PageHead, {
        back: {
          label: 'Back to channel',
          onclick: () => m.route.set('/channels/:tab/:mGroupId', {
            tab: m.route.param().tab,
            mGroupId: m.route.param().mGroupId,
          }),
        },
        title: post.mMeta.mMsgName,
      }),
      m('.widget__body', [
        message ? m('.post-description', [
          m('.post-description__text', {
            class: messageExpanded ? '' : 'post-description__text--collapsed',
          }, m.trust(message)),
          hasLongMessage ? m('button.post-description__toggle[type=button]', {
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
                    m('button.is-primary',
                      {
                        style: { fontSize: '0.9em' },
                        onclick: () => widget.confirmMessage({
                          title: 'Start Download?',
                          message: file.mName,
                          confirmLabel: 'Start download',
                          onConfirm: async () => {
                            if (!filesInfo[file.mHash] || filesInfo[file.mHash].retval) return;
                            const res = await rs.rsJsonApiRequest('/rsFiles/FileRequest', {
                              fileName: file.mName,
                              hash: file.mHash,
                              flags: util.RS_FILE_REQ_ANONYMOUS_ROUTING,
                              size: {
                                xstr64: file.mSize.xstr64,
                              },
                            });
                            res.body.retval === false
                              ? toast.error(res.body.errorMessage)
                              : toast.success('Download Started');
                            m.redraw();
                          },
                        }),
                      },
                      filesInfo[file.mHash]
                        ? filesInfo[file.mHash].retval
                          ? 'Open File'
                          : ['Download ', icon('download')]
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
        m(CommentsSection, {
          comments: Data.Comments[v.attrs.msgId] || {},
          rootThreadId: v.attrs.msgId,
          identities: ownId,
          voteIdentity,
          identitiesLoading,
          onVoteIdentity: (id) => { voteIdentity = id; },
          onSubmitComment: async ({ text, authorId, parentId }) => {
            const res = await rs.rsJsonApiRequest('/rsgxschannels/createCommentV2', {
              channelId: v.attrs.channelId,
              threadId: v.attrs.msgId,
              comment: text,
              authorId,
              parentId: parentId || v.attrs.msgId,
            });
            if (!res || !res.body || res.body.retval === false) {
              throw new Error((res && res.body && res.body.errorMessage) || 'Your comment could not be posted.');
            }
            await util.updatedisplaychannels(v.attrs.channelId);
          },
          onVoteComment: async ({ commentId, voteType, voteIdentity: voterId }) => {
            await addvote(voteType, v.attrs.channelId, v.attrs.msgId, voterId, commentId);
          },
          getCommentVotes: (id) => (Data.Votes[v.attrs.msgId] && Data.Votes[v.attrs.msgId][id]) || { upvotes: 0, downvotes: 0 },
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
