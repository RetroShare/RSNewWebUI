const m = require('mithril');
const rs = require('rswebui');
const util = require('forums/forums_util');
const peopleUtil = require('people/people_util');
const chatEmoji = require('chat/chat_emoji');
const icon = require('icon');
const { loadPostContent, getTimestampValue, formatTimestamp } = require('./forums_util');
const toast = require('toast');
const widget = require('widgets');
const CIRCLE_PUBLIC = 1;
const CIRCLE_EXTERNAL = 2;

function createforum() {
  let title;
  let body;
  let identity;
  let circle = CIRCLE_PUBLIC;
  let circles = [];
  let selectedCircle;
  let enableModerators = false;
  let moderatorFilter = 'all';
  let moderatorSearch = '';
  const moderators = new Set();
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
    view: (vnode) => {
      const query = moderatorSearch.trim().toLowerCase();
      const identities = (rs.userList.users || [])
        .filter((item) => item && item.mGroupId)
        .filter((item) => moderatorFilter !== 'contacts' ||
          (rs.userList.userMap[item.mGroupId] && rs.userList.userMap[item.mGroupId].isContact))
        .filter((item) => !query || `${item.mGroupName} ${item.mGroupId}`.toLowerCase().includes(query))
        .sort((a, b) => (a.mGroupName || '').localeCompare(b.mGroupName || ''));
      return m('.widget.create-forum-form', [
        m('input.create-forum-form__title[type=text][placeholder=Forum title]', {
          oninput: (e) => (title = e.target.value),
        }),
        m('.create-forum-form__field', [
          m('label[for=forum-idtags]', 'Owner identity'),
          m('select.config-style-select[id=forum-idtags]', {
            value: identity,
            onchange: (e) => (identity = vnode.attrs.authorId[e.target.selectedIndex]),
          }, vnode.attrs.authorId && vnode.attrs.authorId.map((o) => m('option', { value: o },
            Number(o) === 0 ? 'No Signature' : `${rs.userList.username(o)} (${o.slice(0, 8)}...)`))),
        ]),
        m('.create-forum-form__field', [
          m('label[for=forum-distribution]', 'Message distribution'),
          m('select.config-style-select[id=forum-distribution]', {
            value: circle,
            onchange: (e) => (circle = e.target.value),
          }, [
            m('option', { value: CIRCLE_PUBLIC }, '\u{1F310}  Public'),
            m('option', { value: CIRCLE_EXTERNAL }, '\u25C9  Restricted to External Circle'),
          ]),
        ]),
        Number(circle) === CIRCLE_EXTERNAL && m('.create-forum-form__field', [
          m('label[for=forum-circle]', 'Circle'),
          m('select.config-style-select[id=forum-circle]', {
            value: selectedCircle && selectedCircle.mGroupId,
            onchange: (e) => (selectedCircle = circles.find((item) => item.mGroupId === e.target.value)),
          }, circles.length
            ? circles.map((item) => m('option', { value: item.mGroupId }, item.mGroupName))
            : m('option[disabled]', 'No circles available')),
        ]),
        m('.create-forum-form__moderators', [
          m('.create-forum-form__moderators-heading', [
            m('label.create-forum-form__moderators-toggle', [
              m('input[type=checkbox]', {
                checked: enableModerators,
                onchange: (e) => {
                  enableModerators = e.target.checked;
                  if (!enableModerators) {
                    moderators.clear();
                  }
                },
              }),
              m('span', 'Add moderators'),
            ]),
            enableModerators && m('span', `${moderators.size} selected`),
          ]),
          enableModerators && m('.create-forum-form__moderator-controls', [
            m('select.config-style-select[id=forum-moderator-filter]', {
              value: moderatorFilter,
              onchange: (e) => {
                moderatorFilter = e.target.value;
              },
            }, [
              m('option[value=all]', 'All identities'),
              m('option[value=contacts]', 'My contacts'),
            ]),
            m(widget.SearchField, {
              id: 'forum-moderator-search',
              placeholder: 'Search identities',
              value: moderatorSearch,
              oninput: (e) => (moderatorSearch = e.target.value),
              onclear: () => (moderatorSearch = ''),
            }),
            m('.create-forum-form__moderator-list', identities.length
              ? identities.map((item) => m('label.create-forum-form__moderator', [
              m('input[type=checkbox]', {
                checked: moderators.has(item.mGroupId),
                onchange: (e) => e.target.checked
                  ? moderators.add(item.mGroupId)
                  : moderators.delete(item.mGroupId),
              }),
              m(peopleUtil.UserAvatar, {
                firstLetter: (item.mGroupName || '?').slice(0, 1).toUpperCase(),
                identityId: item.mGroupId,
                size: 30,
                isSquare: true,
              }),
              m('span', [
                m('b', item.mGroupName || 'Unnamed identity'),
                m('small', item.mGroupId),
              ]),
              ]))
              : m('.create-forum-form__empty', query ? 'No matching identities' : 'No identities available')),
          ]),
        ]),
        m('textarea.create-forum-form__description[rows=5][placeholder=Describe your forum]', {
          oninput: (e) => (body = e.target.value),
          value: body,
        }),
        m('button.create-forum-form__submit.is-primary',
          {
            onclick: async () => {
              const res = await rs.rsJsonApiRequest('/rsgxsforums/createForumV2', {
                name: title,
                description: body,
                ...(Number(identity) !== 0 && { authorId: identity }),
                moderatorsIds: enableModerators ? Array.from(moderators) : [],
                circleType: Number(circle),
                ...(Number(circle) === CIRCLE_EXTERNAL && selectedCircle && { circleId: selectedCircle.mGroupId }),
              });
              if (res.body.retval === false) {
                toast.error(res.body.errorMessage);
                return;
              }
              widget.closePopupMessage();
              toast.success('Forum created successfully');
              await util.updatedisplayforums(res.body.forumId);
              if (vnode.attrs.onCreated) await vnode.attrs.onCreated();
              m.redraw();
            },
          }, [icon('plus'), 'Create']),
      ]);
    },
  };
}
const AddThread = () => {
  const MAX_GXS_MESSAGE_SIZE = 199000;
  let title = '';
  let body = '';
  let identity;
  let showEmojiPicker = false;
  let showFilePanel = false;
  let isFullscreen = false;
  let filePath = '';
  let filePathNeedsPrefix = false;
  let fileHashing = false;
  let fileError = '';
  let closed = false;
  const attachments = [];
  const inlineImages = [];

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const pollFileHash = (localpath, attempt = 0) => {
    if (closed) return;
    rs.rsJsonApiRequest('/rsFiles/ExtraFileStatus', { localpath }, (data) => {
      if (closed) return;
      const info = data && data.retval && data.info;
      if (info && info.hash && info.hash !== '0000000000000000000000000000000000000000') {
        const size = Number(info.size && (info.size.xint64 || info.size.xstr64 || info.size)) || 0;
        if (!attachments.some((file) => file.hash === info.hash)) {
          attachments.push({ name: info.name, size, hash: info.hash });
        }
        fileHashing = false;
        filePath = '';
        showFilePanel = false;
        fileError = '';
        m.redraw();
      } else if (fileHashing && attempt < 120) {
        setTimeout(() => pollFileHash(localpath, attempt + 1), 500);
      } else {
        fileHashing = false;
        fileError = 'RetroShare could not hash this file. Check the full local path.';
        m.redraw();
      }
    });
  };

  const attachFile = () => {
    const localpath = filePath.trim();
    if (!localpath || filePathNeedsPrefix || fileHashing) return;
    fileHashing = true;
    fileError = '';
    rs.rsJsonApiRequest('/rsFiles/ExtraFileHash', {
      localpath,
      period: 86400 * 7,
      flags: 0,
    }, (data, success) => {
      if (success && data && data.retval) {
        pollFileHash(localpath);
      } else {
        fileHashing = false;
        fileError = 'Failed to start file hashing. Check the full local path.';
        m.redraw();
      }
    });
  };

  const addInlineImages = (files) => {
    Array.from(files || []).forEach((file) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);
      image.onload = () => {
        let width = image.naturalWidth;
        let height = image.naturalHeight;
        const scale = Math.min(1, 640 / width, 480 / height);
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        let quality = .84;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 175000 && (quality > .35 || width > 160 || height > 120)) {
          if (quality > .35) {
            quality = Math.max(.35, quality - .08);
          } else {
            width = Math.max(160, Math.round(width * .82));
            height = Math.max(120, Math.round(height * .82));
            canvas.width = width;
            canvas.height = height;
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, width, height);
            context.drawImage(image, 0, 0, width, height);
          }
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        inlineImages.push({ name: file.name, dataUrl });
        URL.revokeObjectURL(objectUrl);
        m.redraw();
      };
      image.onerror = () => URL.revokeObjectURL(objectUrl);
      image.src = objectUrl;
    });
  };

  //  The GXS limit is expressed in bytes, not in JS characters: an accent is two
  //  bytes and an emoji four, while both count as one or two units of .length.
  //  With an emoji picker one click away, counting characters lets the composer
  //  accept a message the core then rejects.
  const byteLength = (value) => new TextEncoder().encode(value).length;

  const postBody = () => {
    const message = escapeHtml(body).replace(/\r?\n/g, '<br>');
    const images = inlineImages.map((file) =>
      `<p><img src="${file.dataUrl}" alt="${escapeHtml(file.name)}" style="max-width:100%;height:auto;border-radius:6px;"></p>`
    ).join('');
    const embedded = attachments.map((file) =>
      `<p><a href="retroshare://file?name=${encodeURIComponent(file.name)}&amp;size=${file.size}&amp;hash=${file.hash}">&#128206; ${escapeHtml(file.name)}</a> (${formatSize(file.size)})</p>`
    ).join('');
    return `${message}${images}${embedded}`;
  };

  const insertEmoji = (emoji) => {
    body += emoji;
    showEmojiPicker = false;
  };

  return {
    oninit: (vnode) => {
      if (vnode.attrs.authorId) {
        identity = vnode.attrs.authorId[0];
      }
    },
    onremove: () => {
      //  pollFileHash re-arms itself every 500 ms for up to a minute. Closing
      //  the composer has to stop it, or it keeps hashing and redrawing against
      //  a component that is no longer on screen.
      closed = true;
    },
    view: (vnode) => {
      //  Built once per pass: postBody() re-escapes the message and re-joins
      //  every base64 image, and it was called five times per render, on every
      //  global redraw, while the user types.
      const mBody = postBody();
      const bodySize = byteLength(mBody);

      return m('.widget.forum-thread-composer', [
        m('button.forum-thread-composer__fullscreen.is-glyph[type=button]', {
          title: isFullscreen ? 'Restore default size' : 'Fullscreen',
          'aria-label': isFullscreen ? 'Restore default size' : 'Fullscreen',
          onclick: (e) => {
            isFullscreen = !isFullscreen;
            const modal = e.currentTarget.closest('.modal-content');
            if (modal) modal.classList.toggle('is-fullscreen', isFullscreen);
          },
        }, icon(isFullscreen ? 'compress' : 'expand')),
        (vnode.attrs.parent_thread !== '') > 0
          ? m('.forum-thread-composer__reply', [m('b', 'Replying to: '), vnode.attrs.parent_thread])
          : '',
        m('input.forum-thread-composer__title[type=text][placeholder=Thread title]', {
          value: title,
          oninput: (e) => (title = e.target.value),
        }),
        m('.forum-thread-composer__field', [
          m('label[for=forum-thread-identity]', 'Publishing identity'),
          m('select.config-style-select[id=forum-thread-identity]', {
            value: identity,
            onchange: (e) => {
              identity = vnode.attrs.authorId[e.target.selectedIndex];
            },
          }, vnode.attrs.authorId && vnode.attrs.authorId.map((o) => m(
            'option',
            { value: o },
            Number(o) === 0 ? 'No Signature' : `${rs.userList.username(o)} (${o.slice(0, 8)}...)`
          ))),
        ]),
        m('.forum-thread-composer__editor', [
          m('textarea[rows=8][placeholder=Write your message...]', {
          oninput: (e) => (body = e.target.value),
          value: body,
          }),
          m('.forum-thread-composer__toolbar', [
            m('input[type=file][id=forum-thread-files]', {
              onchange: (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) {
                  const fullPath = file.path;
                  const hasFullPath = fullPath && (fullPath.includes('/') || fullPath.includes('\\')) && fullPath !== file.name;
                  filePath = hasFullPath ? fullPath : file.name;
                  filePathNeedsPrefix = !hasFullPath;
                  showFilePanel = true;
                  fileError = '';
                }
                e.target.value = '';
              },
            }),
            m('input[type=file][id=forum-thread-images][accept=image/*][multiple]', {
              onchange: (e) => {
                addInlineImages(e.target.files);
                e.target.value = '';
              },
            }),
            m('button.forum-thread-composer__tool[type=button][title=Attach file][aria-label=Attach file]', {
              class: showFilePanel ? 'active' : '',
              onclick: () => (showFilePanel = !showFilePanel),
            }, icon('paperclip')),
            m('label.forum-thread-composer__tool[for=forum-thread-images][title=Attach images][aria-label=Attach images]',
              icon('image')
            ),
            //  The shared picker. This composer had its own category row and
            //  grid, with no search at all.
            m('.forum-thread-composer__emoji', [
              m('button.forum-thread-composer__tool[type=button][title=Insert emoji][aria-label=Insert emoji]', {
                class: showEmojiPicker ? 'active' : '',
                'aria-pressed': String(showEmojiPicker),
                onclick: (e) => {
                  e.stopPropagation();
                  showEmojiPicker = !showEmojiPicker;
                },
              }, icon('smile')),
              showEmojiPicker && m(chatEmoji.EmojiPicker, {
                onSelect: insertEmoji,
                onClose: () => { showEmojiPicker = false; },
              }),
            ]),
          ]),
          showFilePanel && m('.forum-thread-composer__file-panel', [
            m('div', [
              m('input[type=text][placeholder=Full local path to file]', {
                value: filePath,
                disabled: fileHashing,
                oninput: (e) => {
                  filePath = e.target.value;
                  filePathNeedsPrefix = false;
                  fileError = '';
                },
              }),
              m('label[for=forum-thread-files][title=Browse for file]', icon('folder-open')),
              m('button[type=button]', {
                disabled: fileHashing || !filePath.trim() || filePathNeedsPrefix,
                onclick: attachFile,
              }, fileHashing ? [icon('spinner', { spin: true }), ' Hashing...'] : 'Attach'),
            ]),
            filePathNeedsPrefix && m('small', [
              'The browser only returned the filename. Add its complete folder path before attaching.',
            ]),
            fileError && m('small.error-text', fileError),
          ]),
          inlineImages.length > 0 && m('.forum-thread-composer__inline-images',
            inlineImages.map((file, index) => m('.forum-thread-composer__inline-image', [
              m('img', { src: file.dataUrl, alt: file.name }),
              m('button.is-icon[type=button][title=Remove inline image][aria-label=Remove inline image]', {
                onclick: () => inlineImages.splice(index, 1),
              }, icon('times')),
            ]))
          ),
        ]),
        attachments.length > 0 && m('.forum-thread-composer__attachments', [
          m('.forum-thread-composer__attachments-heading', [
            icon('paperclip'),
            m('span', `${attachments.length} attachment${attachments.length === 1 ? '' : 's'}`),
          ]),
          m('.forum-thread-composer__attachment-list', attachments.map((file, index) =>
            m('.forum-thread-composer__attachment', [
              icon('file-alt'),
              m('span', [m('b', file.name), m('small', formatSize(file.size))]),
              m('button.is-icon[type=button][title=Remove attachment][aria-label=Remove attachment]', {
                onclick: () => attachments.splice(index, 1),
              }, icon('times')),
            ])
          )),
        ]),
        m('.forum-thread-composer__capacity', {
          class: bodySize > MAX_GXS_MESSAGE_SIZE ? 'is-over-limit' : '',
        }, bodySize > MAX_GXS_MESSAGE_SIZE
          ? `Message is ${bodySize - MAX_GXS_MESSAGE_SIZE} bytes too large.`
          : `${MAX_GXS_MESSAGE_SIZE - bodySize} bytes remaining after HTML conversion.`
        ),
        m('.forum-thread-composer__actions', m(
          'button[type=button]',
          {
            disabled: fileHashing || bodySize > MAX_GXS_MESSAGE_SIZE,
            onclick: async () => {
              if (!title.trim() || (!body.trim() && attachments.length === 0 && inlineImages.length === 0)) return;
              //  Rebuilt here rather than reused from the render: what is sent
              //  must be what the fields hold at the click, not what they held
              //  when the button was last drawn.
              const mBody = postBody();
              if (byteLength(mBody) > MAX_GXS_MESSAGE_SIZE) return;
              const res =
                (vnode.attrs.parent_thread !== '') > 0 // is it a reply or a new thread
                  ? await rs.rsJsonApiRequest('/rsgxsforums/createPost', {
                    forumId: vnode.attrs.forumId,
                    mBody,
                    title,
                    authorId: identity,
                    parentId: vnode.attrs.parentId,
                  })
                  : await rs.rsJsonApiRequest('/rsgxsforums/createPost', {
                    forumId: vnode.attrs.forumId,
                    mBody,
                    title,
                    authorId: identity,
                  });

              if (res.body.retval === false) {
                toast.error(res.body.errorMessage);
                return;
              }
              widget.closePopupMessage();
              toast.success(vnode.attrs.parent_thread !== ''
                ? 'Reply added successfully'
                : 'Thread added successfully');
              util.updatedisplayforums(vnode.attrs.forumId);
              m.redraw();
            },
          },
          (vnode.attrs.parent_thread !== '') > 0 ? 'Add Reply' : 'Create Thread'
        )),
      ]);
    },
  };
};

