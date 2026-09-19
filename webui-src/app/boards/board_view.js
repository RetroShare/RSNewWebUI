const m = require('mithril');
const util = require('boards/boards_util');
const boardKanban = require('boards/board_kanban');
const rs = require('rswebui');
const peopleUtil = require('people/people_util');
const icon = require('icon');
const widget = require('widgets');
const { CommentsSection } = require('comments');
const toast = require('toast');
const Data = util.Data;

function createboard() {
  let title;
  let body;
  let identity;
  let thumbnail;
  let thumbnailPreview = '';
  let thumbnailFileName = '';
  let circle = util.PUBLIC;
  let circles = [];
  let selectedCircle;
  return {
    oninit: async (vnode) => {
      if (vnode.attrs.authorId) {
        identity = vnode.attrs.authorId[0];
      }
      const res = await rs.rsJsonApiRequest('/rsgxscircles/getCirclesSummaries');
      if (res.body.retval) {
        circles = res.body.circles || [];
        selectedCircle = circles[0];
      }
    },
    view: (vnode) =>
      m('.widget.create-board-form', [
        m('input.create-board-form__title[type=text][placeholder=Board title]', {
          oninput: (e) => (title = e.target.value),
        }),
        m('.create-board-form__visual', [
          m('.board-thumbnail-preview', [
            thumbnailPreview
              ? m('img', { src: thumbnailPreview, alt: 'Board thumbnail preview' })
              : m('.board-thumbnail-preview__placeholder', [
                icon('image'),
                m('span', 'Board logo'),
                m('small', 'No image selected'),
              ]),
          ]),
          m('span.create-board-form__visual-label', 'Thumbnail'),
          m('input.create-board-form__file-input[type=file][id=board-thumbnail][accept=image/*]', {
            onchange: (e) => {
              const file = e.target.files[0];
              if (!file) {
                thumbnail = undefined;
                thumbnailPreview = '';
                thumbnailFileName = '';
                return;
              }
              thumbnailFileName = file.name;
              const reader = new FileReader();
              reader.onloadend = () => {
                thumbnailPreview = reader.result;
                thumbnail = thumbnailPreview.substring(thumbnailPreview.indexOf(',') + 1);
                m.redraw();
              };
              reader.readAsDataURL(file);
            },
          }),
          m('label.create-board-form__file-button[for=board-thumbnail]', {
            title: thumbnailFileName || 'Choose a board thumbnail',
          }, [icon('upload'), thumbnailPreview ? ' Change image' : ' Choose image']),
          m('small', 'Square images work best.'),
        ]),
        m('.create-board-form__field.create-board-form__identity', [
          m('label[for=idtags]', 'Publishing identity'),
          m('select.config-style-select[id=idtags]', {
            value: identity,
            onchange: (e) => (identity = vnode.attrs.authorId[e.target.selectedIndex]),
          }, vnode.attrs.authorId && vnode.attrs.authorId.map((o) => m(
            'option',
            { value: o },
            Number(o) === 0 ? 'No Signature' : `${rs.userList.username(o)} (${o.slice(0, 8)}...)`
          ))),
        ]),
        m('.create-board-form__field.create-board-form__distribution', [
          m('label[for=circletags]', 'Message distribution'),
          m('select.config-style-select[id=circletags]', {
            value: circle,
            onchange: (e) => (circle = e.target.value),
          }, [
            m('option', { value: util.PUBLIC }, '🌐  Public'),
            m('option', { value: util.EXTERNAL }, '◉  Restricted to External Circle'),
          ]),
        ]),
        Number(circle) === util.EXTERNAL && m('.create-board-form__field.create-board-form__circle', [
          m('label[for=board-circle]', 'Circle'),
          m('select.config-style-select[id=board-circle]', {
            value: selectedCircle && selectedCircle.mGroupId,
            onchange: (e) => {
              selectedCircle = circles.find((item) => item.mGroupId === e.target.value);
            },
          }, circles.length
            ? circles.map((item) => m('option', { value: item.mGroupId }, item.mGroupName))
            : m('option[disabled]', 'No circles available')),
        ]),
        m('textarea.create-board-form__description[rows=5][placeholder=Describe your board]', {
          oninput: (e) => (body = e.target.value),
          value: body,
        }),
        m('button.create-board-form__submit.is-primary',
          {
            onclick: async () => {
              const res = await rs.rsJsonApiRequest('/rsposted/createBoardV2', {
                board_name: title,
                board_description: body,
                board_image: { mData: { base64: thumbnail } },
                ...(Number(identity) !== 0 && { authorId: identity }),
                circleType: Number(circle),
                ...(Number(circle) === util.EXTERNAL && selectedCircle && {
                  circleId: selectedCircle.mGroupId,
                }),
              });
              if (res.body.retval && vnode.attrs.onCreated) await vnode.attrs.onCreated();
              if (res.body.retval) widget.closePopupMessage();
              res.body.retval
                ? toast.success('Board created successfully')
                : toast.error(res.body.errorMessage || 'Error in creating Board');
            },
          }, [icon('plus'), 'Create']),
      ]),
  };
}

