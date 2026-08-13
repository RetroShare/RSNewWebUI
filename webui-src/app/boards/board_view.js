const m = require('mithril');
const util = require('boards/boards_util');
const boardKanban = require('boards/board_kanban');
const rs = require('rswebui');
const peopleUtil = require('people/people_util');
const chatEmoji = require('chat/chat_emoji');
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
        m('.create-board-form__heading', [
          m('h3', 'Create Board'),
          m('p', 'Set up the board appearance and publishing options.'),
        ]),
        m('input.create-board-form__title[type=text][placeholder=Board title]', {
          oninput: (e) => (title = e.target.value),
        }),
        m('.create-board-form__visual', [
          m('.board-thumbnail-preview', [
            thumbnailPreview
              ? m('img', { src: thumbnailPreview, alt: 'Board thumbnail preview' })
              : m('.board-thumbnail-preview__placeholder', [
                m('i.fas.fa-image'),
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
          }, [m('i.fas.fa-upload'), thumbnailPreview ? ' Change image' : ' Choose image']),
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
        m(
          'button.create-board-form__submit',
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
              res.body.retval
                ? util.popupmessage([
                    m('h3', 'Success'),
                    m('hr'),
                    m('p', 'Board created successfully'),
                  ])
                : util.popupmessage([
                    m('h3', 'Error'),
                    m('hr'),
                    m('p', res.body.errorMessage || 'Error in creating Board'),
                  ]);
            },
          },
          'Create'
        ),
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

    let result = '';
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
      m('.create-board-post__heading', [
        m('h3', 'Create a Post'),
        m('p', 'Share an interesting post with a clear, descriptive title.'),
      ]),
      m('.create-board-post__modes', [
        ['post', 'fa-comment-alt', 'Post'],
        ['image', 'fa-image', 'Image'],
        ['link', 'fa-link', 'Link'],
      ].map(([value, icon, label]) => m('button[type=button]', {
        class: mode === value ? 'active' : '',
        onclick: () => (mode = value),
      }, [m(`i.fas.${icon}`), ` ${label}`]))),
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
            : m('.create-board-post__placeholder', [m('i.fas.fa-image'), m('span', 'Post image')]),
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
        }, [m('i.fas.fa-upload'), imagePreview ? ' Change image' : ' Choose image']),
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
              util.popupmessage([m('h3', 'Success'), m('hr'), m('p', 'Post created successfully')]);
            } else {
              util.popupmessage([m('h3', 'Error'), m('hr'), m('p',
                res.body.error_message || res.body.errorMessage || 'The post could not be created')]);
            }
          } finally {
            submitting = false;
            m.redraw();
          }
        },
      }, submitting ? 'Posting…' : 'Post'),
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
        m(
          'a[title=Back]',
          {
            onclick: () =>
              m.route.set('/boards/:tab', {
                tab: m.route.param().tab || 'Subscribed',
              }),
          },
          m('i.fas.fa-arrow-left')
        ),
        m('.widget__heading', [
          m('h3', bname),
          m(
            'button',
            {
              onclick: async () => {
                const res = await rs.rsJsonApiRequest('/rsposted/subscribeToBoard', {
                  boardId: v.attrs.id,
                  subscribe: !bsubscribed,
                });
                if (res.body.retval) {
                  boardInfo.isSubscribed = !bsubscribed;
                  m.redraw();
                }
              },
            },
            bsubscribed ? 'Subscribed' : 'Subscribe'
          ),
        ]),
        m('.widget__body', [
          m('.media-item', [
            m('.media-item__details', [
              bimage && bimage.mData && bimage.mData.base64
                ? m('img', {
                  src: `data:image/png;base64,${bimage.mData.base64}`,
                  alt: `${bname} board thumbnail`,
                })
                : m('.board-detail-default-thumbnail[role=img][aria-label=Default board thumbnail]',
                  m('i.fas.fa-globe')
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
              canPublish && m('button.board-posts-heading__create[type=button][title=Create Post][aria-label=Create Post]', {
                onclick: () => util.popupmessage(
                  m(CreatePost, { boardId: v.attrs.id }),
                  'create-board-post-modal'
                ),
              }, [m('i.fas.fa-plus'), m('span', 'Create Post')]),
            ]),
            m(boardKanban.BoardView, {
              forumId: v.attrs.id,
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
  let authorId = null;
  let voteIdentity = null;
  let postVoteSubmitting = false;
  let replyTo = null;
  let composerText = '';
  let submitting = false;
  let submitError = '';
  let notesExpanded = false;
  let showEmojiPicker = false;
  const expandedReplies = {};

  const metaOf = (comment) => (comment && comment.mMeta) || {};
  const idOf = (comment) => metaOf(comment).mMsgId || comment.msgId || comment.id;
  const parentOf = (comment) => metaOf(comment).mParentId || comment.parentId || '';
  const textOf = (comment) => comment.mComment || comment.comment || comment.mBody || '';
  const nameOf = (id) => !id || Number(id) === 0 ? 'Anonymous' : (rs.userList.username(id) || rs.userList.userMap[id] || `${String(id).slice(0, 10)}…`);
  const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const timeOf = (value) => {
    const seconds = value && typeof value === 'object' ? value.xint64 : value;
    const date = Number(seconds) ? new Date(Number(seconds) * 1000) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : '';
  };

  function treeOfComments() {
    const nodes = {};
    const roots = [];
    comments.forEach((comment) => {
      const id = idOf(comment);
      if (id) nodes[id] = { comment, children: [] };
    });
    Object.keys(nodes).forEach((id) => {
      const node = nodes[id];
      const parent = parentOf(node.comment);
      if (parent && nodes[parent] && parent !== id) nodes[parent].children.push(node);
      else roots.push(node);
    });
    const chronological = (a, b) => Number(metaOf(a.comment).mPublishTs && (metaOf(a.comment).mPublishTs.xint64 || metaOf(a.comment).mPublishTs)) - Number(metaOf(b.comment).mPublishTs && (metaOf(b.comment).mPublishTs.xint64 || metaOf(b.comment).mPublishTs));
    roots.sort(chronological);
    Object.keys(nodes).forEach((id) => nodes[id].children.sort(chronological));
    return roots;
  }

  async function loadComments(forumId, msgId) {
    loadingComments = true;
    comments = [];
    try {
      const res = await rs.rsJsonApiRequest('/rsPosted/getBoardAllContent', { boardId: forumId });
      if (res && res.body && res.body.retval) {
        comments = (res.body.comments || res.body.commentList || []).filter((comment) => {
          const meta = metaOf(comment);
          return meta.mThreadId === msgId || (!meta.mThreadId && meta.mParentId === msgId);
        });
      }
    } catch (e) {
      console.warn('PostView: failed to load comments', e);
    }
    loadingComments = false;
    m.redraw();
  }

  async function submitComment(forumId, msgId) {
    const comment = composerText.trim();
    if (!comment || !authorId || submitting) return;
    submitting = true;
    submitError = '';
    try {
      const res = await rs.rsJsonApiRequest('/rsPosted/createCommentV2', {
        boardId: forumId,
        postId: msgId,
        comment,
        authorId,
        parentId: replyTo ? idOf(replyTo) : msgId,
      });
      if (!res || !res.body || res.body.retval === false) {
        submitError = (res && res.body && res.body.errorMessage) || 'Your comment could not be posted.';
        return;
      }
      composerText = '';
      replyTo = null;
      await loadComments(forumId, msgId);
      await util.updateDisplayBoards(forumId);
    } catch (e) {
      console.warn('PostView: failed to submit comment', e);
      submitError = 'Your comment could not be posted. Please try again.';
    } finally {
      submitting = false;
      m.redraw();
    }
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
        authorId = identities[0] || null;
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

      let imgSrc = '';
      if (p.mImage && p.mImage.mData && p.mImage.mData.base64 && p.mImage.mData.base64.trim()) {
        imgSrc = `data:image/png;base64,${p.mImage.mData.base64}`;
      } else if (p.mThumbnail && p.mThumbnail.mData && p.mThumbnail.mData.base64 && p.mThumbnail.mData.base64.trim()) {
        imgSrc = `data:image/png;base64,${p.mThumbnail.mData.base64}`;
      }

      return [
        m(
          'a[title=Back]',
          {
            onclick: () =>
              m.route.set('/boards/:tab/:mGroupId', {
                tab: m.route.param().tab || 'Subscribed',
                mGroupId: forumId,
              }),
          },
          m('i.fas.fa-arrow-left')
        ),
        m('.widget__heading', m('h3', title)),
        m('.widget__body', [
          imgSrc
            ? m('img', {
                src: imgSrc,
                alt: title,
                style: { maxWidth: '100%', maxHeight: '400px', display: 'block', marginBottom: '1rem', borderRadius: '8px' },
              })
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
                  await util.voteForPost(forumId, msgId, util.GXS_VOTE_UP, voteIdentity);
                  postVoteSubmitting = false;
                  m.redraw();
                },
              }, [m('i.fas.fa-arrow-up'), ` ${postUpVotes}`]),
              m('span.board-post-voting__score', postUpVotes - postDownVotes),
              m('button[type=button][title=Downvote post]', {
                disabled: !voteIdentity || postVoteSubmitting,
                onclick: async () => {
                  postVoteSubmitting = true;
                  m.redraw();
                  await util.voteForPost(forumId, msgId, util.GXS_VOTE_DOWN, voteIdentity);
                  postVoteSubmitting = false;
                  m.redraw();
                },
              }, [m('i.fas.fa-arrow-down'), ` ${postDownVotes}`]),
            ]),
          ]),
          notes ? m('.post-description.board-post-description', [
            m('.post-description__text', { class: notesExpanded ? '' : 'post-description__text--collapsed', style: { whiteSpace: 'pre-wrap', maxHeight: notesExpanded ? 'none' : '4.5em', overflow: 'hidden', lineHeight: '1.5' } }, notes),
            hasLongNotes ? m('button.post-description__toggle[type=button]', { onclick: () => { notesExpanded = !notesExpanded; } }, notesExpanded ? 'Show less' : '…more') : null,
          ]) : null,
          m('hr'),
          m('.board-comments', [
            m('.board-comments__heading', [
              m('h3', `${comments.length} Comment${comments.length === 1 ? '' : 's'}`),
              m('span', [m('i.fas.fa-sort-amount-down'), ' Oldest first']),
            ]),
            m('.board-comment-composer', [
              m('.board-comment-avatar', initials(nameOf(authorId))),
              m('.board-comment-composer__body', [
                replyTo ? m('.board-comment-composer__replying', ['Replying to ', m('b', nameOf(metaOf(replyTo).mAuthorId)), m('button[type=button][aria-label=Cancel reply]', { onclick: () => { replyTo = null; composerText = ''; } }, m('i.fas.fa-times'))]) : null,
                identities.length ? m('select.board-comment-composer__identity', { value: authorId, onchange: (e) => { authorId = e.target.value; } }, identities.map((id) => m('option', { value: id }, nameOf(id)))) : null,
                m('textarea.board-comment-composer__input[rows=1][placeholder=Add a comment…]', { value: composerText, disabled: !authorId || submitting, oninput: (e) => { composerText = e.target.value; }, onkeydown: (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submitComment(forumId, msgId); } }),
                !authorId ? m('p.board-comment-composer__hint', 'Create or select an identity to post a comment.') : null,
                submitError ? m('p.board-comment-composer__error', submitError) : null,
                m('.board-comment-composer__actions', [
                  m('.board-comment-composer__emoji', { style: { position: 'relative', marginRight: 'auto' } }, [
                    m('button[type=button][title=Insert emoji][aria-label=Insert emoji]', { style: { width: '32px', height: '32px', padding: '0', borderRadius: '50%', border: '0', boxShadow: 'none', background: showEmojiPicker ? '#e0f2fe' : 'transparent', color: '#475569', fontSize: '1.15rem' }, onclick: () => { showEmojiPicker = !showEmojiPicker; } }, m('i.fas.fa-smile')),
                    showEmojiPicker ? m('.board-comment-emoji-popover', { style: { position: 'absolute', zIndex: '20', top: '38px', left: '0', width: '250px', maxHeight: '180px', overflowY: 'auto', padding: '.5rem', display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '.2rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', boxShadow: '0 8px 20px rgba(0,0,0,.16)' } }, chatEmoji.EMOJI_DATA.Smileys.slice(0, 48).map((emoji) => m('button[type=button]', { style: { width: '28px', height: '28px', padding: '0', border: '0', boxShadow: 'none', background: 'transparent', fontSize: '1.1rem' }, onclick: () => { composerText += emoji; showEmojiPicker = false; } }, emoji))) : null,
                  ]),
                  composerText || replyTo ? m('button.board-comment-composer__cancel[type=button]', { onclick: () => { composerText = ''; replyTo = null; submitError = ''; } }, 'Cancel') : null,
                  m('button.board-comment-composer__submit[type=button]', { disabled: !composerText.trim() || !authorId || submitting, onclick: () => submitComment(forumId, msgId) }, submitting ? 'Posting…' : 'Comment')
                ])
              ])
            ]),
            loadingComments ? m('.board-comments__status', [m('i.fas.fa-spinner.fa-spin'), ' Loading comments…'])
              : comments.length === 0 ? m('.board-comments__empty', [m('i.fas.fa-comment'), m('p', 'No comments yet. Start the conversation.')])
              : m('.board-comments__list', treeOfComments().map((node) => renderComment(node, 0, forumId, msgId))),
          ]),
        ]),
      ];
    },
  };

  function renderComment(node, depth, forumId, msgId) {
    const comment = node.comment;
    const key = idOf(comment);
    const meta = metaOf(comment);
    const name = nameOf(meta.mAuthorId);
    const repliesCount = node.children.length;
    const repliesExpanded = expandedReplies[key] === true;
    return m('.board-comment', { key: idOf(comment), class: depth ? 'board-comment--reply' : '' }, [
      m('.board-comment-avatar', initials(name)),
      m('.board-comment__content', [
        m('.board-comment__header', [
          m('.board-comment__meta', [m('b', name), timeOf(meta.mPublishTs) ? m('span', timeOf(meta.mPublishTs)) : null]),
          m('button.board-comment__menu[type=button][aria-label=Comment options][title=Comment options]', m('i.fas.fa-ellipsis-v')),
        ]),
        m('p.board-comment__text', textOf(comment)),
        m('.board-comment__actions', [
          m('button[type=button]', {
            disabled: !voteIdentity,
            onclick: () => util.voteForComment(forumId, msgId, key, util.GXS_VOTE_UP, voteIdentity),
          }, [m('i.fas.fa-thumbs-up'), ` ${comment.mUpVotes || 0}`]),
          m('button[type=button]', {
            disabled: !voteIdentity,
            onclick: () => util.voteForComment(forumId, msgId, key, util.GXS_VOTE_DOWN, voteIdentity),
          }, m('i.fas.fa-thumbs-down')),
          m('button[type=button]', { onclick: () => { replyTo = comment; composerText = ''; submitError = ''; } }, 'Reply')
        ]),
        repliesCount ? m('button.board-comment__replies-toggle[type=button]', {
          'aria-expanded': repliesExpanded,
          onclick: () => { expandedReplies[key] = !repliesExpanded; },
        }, [
          `${repliesCount} ${repliesCount === 1 ? 'reply' : 'replies'} `,
          m('i.fas', { class: repliesExpanded ? 'fa-chevron-up' : 'fa-chevron-down' }),
        ]) : null,
        repliesCount && repliesExpanded
          ? m('.board-comment__replies', node.children.map((reply) => renderComment(reply, depth + 1, forumId, msgId)))
          : null,
      ])
    ]);
  }
}

module.exports = {
  BoardView,
  PostView,
  createboard,
};