// getTimestampValue and formatTimestamp are imported from forums_util.js

//  rsgxsflags.h. Only the two the desktop client reports are named here.
const SIGN_AUTHOR_GPG = 0x00000100;
const SIGN_AUTHOR_GPG_KNOWN = 0x00001000;

//  rsgxscircles.h:50
const CIRCLE_LOCAL = 4;
const CIRCLE_NODES_GROUP = 3;

function antiSpamLabel(signFlags) {
  if (signFlags & SIGN_AUTHOR_GPG_KNOWN) {
    return 'Anonymous/unknown posts forwarded if reputation is positive';
  }
  if (signFlags & SIGN_AUTHOR_GPG) {
    return 'Anonymous posts forwarded if reputation is positive';
  }
  return '';
}

function distributionLabel(circleType, circleId) {
  switch (Number(circleType)) {
    case CIRCLE_PUBLIC: return 'Public';
    case CIRCLE_EXTERNAL: return `Restricted to circle ${circleId || ''}`.trim();
    case CIRCLE_NODES_GROUP: return 'Only friend nodes in a group';
    case CIRCLE_LOCAL: return 'Your eyes only';
    default: return 'Unknown';
  }
}

//  The core answers in seconds; the desktop client reports both in days.
function durationLabel(seconds) {
  if (!seconds) return 'Unlimited';
  const days = Math.round(seconds / 86400);
  if (days >= 365) {
    const years = Math.round(days / 365);
    return `${years} year${years === 1 ? '' : 's'}`;
  }
  if (days >= 30) {
    const months = Math.round(days / 30);
    return `${months} month${months === 1 ? '' : 's'}`;
  }
  return `${days} day${days === 1 ? '' : 's'}`;
}

