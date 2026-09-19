const m = require('mithril');
const rs = require('rswebui');
const peopleUtil = require('people/people_util');
const chatEmoji = require('chat/chat_emoji');
const icon = require('icon');

//  The core's contract (rsgxscommon.h RsGxsVoteType, same as the legacy
//  GXS_VOTE_* constants used by boards_util/channels_util): DOWN = 1, UP = 2.
//  These were inverted at first, and a GXS vote is a published message that
//  cannot be retracted: every thumbs-up was recorded as a downvote.
const VOTE_UP = 2;
const VOTE_DOWN = 1;

const CommentsSection = () => {
  let replyTo = null;
  let composerText = '';
  let authorId = null;
  let submitting = false;
  let submitError = '';
  let showEmojiPicker = false;
  const expandedReplies = {};

  const metaOf = (comment) => (comment && comment.mMeta) || {};
  const idOf = (comment) => metaOf(comment).mMsgId || comment.msgId || comment.id;
  const parentOf = (comment) => metaOf(comment).mParentId || comment.parentId || '';
  const textOf = (comment) => comment.mComment || comment.comment || comment.mBody || '';
  const nameOf = (id) => (!id || Number(id) === 0 ? 'Anonymous' : (rs.userList.username(id) || rs.userList.userMap[id] || `${String(id).slice(0, 10)}…`));
  const dateOf = (value) => {
    const seconds = value && typeof value === 'object' ? value.xint64 : value;
    const date = Number(seconds) ? new Date(Number(seconds) * 1000) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : '';
  };

  function buildTree(rawComments, rootThreadId) {
    const nodes = {};
    const roots = [];
    const list = Array.isArray(rawComments)
      ? rawComments
      : Object.values(rawComments || {}).map((entry) => entry.comment || entry);

    list.forEach((comment) => {
      const id = idOf(comment);
      if (id) nodes[id] = { comment, children: [] };
    });

    Object.keys(nodes).forEach((id) => {
      const node = nodes[id];
      const parent = parentOf(node.comment);
      if (parent && parent !== id && parent !== rootThreadId && nodes[parent]) {
        nodes[parent].children.push(node);
      } else {
        roots.push(node);
      }
    });

    const chronological = (a, b) => {
      const ta = Number(metaOf(a.comment).mPublishTs && (metaOf(a.comment).mPublishTs.xint64 || metaOf(a.comment).mPublishTs)) || 0;
      const tb = Number(metaOf(b.comment).mPublishTs && (metaOf(b.comment).mPublishTs.xint64 || metaOf(b.comment).mPublishTs)) || 0;
      return ta - tb;
    };
    roots.sort(chronological);
    Object.keys(nodes).forEach((id) => nodes[id].children.sort(chronological));
    return { roots, totalCount: list.length };
  }

  async function handleSubmit(vnode) {
    const comment = composerText.trim();
    if (!comment || !authorId || submitting) return;
    submitting = true;
    submitError = '';
    try {
      if (typeof vnode.attrs.onSubmitComment === 'function') {
        await vnode.attrs.onSubmitComment({
          text: comment,
          authorId,
          parentId: replyTo ? idOf(replyTo) : null,
          replyTo,
        });
      }
      composerText = '';
      replyTo = null;
    } catch (err) {
      console.warn('CommentsSection: submission failed', err);
      submitError = (err && err.message) || 'Your comment could not be posted. Please try again.';
    } finally {
      submitting = false;
      m.redraw();
    }
  }

  function renderCommentNode(node, depth, vnode) {
    const comment = node.comment;
    const id = idOf(comment);
    const meta = metaOf(comment);
    const name = nameOf(meta.mAuthorId);
    const repliesCount = node.children.length;
    const repliesExpanded = expandedReplies[id] === true;

    const votes = typeof vnode.attrs.getCommentVotes === 'function'
      ? vnode.attrs.getCommentVotes(id, comment)
      : {
          upvotes: Number(comment.mUpVotes || 0),
          downvotes: Number(comment.mDownVotes || 0),
        };

    const voteIdentity = vnode.attrs.voteIdentity;

    return m('.comment', { key: id, class: depth ? 'comment--reply' : '' }, [
      m('.comment-avatar', m(peopleUtil.IdentityAvatar, {
        identityId: meta.mAuthorId,
        name,
        size: '100%',
      })),
      m('.comment__content', [
        m('.comment__header', [
          m('.comment__meta', [
            m('b', name),
            dateOf(meta.mPublishTs) ? m('span', dateOf(meta.mPublishTs)) : null,
          ]),
        ]),
        m('p.comment__text', textOf(comment)),
        m('.comment__actions', [
          m('button[type=button]', {
            disabled: !voteIdentity,
            onclick: () => {
              if (typeof vnode.attrs.onVoteComment === 'function') {
                vnode.attrs.onVoteComment({
                  commentId: id,
                  voteType: VOTE_UP,
                  voteIdentity,
                  comment,
                });
              }
            },
          }, [icon('thumbs-up'), ` ${votes.upvotes || 0}`]),
          m('button.is-icon[type=button]', {
            disabled: !voteIdentity,
            onclick: () => {
              if (typeof vnode.attrs.onVoteComment === 'function') {
                vnode.attrs.onVoteComment({
                  commentId: id,
                  voteType: VOTE_DOWN,
                  voteIdentity,
                  comment,
                });
              }
            },
          }, icon('thumbs-down')),
          m('button[type=button]', {
            onclick: () => {
              replyTo = comment;
              composerText = '';
              submitError = '';
            },
          }, [icon('reply'), 'Reply']),
        ]),
        repliesCount ? m('button.comment__replies-toggle[type=button]', {
          'aria-expanded': repliesExpanded,
          onclick: () => { expandedReplies[id] = !repliesExpanded; },
        }, [
          m('span', `${repliesCount} ${repliesCount === 1 ? 'reply' : 'replies'}`),
          icon(repliesExpanded ? 'chevron-up' : 'chevron-down'),
        ]) : null,
        repliesCount && repliesExpanded
          ? m('.comment__replies', node.children.map((child) => renderCommentNode(child, depth + 1, vnode)))
          : null,
      ]),
    ]);
  }

  return {
    view: (vnode) => {
      const identities = (vnode.attrs.identities || []).filter((id) => Number(id) !== 0);
      if (!authorId && identities.length) authorId = identities[0];
      if (authorId && identities.length && !identities.includes(authorId)) {
        authorId = identities[0];
      }

      const { roots, totalCount } = buildTree(vnode.attrs.comments, vnode.attrs.rootThreadId);
      const showVoter = typeof vnode.attrs.onVoteIdentity === 'function';

      return m('.comments', [
        m('.comments__heading', [
          m('h3', `${totalCount} Comment${totalCount === 1 ? '' : 's'}`),
          m('span', [icon('sort-amount-down'), ' Oldest first']),
          showVoter ? m('.comments__voter', [
            m('label[for=comment-voter-select]', 'Voter identity'),
            m('select#comment-voter-select', {
              value: vnode.attrs.voteIdentity || '',
              disabled: identities.length === 0,
              onchange: (e) => vnode.attrs.onVoteIdentity(e.target.value),
            }, identities.length
              ? identities.map((id) => m('option', { value: id }, nameOf(id)))
              : m('option', { value: '' }, vnode.attrs.identitiesLoading ? 'Loading identities…' : 'No identity available')),
          ]) : null,
        ]),
        m('.comment-composer', [
          m('.comment-avatar', m(peopleUtil.IdentityAvatar, {
            identityId: authorId,
            name: nameOf(authorId),
            size: '100%',
          })),
          m('.comment-composer__body', [
            replyTo ? m('.comment-composer__replying', [
              'Replying to ',
              m('b', nameOf(metaOf(replyTo).mAuthorId)),
              m('button.is-icon[type=button][aria-label=Cancel reply]', {
                onclick: () => { replyTo = null; composerText = ''; },
              }, icon('times')),
            ]) : null,
            identities.length ? m('select.comment-composer__identity', {
              value: authorId || '',
              onchange: (e) => { authorId = e.target.value; },
            }, identities.map((id) => m('option', { value: id }, nameOf(id)))) : null,
            m('textarea.comment-composer__input[rows=1][placeholder=Add a comment…]', {
              value: composerText,
              disabled: !authorId || submitting,
              oninput: (e) => { composerText = e.target.value; },
              onkeydown: (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  handleSubmit(vnode);
                }
              },
            }),
            !authorId ? m('p.comment-composer__hint', vnode.attrs.identitiesLoading ? 'Loading identities…' : 'Create or select an identity to post a comment.') : null,
            submitError ? m('p.comment-composer__error', submitError) : null,
            m('.comment-composer__actions', [
              m('.comment-composer__emoji', [
                m('button.is-icon[type=button][title=Insert emoji][aria-label=Insert emoji]', {
                  class: showEmojiPicker ? 'comment-emoji-toggle is-open' : 'comment-emoji-toggle',
                  'aria-pressed': String(showEmojiPicker),
                  onclick: (e) => {
                    e.stopPropagation();
                    showEmojiPicker = !showEmojiPicker;
                  },
                }, icon('smile')),
                //  The shared picker. This was the first 48 Smileys and
                //  nothing else -- no other category, no search.
                showEmojiPicker && m(chatEmoji.EmojiPicker, {
                  onSelect: (emoji) => { composerText += emoji; },
                  onClose: () => { showEmojiPicker = false; },
                }),
              ]),
              composerText || replyTo ? m('button.comment-composer__cancel[type=button]', {
                onclick: () => {
                  composerText = '';
                  replyTo = null;
                  submitError = '';
                },
              }, [icon('times'), 'Cancel']) : null,
              m('button.comment-composer__submit[type=button]', {
                disabled: !composerText.trim() || !authorId || submitting,
                onclick: () => handleSubmit(vnode),
              }, [icon('paper-plane'), submitting ? 'Posting…' : 'Comment']),
            ]),
          ]),
        ]),
        vnode.attrs.loading ? m('.comments__status', [icon('spinner', { spin: true }), ' Loading comments…'])
          : roots.length ? m('.comments__list', roots.map((node) => renderCommentNode(node, 0, vnode)))
          : m('.comments__empty', [icon('comment'), m('p', 'No comments yet. Start the conversation.')]),
      ]);
    },
  };
};

module.exports = {
  CommentsSection,
  ThreadedComments: CommentsSection,
  VOTE_UP,
  VOTE_DOWN,
};