function CreatePost() {
  let mode = 'post';
  let title = '';
  let notes = '';
  let link = '';
  let authorId;
  let identities = [];
  let imageBase64;
  let imagePreview = '';
  let imageFileName = '';
  let imageError = '';
  let submitting = false;

  const readDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const loadImage = (source) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });

  async function preparePostImage(file) {
    const original = await readDataUrl(file);
    const isAnimatedFormat = file.type === 'image/gif' || file.type === 'image/webp';
    if (isAnimatedFormat && file.size <= 194000) return original;

    const sourceImage = await loadImage(original);
    const scale = Math.min(1, 640 / sourceImage.naturalWidth, 480 / sourceImage.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceImage.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceImage.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);

    let result;
    for (let quality = 0.88; quality >= 0.35; quality -= 0.08) {
      result = canvas.toDataURL('image/jpeg', quality);
      const bytes = Math.ceil((result.length - result.indexOf(',') - 1) * 3 / 4);
      if (bytes <= 190000) return result;
    }
    throw new Error('The image is too large to fit in a Board post.');
  }

  return {
    oninit: async () => {
      identities = (await peopleUtil.ownIds()) || [];
      identities = identities.filter((id) => Number(id) !== 0);
      authorId = identities[0];
      m.redraw();
    },
    view: (vnode) => m('.widget.create-board-post', [
      m('.create-board-post__modes', [
        ['post', 'comment-alt', 'Post'],
        ['image', 'image', 'Image'],
        ['link', 'link', 'Link'],
      ].map(([value, iconName, label]) => m('button[type=button]', {
        class: mode === value ? 'active' : '',
        onclick: () => (mode = value),
      }, [icon(iconName), ` ${label}`]))),
      m('input.create-board-post__title[type=text][placeholder=Post title]', {
        value: title,
        oninput: (e) => (title = e.target.value),
      }),
      mode === 'link' && m('input.create-board-post__link[type=url][placeholder=https://example.com]', {
        value: link,
        oninput: (e) => (link = e.target.value),
      }),
      mode === 'image' && m('.create-board-post__image', [
        m('.create-board-post__preview', [
          imagePreview
            ? m('img', { src: imagePreview, alt: 'Post image preview' })
            : m('.create-board-post__placeholder', [icon('image'), m('span', 'Post image')]),
        ]),
        m('input.create-board-post__file[type=file][id=board-post-image][accept=image/*]', {
          onchange: async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            imageFileName = file.name;
            imageError = '';
            try {
              imagePreview = await preparePostImage(file);
              imageBase64 = imagePreview.substring(imagePreview.indexOf(',') + 1);
            } catch (error) {
              imagePreview = '';
              imageBase64 = undefined;
              imageError = error.message || 'The selected image could not be prepared.';
            }
            m.redraw();
          },
        }),
        m('label.create-board-post__file-button[for=board-post-image]', {
          title: imageFileName || 'Choose a post image',
        }, [icon('upload'), imagePreview ? ' Change image' : ' Choose image']),
        imageError && m('.create-board-post__image-error', imageError),
      ]),
      mode === 'post' && m('textarea.create-board-post__notes[rows=8][placeholder=Text (optional)]', {
        value: notes,
        oninput: (e) => (notes = e.target.value),
      }),
      m('.create-board-post__author', [
        m('label[for=board-post-author]', 'Post as'),
        m('select.config-style-select.network-style-select[id=board-post-author]', {
          value: authorId,
          onchange: (e) => (authorId = e.target.value),
          disabled: identities.length === 0,
        }, identities.length
          ? identities.map((id) => m('option', { value: id }, `${rs.userList.username(id)} (${id.slice(0, 8)}...)`))
          : m('option', 'No signed identity available')),
      ]),
      m('button.create-board-post__submit[type=button]', {
        disabled: submitting || !title.trim() || !authorId ||
          (mode === 'link' && !link.trim()) || (mode === 'image' && !imageBase64),
        onclick: async () => {
          submitting = true;
          m.redraw();
          try {
            const res = await rs.rsJsonApiRequest('/rsposted/createPostV2', {
              boardId: vnode.attrs.boardId,
              title: title.trim(),
              link: { urlString: mode === 'link' ? link.trim() : '' },
              notes: mode === 'link' ? '' : notes,
              authorId,
              image: { mData: { base64: mode === 'image' ? imageBase64 : undefined } },
            });
            if (res.body.retval) {
              Data.Posts[vnode.attrs.boardId] = {};
              await util.updateDisplayBoards(vnode.attrs.boardId);
              widget.closePopupMessage();
              toast.success('Post created successfully');
            } else {
              toast.error(res.body.error_message || res.body.errorMessage || 'The post could not be created');
            }
          } finally {
            submitting = false;
            m.redraw();
          }
        },
      }, [icon('paper-plane'), submitting ? 'Posting…' : 'Post']),
    ]),
  };
}