/**
 * Everything the core knows about the forum, in a dropdown off the Details
 * button. There is not enough of it to earn a page or a pane.
 */
const ForumDetails = () => ({
  view: (v) => {
    const d = v.attrs.details || {};
    const owner = Number(d.author) === 0 || !d.author
      ? 'Nobody'
      : rs.userList.username(d.author);
    const antiSpam = antiSpamLabel(d.signFlags);
    const fields = [
      ['Description', d.description || 'None'],
      ['Subscribers', d.subscribers ?? 0],
      ['Posts at neighbour nodes', d.visibleMsgCount ?? 0],
      ['Last post', getTimestampValue(d.activity) ? formatTimestamp(d.activity) : 'Never'],
      ['Created', formatTimestamp(d.created)],
      d.isSubscribed && ['Synchronization', durationLabel(d.syncPeriod)],
      d.isSubscribed && ['Storage', durationLabel(d.storagePeriod)],
      ['Distribution', distributionLabel(d.circleType, d.circleId)],
      ['Owner', owner],
      antiSpam && ['Anti-spam', antiSpam],
    ].filter(Boolean);

    return m('details.forum-details', {
      onkeydown: (event) => {
        if (event.key !== 'Escape') return;
        event.currentTarget.open = false;
        event.currentTarget.querySelector('summary').focus();
      },
      onfocusout: (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
      },
    }, [
      m('summary.forum-details__toggle[title=Forum details][aria-label=Forum details]',
        [icon('info-circle'), m('span.btn-text', 'Details')]),
      m('.forum-details__panel', [
        m('h4.forum-details__name', d.name || 'Forum'),
        m('dl.forum-details__fields', fields.map(([label, value]) =>
          m('div.forum-details__field', [m('dt', label), m('dd', value)])
        )),
      ]),
    ]);
  },
});

