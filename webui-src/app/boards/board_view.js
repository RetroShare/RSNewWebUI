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
  let circle;
  return {
    oninit: (vnode) => {
      if (vnode.attrs.authorId) {
        identity = vnode.attrs.authorId[0];
        circle = util.PUBLIC;
      }
    },
    view: (vnode) =>
      m('.widget', [
        m('h3', 'Create Board'),
        m('hr'),
        m('input[type=text][placeholder=Title]', {
          oninput: (e) => (title = e.target.value),
        }),
        m('label[for=idtags]', 'Select identity'),
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
                  rs.userList.username(o)
                    ? rs.userList.username(o) + ' (' + o.slice(0, 8) + '...)'
                    : 'No Signature'
                )
              ),
          ]
        ),

        m('textarea[rows=5][placeholder=Description]', {
          style: { width: '90%', display: 'block' },
          oninput: (e) => (body = e.target.value),
          value: body,
        }),
        m('label[for=circletags]', 'Select Distribution'),
        m(
          'select[id=circletags]',
          {
            value: circle,
            onchange: (e) => {
              circle = e.target.value;
            },
          },
          [
            m('option', { value: util.PUBLIC }, 'Public'),
            m('option', { value: util.EXTERNAL }, 'Restricted to External Circle'),
          ]
        ),
        m(
          'button',
          {
            onclick: async () => {
              const res = await rs.rsJsonApiRequest('/rsposted/createBoard', {
                name: title,
                description: body,
                authorId: identity,
                circleType: Number(circle),
              });
              res.body.retval
                ? util.popupmessage([
                    m('h3', 'Success'),
                    m('hr'),
                    m('p', 'Board created successfully'),
                  ])
                : util.popupmessage([
                    m('h3', 'Error'),
                    m('hr'),
                    m('p', 'Error in creating Board'),
                  ]);
            },
          },
          'Create'
        ),
      ]),
  };
}

function BoardView() {
  let lastLoadedBoardId = null;

  return {
    oninit: (v) => {
      lastLoadedBoardId = v.attrs.id;
      util.updateDisplayBoards(v.attrs.id);
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
      let bauthor = 'Unknown';
      if (boardInfo.author) {
        if (rs.userList.userMap[boardInfo.author]) {
          bauthor = rs.userList.userMap[boardInfo.author];
        } else if (Number(boardInfo.author) === 0) {
          bauthor = 'No Contact Author';
        }
      }
      const bsubscribed = boardInfo.isSubscribed;
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
              m('img', {
                src:
                  !bimage || !bimage.mData || bimage.mData.base64 === ''
                    ? 'data/streaming.png'
                    : `data:image/png;base64,${bimage.mData.base64}`,
              }),
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
            m('.posts__heading', m('h3', 'Posts')),
            m(boardKanban.BoardView, {
              forumId: v.attrs.id,
              items,
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
          notes ? m('.post-description.board-post-description', [
            m('.post-description__text', { class: notesExpanded ? '' : 'post-description__text--collapsed', style: { whiteSpace: 'pre-wrap', maxHeight: notesExpanded ? 'none' : '4.5em', overflow: 'hidden', lineHeight: '1.5' } }, notes),
            hasLongNotes ? m('button.post-description__toggle[type=button]', { onclick: () => { notesExpanded = !notesExpanded; } }, notesExpanded ? 'Show less' : '…more') : null,
          ]) : null,
          m('hr'),
          m('.board-comments', [
            m('.board-comments__heading', [
              m('h3', `${comments.length} Comment${comments.length === 1 ? '' : 's'}`),
              m('span', [m('i.fas.fa-sort-amount-down'), ' Oldest first']),
              m('.board-comments__voter', [
                m('label[for=board-comment-voter]', 'Voter identity'),
                m('select#board-comment-voter', {
                  value: voteIdentity || '',
                  disabled: identities.length === 0,
                  onchange: (e) => { voteIdentity = e.target.value; },
                }, identities.length
                  ? identities.map((id) => m('option', { value: id }, nameOf(id)))
                  : m('option', { value: '' }, 'Loading identities…')),
              ]),
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
              : m('.board-comments__list', treeOfComments().map((node) => renderComment(node, 0))),
          ]),
        ]),
      ];
    },
  };

  function renderComment(node, depth) {
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
            onclick: () => util.voteForPost(forumId, key, util.GXS_VOTE_UP, voteIdentity),
          }, [m('i.fas.fa-thumbs-up'), ` ${comment.mUpVotes || 0}`]),
          m('button[type=button]', {
            disabled: !voteIdentity,
            onclick: () => util.voteForPost(forumId, key, util.GXS_VOTE_DOWN, voteIdentity),
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
        repliesCount && repliesExpanded ? m('.board-comment__replies', node.children.map((reply) => renderComment(reply, depth + 1))) : null,
      ])
    ]);
  }
}

module.exports = {
  BoardView,
  PostView,
  createboard,
};