function BoardView() {
  let lastLoadedBoardId = null;
  let voterIdentities = [];
  let voterId = null;
  let voterIdentitiesLoading = true;

  return {
    oninit: (v) => {
      lastLoadedBoardId = v.attrs.id;
      util.updateDisplayBoards(v.attrs.id);
      peopleUtil.ownIds((ids) => {
        voterIdentities = (ids || [])
          .filter((id) => Number(id) !== 0)
          .map((id) => ({
            id,
            label: rs.userList.username(id) || rs.userList.userMap[id] || `${String(id).slice(0, 10)}...`,
          }));
        voterId = voterIdentities[0] ? voterIdentities[0].id : null;
        voterIdentitiesLoading = false;
        m.redraw();
      });
    },
    onupdate: (v) => {
      if (v.attrs.id && v.attrs.id !== lastLoadedBoardId) {
        lastLoadedBoardId = v.attrs.id;
        util.updateDisplayBoards(v.attrs.id);
      }
    },
    view: (v) => {
      const boardInfo = Data.DisplayBoards[v.attrs.id] || {};
      const bname = boardInfo.name || '';
      const bimage = boardInfo.image || { mData: { base64: '' } };
      //  userMap holds {name, isContact} objects: username() is what turns an
      //  id into a string fit for the view.
      let bauthor = 'Unknown';
      if (boardInfo.author) {
        bauthor = Number(boardInfo.author) === 0
          ? 'No Contact Author'
          : rs.userList.username(boardInfo.author);
      }
      const bsubscribed = boardInfo.isSubscribed;
      const toggleSubscription = async () => {
        const res = await rs.rsJsonApiRequest('/rsposted/subscribeToBoard', {
          boardId: v.attrs.id,
          subscribe: !bsubscribed,
        });
        if (res.body.retval) {
          boardInfo.isSubscribed = !bsubscribed;
          if (v.attrs.onSubscriptionChange) v.attrs.onSubscriptionChange();
          m.redraw();
        }
      };
      const subscribeFlags = Number(boardInfo.subscribeFlags || 0);
      const canPublish = (subscribeFlags & (util.GROUP_SUBSCRIBE_ADMIN | util.GROUP_SUBSCRIBE_PUBLISH)) !== 0;
      const bposts = boardInfo.posts || 0;
      const createDate = boardInfo.created;
      const lastActivity = boardInfo.activity;
      const plist = Data.Posts[v.attrs.id] || {};

      const items = Object.keys(plist)
        .filter((key) => plist[key] && (plist[key].isSearched === undefined || plist[key].isSearched))
        .map((key) => {
          const itemObj = plist[key] || {};
          const p = itemObj.post || itemObj;
          const meta = p.mMeta || {};

          let thumb = '';
          if (p.mImage && p.mImage.mData && p.mImage.mData.base64) {
            thumb = p.mImage.mData.base64;
          } else if (p.mImage && typeof p.mImage.base64 === 'string') {
            thumb = p.mImage.base64;
          } else if (typeof p.mImage === 'string') {
            thumb = p.mImage;
          } else if (p.mThumbnail && p.mThumbnail.mData && p.mThumbnail.mData.base64) {
            thumb = p.mThumbnail.mData.base64;
          } else if (typeof p.thumbnail === 'string') {
            thumb = p.thumbnail;
          }

          const notesText = util.plainText(p.mNotes || p.mBody || meta.mNotes || p.notes || p.body || '');
          const titleText = meta.mMsgName || p.mMsgName || p.title || 'Untitled Post';
          // RsPosted exposes the calculated count as mComments on the post.
          const commentCount = p.mComments !== undefined
            ? p.mComments
            : (meta.mChildCount !== undefined
              ? meta.mChildCount
              : (p.mCommentCount !== undefined ? p.mCommentCount : (p.commentCount !== undefined ? p.commentCount : 0)));

          return {
            key,
            msgId: key,
            title: titleText,
            thumbnail: thumb,
            notes: notesText,
            commentCount,
            post: p,
          };
        });

    // Automatically sort posts by publish timestamp descending (newest on top)
    items.sort((a, b) => {
      const getTs = (item) => {
        const p = item.post || item;
        const meta = p.mMeta || item.mMeta || {};
        const ts = meta.mPublishTs || p.mPublishTs || item.created || 0;
        if (ts && typeof ts === 'object' && ts.xint64 !== undefined) return Number(ts.xint64);
        if (typeof ts === 'number') return ts;
        if (typeof ts === 'string') { const n = Number(ts); return isNaN(n) ? 0 : n; }
        return 0;
      };
      return getTs(b) - getTs(a);
    });

      return [
        m(widget.PageHead, {
          class: 'board-detail-head',
          back: {
            label: 'Back to boards',
            onclick: () => m.route.set('/boards/:tab', {
              tab: m.route.param().tab || 'Subscribed',
            }),
          },
          title: bname,
          actions: [
            m('button.board-subscription-button.is-primary',
              {
                class: bsubscribed ? 'board-subscription-button--subscribed' : '',
                onclick: toggleSubscription,
              }, [icon('bookmark'), bsubscribed ? 'Subscribed' : 'Subscribe']),
            m(widget.Menu, {
              class: 'board-mobile-actions',
              mark: 'ellipsis-v',
              title: 'Board actions',
              items: [{
                label: bsubscribed ? 'Unsubscribe' : 'Subscribe',
                icon: 'bookmark',
                danger: bsubscribed,
                onclick: toggleSubscription,
              }],
            }),
          ],
        }),
        m('.widget__body', [
          m('.media-item', [
            m('.media-item__details', [
              bimage && bimage.mData && bimage.mData.base64
                ? m('img', {
                  src: `data:image/png;base64,${bimage.mData.base64}`,
                  alt: `${bname} board thumbnail`,
                })
                : m('.board-detail-default-thumbnail[role=img][aria-label=Default board thumbnail]',
                  icon('globe')
                ),
              m('.media-item__details-info', [
                m('div', [m('b', 'Posts: '), m('span', bposts)]),
                m('div', [
                  m('b', 'Date created: '),
                  m(
                    'span',
                    typeof createDate === 'object' && createDate !== null
                      ? new Date(createDate.xint64 * 1000).toLocaleString()
                      : 'Unknown'
                  ),
                ]),
                m('div', [m('b', 'Admin: '), m('span', bauthor)]),
                m('div', [
                  m('b', 'Last activity: '),
                  m(
                    'span',
                    typeof createDate === 'object' && lastActivity !== null && typeof lastActivity === 'object'
                      ? new Date(lastActivity.xint64 * 1000).toLocaleString()
                      : 'Unknown'
                  ),
                ]),
              ]),
            ]),
            m('.media-item__desc', [
              m('b', 'Description: '),
              m('span', boardInfo.description || 'No Description'),
            ]),
          ]),
          m(
            '.posts',
            {
              style: 'display:' + (bsubscribed ? 'block' : 'none'),
            },
            m('.posts__heading.board-posts-heading', [
              m('h3', 'Posts'),
              canPublish && m('button.board-posts-heading__create.is-primary[type=button][title=Create Post][aria-label=Create Post]', {
                onclick: () => util.popupmessage(
                  m(CreatePost, { boardId: v.attrs.id }),
                  'create-board-post-modal',
                  {
                    title: 'Create a Post',
                    lead: 'Share an interesting post with a clear, descriptive title.',
                  }
                ),
              }, [icon('plus'), m('span', 'Create Post')]),
            ]),
            m(boardKanban.BoardView, {
              forumId: v.attrs.id,
              onCreatePost: canPublish ? () => util.popupmessage(
                m(CreatePost, { boardId: v.attrs.id }),
                'create-board-post-modal',
                {
                  title: 'Create a Post',
                  lead: 'Share an interesting post with a clear, descriptive title.',
                }
              ) : null,
              items,
              voterIdentities,
              voterId,
              voterIdentitiesLoading,
              onVoterIdChange: (id) => {
                voterId = id || null;
              },
            })
          ),
        ]),
      ];
    },
  };
}