/**
 * The lower half of the split: the post currently selected in the table above.
 *
 * attrs:
 *   forumId, msgId  which post to show
 *   ownId           identities that may reply
 *   rows            the visible rows, for the previous/next arrows
 */
const ThreadReader = () => ({
  view: (v) => {
    const { forumId, msgId, ownId, rows } = v.attrs;
    const struct = util.Data.Threads[forumId] && util.Data.Threads[forumId][msgId];
    if (!struct) return m('.forum-reader', m('p.forum-reader__empty', 'Loading...'));

    const meta = struct.thread.mMeta;
    const unread = util.isUnread(meta.mMsgStatus);
    const at = rows.findIndex((row) => row.meta.mOrigMsgId === msgId);
    const open = (row) => row && m.route.set('/forums/:tab/:mGroupId/:mMsgId', {
      tab: m.route.param().tab,
      mGroupId: forumId,
      mMsgId: row.meta.mOrigMsgId,
    });
    const nextUnread = rows
      .slice(at + 1)
      .find((row) => util.isUnread(row.meta.mMsgStatus));

    return m('.forum-reader', [
      m('.forum-reader__bar', [
        m('.forum-reader__nav', [
          m('button.is-glyph[type=button][title=Previous post][aria-label=Previous post]', {
            disabled: at <= 0,
            onclick: () => open(rows[at - 1]),
          }, icon('arrow-up')),
          m('button.is-glyph[type=button][title=Next post][aria-label=Next post]', {
            disabled: at < 0 || at >= rows.length - 1,
            onclick: () => open(rows[at + 1]),
          }, icon('arrow-down')),
          m('button.is-glyph[type=button][title=Next unread][aria-label=Next unread]', {
            disabled: !nextUnread,
            onclick: () => open(nextUnread),
          }, icon('envelope')),
        ]),
        m('span.forum-reader__date', formatTimestamp(meta.mPublishTs)),
        m('span.forum-reader__author', ['by ', rs.userList.username(meta.mAuthorId)]),
        m('.forum-reader__actions', [
          m('button[type=button]', {
            onclick: () => util.popupmessage(m(AddThread, {
              parent_thread: meta.mMsgName,
              forumId,
              authorId: ownId,
              parentId: msgId,
            }), 'create-forum-thread-modal', {
              title: 'Add Reply',
              lead: 'Write a reply and optionally include images or files.',
            }),
          }, [icon('reply'), m('span.btn-text', 'Reply')]),
          m('button[type=button]', {
            onclick: async () => {
              const res = await rs.rsJsonApiRequest('/rsgxsforums/markRead', {
                messageId: { first: forumId, second: meta.mOrigMsgId },
                read: !unread,
              });
              if (res.body.retval) {
                util.updatedisplayforums(forumId);
                m.redraw();
              }
            },
          }, [icon('envelope-open'), m('span.btn-text', unread ? 'Mark Read' : 'Mark Unread')]),
        ]),
      ]),
      m('h4.forum-reader__title', meta.mMsgName),
      m('.forum-reader__body.forum-post-content', [
        struct.thread.mMsg !== null
          ? m.trust(struct.thread.mMsg)
          : (loadPostContent(forumId, msgId), m('p', 'Loading content...')),
      ]),
    ]);
  },
});

