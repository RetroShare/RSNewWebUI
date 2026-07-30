const m = require('mithril');
const util = require('boards/boards_util');

const PAGE_SIZE = 25;

function numberValue(value) {
  if (value && typeof value === 'object' && value.xint64 !== undefined) value = value.xint64;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

/**
 * Fallback SVG Thumbnail when no image is available
 */
const FallbackImage = () =>
  m('.board-card__placeholder-content', {
    style: {
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '.3rem', color: '#64748b', fontSize: '.72rem', fontWeight: '600', textAlign: 'center',
    },
  }, [
    m('i.fas.fa-image[aria-hidden=true]', { style: { fontSize: '1.35rem' } }),
    m('span', 'No image'),
  ]);

/**
 * Check if notes string contains non-whitespace text
 */
function hasNotesText(notes) {
  if (notes === null || notes === undefined) return false;
  if (typeof notes !== 'string') notes = String(notes);
  return notes.trim().length > 0;
}

/**
 * Robust image extraction helper for RetroShare post items
 */
function extractImageSrc(item) {
  if (!item) return '';
  const p = item.post || item;

  if (item.thumbnail && typeof item.thumbnail === 'string' && item.thumbnail.trim() !== '') {
    return item.thumbnail.startsWith('data:') ? item.thumbnail : `data:image/png;base64,${item.thumbnail}`;
  }
  if (item.image && typeof item.image === 'string' && item.image.trim() !== '') {
    return item.image.startsWith('data:') ? item.image : `data:image/png;base64,${item.image}`;
  }
  if (p.mImage) {
    if (p.mImage.mData && p.mImage.mData.base64 && p.mImage.mData.base64.trim() !== '') {
      return `data:image/png;base64,${p.mImage.mData.base64}`;
    }
    if (typeof p.mImage.base64 === 'string' && p.mImage.base64.trim() !== '') {
      return `data:image/png;base64,${p.mImage.base64}`;
    }
    if (typeof p.mImage === 'string' && p.mImage.trim() !== '') {
      return p.mImage.startsWith('data:') ? p.mImage : `data:image/png;base64,${p.mImage}`;
    }
  }
  if (p.mThumbnail) {
    if (p.mThumbnail.mData && p.mThumbnail.mData.base64 && p.mThumbnail.mData.base64.trim() !== '') {
      return `data:image/png;base64,${p.mThumbnail.mData.base64}`;
    }
    if (typeof p.mThumbnail.base64 === 'string' && p.mThumbnail.base64.trim() !== '') {
      return `data:image/png;base64,${p.mThumbnail.base64}`;
    }
    if (typeof p.mThumbnail === 'string' && p.mThumbnail.trim() !== '') {
      return p.mThumbnail.startsWith('data:') ? p.mThumbnail : `data:image/png;base64,${p.mThumbnail}`;
    }
  }

  // Check notes/body text for embedded data:image or web URL
  const text = p.mNotes || p.mBody || item.notes || item.body || '';
  if (typeof text === 'string') {
    const dataMatch = text.match(/data:image\/[a-zA-Z]+;base64,[^"\s\)]+/);
    if (dataMatch) return dataMatch[0];
    const urlMatch = text.match(/https?:\/\/[^\s"\)<]+\.(?:png|jpg|jpeg|gif|webp)/i);
    if (urlMatch) return urlMatch[0];
  }

  return '';
}

/**
 * Dedicated fullscreen photo overlay appended directly to document.body.
 * Bypasses #modal-container entirely so z-index is guaranteed.
 */
let _photoOverlayEl = null;

function getPhotoOverlay() {
  if (!_photoOverlayEl) {
    _photoOverlayEl = document.createElement('div');
    _photoOverlayEl.id = 'photo-view-overlay';
    document.body.appendChild(_photoOverlayEl);
  }
  return _photoOverlayEl;
}

function closePhotoOverlay() {
  if (_photoOverlayEl) {
    _photoOverlayEl.style.display = 'none';
    m.render(_photoOverlayEl, null);
  }
}

/**
 * Close regular popup (non-photo)
 */
function closePopup() {
  const el = document.getElementById('modal-container');
  if (el) {
    el.style.display = 'none';
    m.render(el, null);
  }
  closePhotoOverlay();
}

/**
 * PhotoView Lightbox — Qt GUI style: nav arrows outside the image in a 3-col flex row
 */
function PhotoViewModal() {
  let currentIndex = 0;

  function navigate(photoList, newIndex) {
    currentIndex = newIndex;
    m.render(getPhotoOverlay(), m(PhotoViewModal, {
      photoList: photoList,
      photoIndex: currentIndex,
    }));
  }

  return {
    oninit: (vnode) => {
      currentIndex = vnode.attrs.photoIndex || 0;
    },
    view: (vnode) => {
      const { photoList = [] } = vnode.attrs;
      if (!photoList || photoList.length === 0) return null;

      if (currentIndex < 0) currentIndex = 0;
      if (currentIndex >= photoList.length) currentIndex = photoList.length - 1;

      const currentItem = photoList[currentIndex];
      if (!currentItem) return null;

      const p = currentItem.post || currentItem;
      const meta = (p && p.mMeta) ? p.mMeta : (currentItem.mMeta || {});
      const title = currentItem.title || meta.mMsgName || 'Photo View';
      const imgSrc = extractImageSrc(currentItem);
      const author = meta.mAuthorId ? meta.mAuthorId.substring(0, 10) : 'Unknown';
      const publishTs = meta.mPublishTs || currentItem.created;
      const dateStr = publishTs
        ? (typeof publishTs === 'object' && publishTs.xint64
            ? new Date(publishTs.xint64 * 1000).toLocaleString()
            : new Date(publishTs * 1000).toLocaleString())
        : '';

      const hasPrev = currentIndex > 0;
      const hasNext = currentIndex < photoList.length - 1;

      return m('.photo-view-dialog', [
        // Header: italic title + X close (Qt style)
        m('.photo-view-header', [
          m('h3.photo-view-title', title),
          m('button.photo-view-close-btn', {
            type: 'button',
            onclick: closePhotoOverlay,
            title: 'Close',
          }, '\u00d7'),
        ]),

        // Body: 3-column flex [left-nav] [image] [right-nav]
        // Arrows are outside the image, matching Qt GUI
        m('.photo-view-body', [
          m('.photo-view-nav-col', [
            hasPrev
              ? m('button.photo-view-nav-btn', {
                  type: 'button',
                  title: 'Previous',
                  onclick: (e) => { e.stopPropagation(); navigate(photoList, currentIndex - 1); },
                }, m('i.fas.fa-chevron-left'))
              : null,
          ]),
          m('.photo-view-img-wrap', [
            imgSrc
              ? m('img.photo-view-img', { src: imgSrc, alt: title })
              : m('.photo-view-no-img', 'No image available'),
          ]),
          m('.photo-view-nav-col', [
            hasNext
              ? m('button.photo-view-nav-btn', {
                  type: 'button',
                  title: 'Next',
                  onclick: (e) => { e.stopPropagation(); navigate(photoList, currentIndex + 1); },
                }, m('i.fas.fa-chevron-right'))
              : null,
          ]),
        ]),

        // Footer: author + date only
        m('.photo-view-footer', [
          m('.photo-view-meta', [
            m('span', 'Posted by '),
            m('b', author),
            dateStr ? m('span', ` \u2022 ${dateStr}`) : null,
          ]),
        ]),
      ]);
    },
  };
}

/**
 * Open PhotoView — renders into a dedicated body-appended overlay.
 * No #modal-container dependency, guaranteed z-index 999999.
 */
function openPhotoModal(photoList, photoIndex) {
  const overlay = getPhotoOverlay();
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '999999',
    backgroundColor: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });
  m.render(overlay, m(PhotoViewModal, {
    photoList: photoList,
    photoIndex: photoIndex,
  }));
}

/**
 * BoardCard Component Factory
 */
function BoardCard() {
  return {
    view: (vnode) => {
      const { item, viewMode, onOpenComments, onOpenPhoto, forumId } = vnode.attrs;
      if (!item) return null;

      // Extract item properties with fallback defaults
      const title = item.title || item.mMsgName || (item.post && item.post.mMeta && item.post.mMeta.mMsgName) || 'Untitled Post';
      const notes = util.plainText(item.notes || item.mNotes || item.mBody || (item.post && (item.post.mNotes || item.post.mBody)) || '');
      const hasNotes = hasNotesText(notes);

      // Author & Date details
      const meta = (item.post && item.post.mMeta) ? item.post.mMeta : (item.mMeta || {});
      const author = meta.mAuthorId ? meta.mAuthorId.substring(0, 10) : (item.author || 'cluster');
      const publishTs = meta.mPublishTs ? meta.mPublishTs : item.created;
      const dateString = publishTs
        ? (typeof publishTs === 'object' && publishTs.xint64 ? new Date(publishTs.xint64 * 1000).toLocaleString() : new Date(publishTs * 1000).toLocaleString())
        : '';

      // RsPostedPost keeps calculated vote totals on the post, not mMeta.
      const post = item.post || item;
      const upVotes = numberValue(post.mUpVotes !== undefined ? post.mUpVotes : meta.mUpVotes);
      const downVotes = numberValue(post.mDownVotes !== undefined ? post.mDownVotes : meta.mDownVotes);
      const score = upVotes - downVotes;

      // Thumbnail resolution via extractImageSrc
      const thumbnailSrc = extractImageSrc(item);

      // Comment count
      const commentCount = item.commentCount !== undefined
        ? item.commentCount
        : item.mCommentCount !== undefined
        ? item.mCommentCount
        : item.mComments !== undefined
        ? item.mComments
        : (meta.mComments !== undefined
          ? meta.mComments
          : (meta.mChildCount !== undefined ? meta.mChildCount : 0));

      const msgId = item.msgId || item.mMsgId || (item.key ? item.key : null);

      return m(
        '.board-card',
        {
          class: `board-card board-card--${viewMode}`,
          tabindex: 0,
          role: 'article',
          'aria-label': title,
        },
        [
          // Image / Thumbnail Section (Clicking opens PhotoView modal!)
          m(
            '.board-card__image-container',
            {
              title: thumbnailSrc ? 'Click to view photo' : 'View photo',
              style: 'cursor: pointer',
              onclick: (e) => {
                e.stopPropagation();
                if (onOpenPhoto) {
                  onOpenPhoto(item);
                }
              },
            },
            [
              thumbnailSrc
                ? m('img.board-card__image', {
                    src: thumbnailSrc,
                    alt: title,
                    loading: 'lazy',
                    onerror: (e) => {
                      e.target.style.display = 'none';
                      if (e.target.nextSibling) {
                        e.target.nextSibling.style.display = 'flex';
                      }
                    },
                  })
                : null,
              m(
                '.board-card__placeholder-wrapper',
                { style: { display: thumbnailSrc ? 'none' : 'flex' } },
                m(FallbackImage)
              ),
            ]
          ),

          // Card Content Body
          m('.board-card__content', [
            // Title (blue link matching Qt GUI)
            m(
              'h4.board-card__title',
              {
                title: title,
                tabindex: 0,
                onclick: (e) => {
                  e.stopPropagation();
                  if (onOpenComments) {
                    onOpenComments(item, msgId, forumId);
                  }
                },
              },
              title
            ),

            // Metadata Line (Posted by <author> <date>)
            m('.board-card__meta', [
              m('span', 'Posted by '),
              m('b', author),
              dateString ? m('span', ` ${dateString}`) : null,
            ]),

            // Card Actions Line. Notes stay out of the card preview and open in a dedicated dialog.
            m('.board-card__footer', [
              hasNotes ? m(
                'button.board-card__notes-btn[type=button]',
                {
                  title: 'View notes',
                  onclick: (e) => {
                    e.stopPropagation();
                    util.popupmessage(m('.board-notes-dialog', [
                      m('h3', title),
                      m('p.board-notes-dialog__label', 'Notes'),
                      m('p.board-notes-dialog__content', notes),
                    ]));
                  },
                },
                [m('i.fas.fa-sticky-note'), m('span', 'View notes')]
              ) : null,
              m(
                'button.board-card__comments-btn',
                {
                  type: 'button',
                  'aria-label': `View ${commentCount} comments for ${title}`,
                  title: `Comments (${commentCount})`,
                  onclick: (e) => {
                    e.stopPropagation();
                    if (onOpenComments) {
                      onOpenComments(item, msgId, forumId);
                    } else if (msgId && forumId) {
                      m.route.set('/boards/:tab/:mGroupId/:mMsgId', {
                        tab: m.route.param().tab || 'Subscribed',
                        mGroupId: forumId,
                        mMsgId: msgId,
                      });
                    }
                  },
                },
                [
                  m('i.fas.fa-comment-alt.board-card__comments-icon'),
                  m('span.board-card__comments-label', commentCount > 0 ? `${commentCount} comment${commentCount === 1 ? '' : 's'}` : 'Comment'),
                ]
              ),
              m('.board-card__vote-pill', [
                m(
                  'button.board-card__vote-btn.board-card__vote-btn--up[type=button][title=Upvote]',
                  {
                    onclick: async (e) => {
                      e.stopPropagation();
                      if (forumId && msgId) {
                        const voted = await util.voteForPost(forumId, msgId, util.GXS_VOTE_UP);
                        if (voted) {
                          post.mUpVotes = numberValue(post.mUpVotes) + 1;
                          m.redraw();
                        }
                      }
                    },
                  },
                  [m('i.fas.fa-arrow-up')]
                ),
                m('span.board-card__vote-score', score),
                m(
                  'button.board-card__vote-btn.board-card__vote-btn--down[type=button][title=Downvote]',
                  {
                    onclick: async (e) => {
                      e.stopPropagation();
                      if (forumId && msgId) {
                        const voted = await util.voteForPost(forumId, msgId, util.GXS_VOTE_DOWN);
                        if (voted) {
                          post.mDownVotes = numberValue(post.mDownVotes) + 1;
                          m.redraw();
                        }
                      }
                    },
                  },
                  [m('i.fas.fa-arrow-down')]
                ),
              ]),
            ]),
          ]),
        ]
      );
    },
  };
}

/**
 * Toolbar Component Factory
 */
function Toolbar() {
  return {
    view: (vnode) => {
      const {
        viewMode,
        onViewModeChange,
        itemCount,
        searchString,
        onSearchInput,
        currentPage,
        totalPages,
        onPageChange,
        startItem,
        endItem,
      } = vnode.attrs;

      return m('.board-toolbar', { role: 'toolbar', 'aria-label': 'Board View Controls' }, [
        // Left section: Search Filter
        m('.board-toolbar__left', [
          onSearchInput
            ? m('.board-toolbar__search', [
                m('i.fas.fa-search.board-toolbar__search-icon'),
                m('input.board-toolbar__search-input[type=text][placeholder=Search...]', {
                  value: searchString || '',
                  oninput: (e) => onSearchInput(e.target.value),
                }),
              ])
            : null,
        ]),

        // Right section: View Switcher AND Pagination inline
        m('.board-toolbar__right', [
          // View Mode Switcher
          m('.board-toolbar__view-toggle', { role: 'radiogroup', 'aria-label': 'Display Mode' }, [
            m(
              'button.board-toolbar__toggle-btn',
              {
                type: 'button',
                class: viewMode === 'compact' ? 'board-toolbar__toggle-btn--active' : '',
                role: 'radio',
                'aria-checked': viewMode === 'compact',
                title: 'Switch to Compact View',
                onclick: () => onViewModeChange('compact'),
              },
              [
                m('i.fas.fa-bars'),
                m('span', 'Compact View'),
              ]
            ),
            m(
              'button.board-toolbar__toggle-btn',
              {
                type: 'button',
                class: viewMode === 'card' ? 'board-toolbar__toggle-btn--active' : '',
                role: 'radio',
                'aria-checked': viewMode === 'card',
                title: 'Switch to Card View',
                onclick: () => onViewModeChange('card'),
              },
              [
                m('i.fas.fa-th-large'),
                m('span', 'Card View'),
              ]
            ),
          ]),

          // Pagination Controls (< 1 - 25 >)
          itemCount > 0
            ? m('.board-pagination', { 'aria-label': 'Pagination Controls' }, [
                m(
                  'button.board-pagination__btn.board-pagination__btn--prev',
                  {
                    type: 'button',
                    title: 'Previous Page',
                    disabled: currentPage <= 1,
                    onclick: () => onPageChange(currentPage - 1),
                  },
                  m('i.fas.fa-chevron-left')
                ),
                m(
                  'span.board-pagination__label',
                  `${startItem} - ${endItem}`
                ),
                m(
                  'button.board-pagination__btn.board-pagination__btn--next',
                  {
                    type: 'button',
                    title: 'Next Page',
                    disabled: currentPage >= totalPages,
                    onclick: () => onPageChange(currentPage + 1),
                  },
                  m('i.fas.fa-chevron-right')
                ),
              ])
            : null,
        ]),
      ]);
    },
  };
}

/**
 * CommentsViewer Modal Trigger — navigates to the boards post detail route
 */
function openCommentsModal(item, msgId, forumId) {
  const tab = m.route.param().tab || 'Subscribed';
  m.route.set('/boards/:tab/:mGroupId/:mMsgId', {
    tab: tab,
    mGroupId: forumId,
    mMsgId: msgId,
  });
}

/**
 * Main BoardView Component Factory
 * Manages view mode (default: compact), search filtering, 25-item page pagination
 */
function BoardView() {
  let viewMode = 'compact';
  let filterText = '';
  let currentPage = 1;

  return {
    view: (vnode) => {
      const { items = [], forumId, onOpenComments } = vnode.attrs;

      // Filter items
      const filteredItems = items.filter((item) => {
        if (!filterText.trim()) return true;
        const query = filterText.toLowerCase();
        const title = (item.title || item.mMsgName || (item.post && item.post.mMeta && item.post.mMeta.mMsgName) || '').toLowerCase();
        const notes = (item.notes || item.mNotes || item.mBody || (item.post && (item.post.mNotes || item.post.mBody)) || '').toLowerCase();
        return title.includes(query) || notes.includes(query);
      });

      // Automatically sort posts by publish timestamp descending (newest posts on top)
      filteredItems.sort((a, b) => {
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

      // Pagination math (25 posts max per page)
      const totalFiltered = filteredItems.length;
      const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
      if (currentPage > totalPages) {
        currentPage = totalPages;
      }
      if (currentPage < 1) {
        currentPage = 1;
      }

      const startIndex = (currentPage - 1) * PAGE_SIZE;
      const endIndex = Math.min(startIndex + PAGE_SIZE, totalFiltered);
      const pagedItems = filteredItems.slice(startIndex, endIndex);

      const startItemNum = totalFiltered > 0 ? startIndex + 1 : 0;
      const endItemNum = endIndex;

      // Items with photos for PhotoView modal
      const photoItems = pagedItems.filter((item) => {
        return extractImageSrc(item) !== '';
      });

      const modalPhotos = photoItems.length > 0 ? photoItems : pagedItems;

      return m('.board-view-container', [
        // Top Toolbar with Pagination
        m(Toolbar, {
          key: 'toolbar-node',
          viewMode: viewMode,
          onViewModeChange: (newMode) => {
            viewMode = newMode;
            m.redraw();
          },
          itemCount: totalFiltered,
          searchString: filterText,
          onSearchInput: (text) => {
            filterText = text;
            currentPage = 1;
          },
          currentPage: currentPage,
          totalPages: totalPages,
          onPageChange: (newPage) => {
            currentPage = newPage;
            m.redraw();
          },
          startItem: startItemNum,
          endItem: endItemNum,
        }),

        // Board Grid (rendering paged slice of 25 items max)
        pagedItems.length > 0
          ? m(
              '.board-grid',
              {
                key: 'grid-node',
                class: `board-grid board-grid--${viewMode}`,
                role: 'region',
                'aria-label': 'Board items',
              },
              pagedItems.map((item, index) => {
                const itemKey = item.key || item.msgId || item.mMsgId || index;
                return m(BoardCard, {
                  key: `card-${itemKey}`,
                  item: item,
                  viewMode: viewMode,
                  forumId: forumId,
                  onOpenComments: onOpenComments || ((itemObj, mId, fId) => openCommentsModal(itemObj, mId, fId)),
                  onOpenPhoto: (clickedItem) => {
                    const photoIdx = modalPhotos.findIndex((pi) => {
                      const k1 = pi.key || pi.msgId || pi.mMsgId || (pi.post && pi.post.mMeta && pi.post.mMeta.mMsgId);
                      const k2 = clickedItem.key || clickedItem.msgId || clickedItem.mMsgId || (clickedItem.post && clickedItem.post.mMeta && clickedItem.post.mMeta.mMsgId);
                      return (k1 && k2 && k1 === k2) || pi === clickedItem;
                    });
                    openPhotoModal(modalPhotos, photoIdx >= 0 ? photoIdx : 0);
                  },
                });
              })
            )
          : m('.board-grid__empty', { key: 'empty-node' }, [
              m('i.fas.fa-inbox.board-grid__empty-icon'),
              m('p.board-grid__empty-title', 'No items found'),
              m('p.board-grid__empty-desc', filterText ? 'Try adjusting your search criteria.' : 'This board currently has no posts.'),
            ]),
      ]);
    },
  };
}

module.exports = {
  BoardView,
  BoardCard,
  Toolbar,
  PhotoViewModal,
  openPhotoModal,
  openCommentsModal,
  extractImageSrc,
  hasNotesText,
};