/**
 * PostView: Board post detail page (shown at /boards/:tab/:mGroupId/:mMsgId)
 * Reads from Data.Posts[forumId][msgId]. The Posted API returns comments together
 * with board content, so comments for this post are filtered by their thread id.
 */
function PostView() {
  let comments = [];
  let loadingComments = true;
  let identities = [];
  let voteIdentity = null;
  let postVoteSubmitting = false;
  let notesExpanded = false;

  const nameOf = (id) => (!id || Number(id) === 0 ? 'Anonymous' : (rs.userList.username(id) || rs.userList.userMap[id] || `${String(id).slice(0, 10)}…`));

  async function loadComments(forumId, msgId) {
    loadingComments = true;
    comments = [];
    try {
      const res = await rs.rsJsonApiRequest('/rsPosted/getBoardAllContent', { boardId: forumId });
      if (res && res.body && res.body.retval) {
        comments = (res.body.comments || res.body.commentList || []).filter((comment) => {
          const meta = (comment && comment.mMeta) || {};
          return meta.mThreadId === msgId || (!meta.mThreadId && meta.mParentId === msgId);
        });
        //  The endpoints reachable over the JSON API never fill a comment's
        //  mUpVotes (only the unexposed getRelatedComments tallies), so the
        //  counts rendered from them were 0 forever. The votes travel in
        //  their own array here, one message per vote with mParentId naming
        //  its target: count them ourselves, the way the channels page does.
        const counts = {};
        (res.body.votes || res.body.voteList || []).forEach((vote) => {
          const parentId = vote && vote.mMeta && vote.mMeta.mParentId;
          if (!parentId) return;
          if (!counts[parentId]) counts[parentId] = { up: 0, down: 0 };
          if (vote.mVoteType === util.GXS_VOTE_UP) counts[parentId].up += 1;
          else if (vote.mVoteType === util.GXS_VOTE_DOWN) counts[parentId].down += 1;
        });
        comments.forEach((comment) => {
          const tally = counts[(comment.mMeta && comment.mMeta.mMsgId) || ''];
          comment.mUpVotes = tally ? tally.up : 0;
          comment.mDownVotes = tally ? tally.down : 0;
        });
      }
    } catch (e) {
      console.warn('PostView: failed to load comments', e);
    }
    loadingComments = false;
    m.redraw();
  }

  return {
    oninit: (v) => {
      // Ensure board data is loaded
      if (!Data.Posts[v.attrs.forumId] || !Data.Posts[v.attrs.forumId][v.attrs.msgId]) {
        util.updateDisplayBoards(v.attrs.forumId);
      }
      loadComments(v.attrs.forumId, v.attrs.msgId);

      // A board comment must be signed by one of the user's identities.
      peopleUtil.ownIds((ids) => {
        identities = (ids || []).filter((id) => Number(id) !== 0);
        voteIdentity = identities[0] || null;
        m.redraw();
      });
    },
    view: (v) => {
      const { forumId, msgId } = v.attrs;
      const plist = Data.Posts[forumId] || {};
      const itemObj = plist[msgId] || {};
      const p = itemObj.post || itemObj;
      const meta = (p && p.mMeta) ? p.mMeta : {};

      const title = meta.mMsgName || p.mMsgName || p.title || 'Post';
      const notes = util.plainText(p.mNotes || p.mBody || p.notes || p.body || '');
      const hasLongNotes = notes.length > 280;
      const author = meta.mAuthorId ? meta.mAuthorId.substring(0, 10) : 'Unknown';
      const publishTs = meta.mPublishTs || p.mPublishTs || null;
      const dateStr = publishTs
        ? (typeof publishTs === 'object' && publishTs.xint64
            ? new Date(publishTs.xint64 * 1000).toLocaleString()
            : new Date(publishTs * 1000).toLocaleString())
        : '';
      const numberValue = (value) => {
        if (value && typeof value === 'object') return Number(value.xint64 || value.xint32 || 0);
        return Number(value || 0);
      };
      const postUpVotes = numberValue(p.mUpVotes !== undefined ? p.mUpVotes : meta.mUpVotes);
      const postDownVotes = numberValue(p.mDownVotes !== undefined ? p.mDownVotes : meta.mDownVotes);

      //  The kanban resolver knows every shape a board image arrives in; the
      //  two explicit fields below are the fallback for posts it cannot read.
      let imgSrc = boardKanban.extractImageSrc(itemObj);
      if (!imgSrc) {
        if (p.mImage && p.mImage.mData && p.mImage.mData.base64 && p.mImage.mData.base64.trim()) {
          imgSrc = `data:image/png;base64,${p.mImage.mData.base64}`;
        } else if (p.mThumbnail && p.mThumbnail.mData && p.mThumbnail.mData.base64 && p.mThumbnail.mData.base64.trim()) {
          imgSrc = `data:image/png;base64,${p.mThumbnail.mData.base64}`;
        }
      }

      const openPhoto = () =>
        boardKanban.openPhotoModal([{ title, image: imgSrc, thumbnail: imgSrc, post: p }], 0);

      return [
        m(widget.PageHead, {
          back: {
            label: 'Back to board',
            onclick: () => m.route.set('/boards/:tab/:mGroupId', {
              tab: m.route.param().tab || 'Subscribed',
              mGroupId: forumId,
            }),
          },
          title,
        }),
        m('.widget__body', [
          imgSrc
            ? m(
                '.board-post-media',
                {
                  role: 'button',
                  tabindex: 0,
                  title: 'View full photo',
                  'aria-label': 'View full photo',
                  onclick: openPhoto,
                  onkeydown: (e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    openPhoto();
                  },
                },
                [
                  m('img.board-post-media__image', { src: imgSrc, alt: title }),
                  m('.board-post-media__expand-hint', [icon('expand'), m('span', 'View full photo')]),
                ]
              )
            : null,
          m('.board-post-meta', [
            m('span', 'Posted by '),
            m('b', author),
            dateStr ? m('span', ` • ${dateStr}`) : null,
          ]),
          m('.board-post-voting', [
            m('.board-post-voting__identity', [
              m('label[for=board-post-voter]', 'Vote as'),
              m('select#board-post-voter', {
                value: voteIdentity || '',
                disabled: identities.length === 0 || postVoteSubmitting,
                onchange: (e) => { voteIdentity = e.target.value; },
              }, identities.length
                ? identities.map((id) => m('option', { value: id }, nameOf(id)))
                : m('option', { value: '' }, 'Loading identities…')),
            ]),
            m('.board-post-voting__buttons', [
              m('button[type=button][title=Upvote post]', {
                disabled: !voteIdentity || postVoteSubmitting,
                onclick: async () => {
                  postVoteSubmitting = true;
                  m.redraw();
                  //  The bump is what the reader sees: the core only retallies
                  //  the stored count on its ~15 s background pass.
                  const voted = await util.voteForPost(forumId, msgId, util.GXS_VOTE_UP, voteIdentity);
                  if (voted) p.mUpVotes = numberValue(p.mUpVotes !== undefined ? p.mUpVotes : meta.mUpVotes) + 1;
                  postVoteSubmitting = false;
                  m.redraw();
                },
              }, [icon('arrow-up'), ` ${postUpVotes}`]),
              m('span.board-post-voting__score', postUpVotes - postDownVotes),
              m('button[type=button][title=Downvote post]', {
                disabled: !voteIdentity || postVoteSubmitting,
                onclick: async () => {
                  postVoteSubmitting = true;
                  m.redraw();
                  const voted = await util.voteForPost(forumId, msgId, util.GXS_VOTE_DOWN, voteIdentity);
                  if (voted) p.mDownVotes = numberValue(p.mDownVotes !== undefined ? p.mDownVotes : meta.mDownVotes) + 1;
                  postVoteSubmitting = false;
                  m.redraw();
                },
              }, [icon('arrow-down'), ` ${postDownVotes}`]),
            ]),
          ]),
          notes ? m('.post-description.board-post-description', [
            m('.post-description__text', { class: notesExpanded ? '' : 'post-description__text--collapsed', style: { whiteSpace: 'pre-wrap', maxHeight: notesExpanded ? 'none' : '4.5em', overflow: 'hidden', lineHeight: '1.5' } }, notes),
            hasLongNotes ? m('button.post-description__toggle[type=button]', { onclick: () => { notesExpanded = !notesExpanded; } }, notesExpanded ? 'Show less' : '…more') : null,
          ]) : null,
          m('hr'),
          m(CommentsSection, {
            comments,
            loading: loadingComments,
            rootThreadId: msgId,
            identities,
            voteIdentity,
            onVoteIdentity: (id) => { voteIdentity = id; },
            onSubmitComment: async ({ text, authorId, parentId }) => {
              const res = await rs.rsJsonApiRequest('/rsPosted/createCommentV2', {
                boardId: forumId,
                postId: msgId,
                comment: text,
                authorId,
                parentId: parentId || msgId,
              });
              if (!res || !res.body || res.body.retval === false) {
                throw new Error((res && res.body && res.body.errorMessage) || 'Your comment could not be posted.');
              }
              await loadComments(forumId, msgId);
              await util.updateDisplayBoards(forumId);
            },
            onVoteComment: async ({ commentId, voteType, voteIdentity: voterId }) => {
              await util.voteForComment(forumId, msgId, commentId, voteType, voterId);
              await loadComments(forumId, msgId);
            },
          }),
        ]),
      ];
    },
  };
}
module.exports = {
  BoardView,
  PostView,
  createboard,
};