//  Data.Threads holds every post flat, replies included. Only
//  Data.ParentThreads holds the real thread starts.
const replyList = (struct) => Object.values(struct.replies || {});

const subtreeUnread = (struct) =>
  (util.isUnread(struct.thread.mMeta.mMsgStatus) ? 1 : 0) +
  replyList(struct).reduce((total, reply) => total + subtreeUnread(reply), 0);

const subtreeMatches = (struct, query) =>
  (struct.thread.mMeta.mMsgName || '').toLowerCase().includes(query) ||
  replyList(struct).some((reply) => subtreeMatches(reply, query));

const ForumView = () => {
  let ownId = '';
  let threadSearch = '';
  //  Threads start closed. Only what you open is in here.
  const expanded = new Set();
  return {
    oninit: (v) => {
      util.updatedisplayforums(v.attrs.id);
      peopleUtil.ownIds((data) => {
        ownId = data;
        for (let i = 0; i < ownId.length; i++) {
          if (Number(ownId[i]) === 0) {
            ownId.splice(i, 1);
          }
        }
      });
    },
    view: (v) => {
      const forumDetails = util.Data.DisplayForums[v.attrs.id] || {
        name: 'Loading...',
        isSubscribed: false,
        created: {},
        activity: {},
        author: '0',
        description: 'Loading...',
      };
      const posts = util.Data.Threads[v.attrs.id] || {};
      const roots = Object.values(util.Data.ParentThreads[v.attrs.id] || {})
        .map((meta) => posts[meta.mMsgId])
        .filter(Boolean);
      const fname = forumDetails.name;
      const fsubscribed = forumDetails.isSubscribed;

      const toggleSubscription = async () => {
        const res = await rs.rsJsonApiRequest('/rsgxsforums/subscribeToForum', {
          forumId: v.attrs.id,
          subscribe: !fsubscribed,
        });
        if (res.body.retval) {
          util.Data.DisplayForums[v.attrs.id].isSubscribed = !fsubscribed;
          if (v.attrs.onSubscriptionChange) await v.attrs.onSubscriptionChange();
          m.redraw();
        }
      };

      const query = threadSearch.trim().toLowerCase();
      //  A post opened from a link may sit inside a closed thread, so open its
      //  parents first or the row it points at is not on screen.
      if (v.attrs.msgId && posts[v.attrs.msgId]) {
        let parent = posts[v.attrs.msgId].thread.mMeta.mParentId;
        while (parent && posts[parent]) {
          expanded.add(parent);
          parent = posts[parent].thread.mMeta.mParentId;
        }
      }

      //  A table cannot nest rows, so each row carries its own depth.
      const rows = [];
      const collect = (struct, depth) => {
        const meta = struct.thread.mMeta;
        const replies = replyList(struct).sort(
          (a, b) =>
            getTimestampValue(a.thread.mMeta.mPublishTs) -
            getTimestampValue(b.thread.mMeta.mPublishTs)
        );
        //  A search that hides its own matches is useless, so searching opens
        //  every thread.
        const open = Boolean(query) || expanded.has(meta.mMsgId);
        rows.push({
          meta,
          depth,
          replies: replies.length,
          unread: subtreeUnread(struct),
          open,
        });
        if (replies.length && open) {
          replies.forEach((reply) => collect(reply, depth + 1));
        }
      };
      roots
        .filter((struct) => !query || subtreeMatches(struct, query))
        .sort(
          (a, b) =>
            (b.thread.mMeta.mMostRecentTsInThread || 0) -
            (a.thread.mMeta.mMostRecentTsInThread || 0)
        )
        .forEach((struct) => collect(struct, 0));

      const openThread = (row) => m.route.set('/forums/:tab/:mGroupId/:mMsgId', {
        tab: m.route.param().tab,
        mGroupId: v.attrs.id,
        mMsgId: row.meta.mOrigMsgId,
      });

      return [
        m(widget.PageHead, {
          class: 'forum-detail-head',
          //  With a post open, back closes it. Without one, it leaves the
          //  forum. On a phone that is the only way out of the reader.
          back: {
            label: v.attrs.msgId ? 'Back to threads' : 'Back to forums',
            onclick: () => (v.attrs.msgId
              ? m.route.set('/forums/:tab/:mGroupId', {
                tab: m.route.param().tab || 'Subscribed',
                mGroupId: v.attrs.id,
              })
              : m.route.set('/forums/:tab', {
                tab: m.route.param().tab || 'Subscribed',
              })),
          },
          title: fname,
          lead: forumDetails.description || 'No description',
          actions: [
            fsubscribed && m(
              'button.forum-mobile-create[type=button][title=New Thread][aria-label=New Thread]',
              {
                onclick: () => {
                  util.popupmessage(
                    m(AddThread, {
                      parent_thread: '',
                      forumId: v.attrs.id,
                      authorId: ownId,
                      parentId: '',
                    }),
                    'create-forum-thread-modal',
                    {
                      title: 'Create New Thread',
                      lead: 'Start a discussion and optionally include images or files.',
                    }
                  );
                },
              },
              icon('pencil-alt')
            ),
            m(ForumDetails, { details: forumDetails }),
            m('button.forum-subscription-button.is-primary',
              {
                class: fsubscribed ? 'forum-subscription--subscribed' : '',
                onclick: toggleSubscription,
              }, [icon('bookmark'), fsubscribed ? 'Subscribed' : 'Subscribe']),
            m(widget.Menu, {
              class: 'forum-mobile-actions',
              mark: 'ellipsis-v',
              title: 'Forum actions',
              items: [{
                label: fsubscribed ? 'Unsubscribe' : 'Subscribe',
                icon: 'bookmark',
                danger: fsubscribed,
                onclick: toggleSubscription,
              }],
            }),
          ],
        }),
        m(
          'threaddetails.forum-threads',
          {
            style: 'display:' + (fsubscribed ? 'flex' : 'none'),
          },
          m('.forum-threads__heading', [
            m(widget.SearchField, {
              class: 'forum-threads__search',
              placeholder: 'Search threads',
              value: threadSearch,
              oninput: (e) => {
                threadSearch = e.target.value;
              },
              onclear: () => (threadSearch = ''),
            }),
            m(
              'button.forum-threads__create.is-primary[type=button][title=New Thread][aria-label=New Thread]',
              {
                onclick: () => {
                  util.popupmessage(
                    m(AddThread, {
                      parent_thread: '',
                      forumId: v.attrs.id,
                      authorId: ownId,
                      parentId: '',
                    }),
                    'create-forum-thread-modal',
                    {
                      title: 'Create New Thread',
                      lead: 'Start a discussion and optionally include images or files.',
                    }
                  );
                },
              },
              [icon('pencil-alt'), m('span', 'New Thread')]
            ),
          ]),
          m('.threads-scroll', m(util.ThreadsTable, [
            m('thead', m('tr.forum-thread-head', [
              m('th.forum-thread-row__cell', 'Threads'),
              m('th.forum-thread-row__unread', 'Unread'),
              m('th.forum-thread-row__date', 'Date'),
              m('th.forum-thread-row__author', 'Author'),
            ])),
            m(
              'tbody',
              rows.length === 0
                ? m('tr', m('td.forum-threads__empty[colspan=4]',
                  query ? 'No threads matching search.' : 'No threads in this forum yet.'))
                : rows.map((row) =>
                  m(
                    'tr.forum-thread-row',
                    {
                      key: row.meta.mMsgId,
                      class: [
                        util.isUnread(row.meta.mMsgStatus)
                          ? 'forum-thread-row--unread' : '',
                        row.meta.mOrigMsgId === v.attrs.msgId
                          ? 'forum-thread-row--selected' : '',
                      ].filter(Boolean).join(' '),
                      onclick: () => openThread(row),
                    },
                    [
                      //  The flex box is inside the cell, not the cell itself:
                      //  a flex `td` drops out of the table's columns and the
                      //  header stops lining up with the rows.
                      //
                      //  Depth is a variable, not a padding -- inline padding
                      //  would beat the phone media query.
                      m('td.forum-thread-row__cell',
                        m('.forum-thread-row__inner', { style: `--depth:${row.depth}` }, [
                          row.replies
                            ? m('button.forum-thread-row__toggle[type=button]', {
                              title: row.open ? 'Collapse replies' : 'Expand replies',
                              'aria-label': row.open ? 'Collapse replies' : 'Expand replies',
                              'aria-expanded': String(row.open),
                              onclick: (e) => {
                                e.stopPropagation();
                                if (row.open) expanded.delete(row.meta.mMsgId);
                                else expanded.add(row.meta.mMsgId);
                              },
                            }, icon(row.open ? 'chevron-down' : 'chevron-right'))
                            : m('span.forum-thread-row__toggle-spacer'),
                          m('button.forum-thread-row__title[type=button]', {
                            'aria-current': row.meta.mOrigMsgId === v.attrs.msgId
                              ? 'page' : undefined,
                            onclick: (e) => {
                              e.stopPropagation();
                              openThread(row);
                            },
                          }, row.meta.mMsgName || 'No subject'),
                          !row.open && row.replies
                            ? m('span.forum-thread-row__replies',
                              `${row.replies} ${row.replies === 1 ? 'reply' : 'replies'}`)
                            : '',
                        ])),
                      m('td.forum-thread-row__unread',
                        row.unread > 0 ? m('span.forum-thread-row__badge', row.unread) : ''),
                      m('td.forum-thread-row__date', formatTimestamp(row.meta.mPublishTs)),
                      m('td.forum-thread-row__author', m('.forum-thread-row__by', [
                        m(peopleUtil.UserAvatar, {
                          firstLetter: rs.userList.username(row.meta.mAuthorId)
                            .slice(0, 1).toUpperCase(),
                          identityId: row.meta.mAuthorId,
                          size: 20,
                          isSquare: true,
                        }),
                        m('span', rs.userList.username(row.meta.mAuthorId)),
                      ])),
                    ]
                  )
                )
            ),
          ])),
          v.attrs.msgId && m(ThreadReader, {
            forumId: v.attrs.id,
            msgId: v.attrs.msgId,
            ownId,
            rows,
          })
        ),
      ];
    },
  };
};

module.exports = {
  ForumView,
  createforum,
};
