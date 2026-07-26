const m = require('mithril');
const util = require('boards/boards_util');
const boardKanban = require('boards/board_kanban');
const rs = require('rswebui');
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

          const notesText = p.mNotes || p.mBody || meta.mNotes || p.notes || p.body || '';
          const titleText = meta.mMsgName || p.mMsgName || p.title || 'Untitled Post';
          const commentCount = meta.mChildCount !== undefined
            ? meta.mChildCount
            : (p.commentCount !== undefined ? p.commentCount : 0);

          return {
            key: key,
            msgId: key,
            title: titleText,
            thumbnail: thumb,
            notes: notesText,
            commentCount: commentCount,
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
              items: items,
            })
          ),
        ]),
      ];
    },
  };
}

/**
 * PostView: Board post detail page (shown at /boards/:tab/:mGroupId/:mMsgId)
 * Reads from Data.Posts[forumId][msgId], fetches comments via /rsPosted/getPostComments
 */
function PostView() {
  let comments = [];
  let loadingComments = true;
  let newComment = '';
  let authorId = null;

  async function loadComments(forumId, msgId) {
    loadingComments = true;
    comments = [];
    try {
      const res = await rs.rsJsonApiRequest('/rsPosted/getPostComments', {
        boardId: forumId,
        postId: msgId,
      });
      if (res && res.body && res.body.retval) {
        comments = res.body.comments || [];
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

      // Get own identity for posting comments
      rs.rsJsonApiRequest('/rsIdentity/getOwnIds', {}, (data) => {
        if (data && data.ids && data.ids.length > 0) {
          authorId = data.ids[0];
        }
      });
    },
    view: (v) => {
      const { forumId, msgId } = v.attrs;
      const plist = Data.Posts[forumId] || {};
      const itemObj = plist[msgId] || {};
      const p = itemObj.post || itemObj;
      const meta = (p && p.mMeta) ? p.mMeta : {};

      const title = meta.mMsgName || p.mMsgName || p.title || 'Post';
      const notes = p.mNotes || p.mBody || p.notes || p.body || '';
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
          notes ? m('p', { style: { whiteSpace: 'pre-wrap', margin: '1rem 0' } }, notes) : null,
          m('hr'),
          m('.comments-section', [
            m('h3', 'Comments'),
            loadingComments
              ? m('p', 'Loading comments...')
              : comments.length === 0
              ? m('p', { style: { color: '#888' } }, 'No comments yet.')
              : m(
                  'ul',
                  { style: { listStyle: 'none', padding: 0 } },
                  comments.map((c) => {
                    const cmeta = (c && c.mMeta) ? c.mMeta : {};
                    const cAuthor = cmeta.mAuthorId ? cmeta.mAuthorId.substring(0, 10) : 'Unknown';
                    const cTs = cmeta.mPublishTs;
                    const cDate = cTs
                      ? (typeof cTs === 'object' && cTs.xint64
                          ? new Date(cTs.xint64 * 1000).toLocaleString()
                          : new Date(cTs * 1000).toLocaleString())
                      : '';
                    return m('li', { style: { padding: '0.6rem 0', borderBottom: '1px solid #333' } }, [
                      m('div', { style: { fontSize: '0.8em', color: '#888', marginBottom: '0.2rem' } }, [
                        m('b', cAuthor),
                        cDate ? m('span', ` • ${cDate}`) : null,
                      ]),
                      m('p', { style: { margin: 0 } }, c.mComment || c.comment || ''),
                    ]);
                  })
                ),
          ]),
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
