const m = require('mithril');
const rs = require('rswebui');
const util = require('forums/forums_util');
const peopleUtil = require('people/people_util');
const chatEmoji = require('chat/chat_emoji');
const { loadPostContent, getTimestampValue, formatTimestamp } = require('./forums_util');
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
        m('.create-forum-form__heading', [
          m('h3', 'Create Forum'),
          m('p', 'Set up the forum and choose its publishing permissions.'),
        ]),
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
            m('.create-forum-form__search', [
              m('i.fas.fa-search'),
              m('input[id=forum-moderator-search][type=search][placeholder=Search identities]', {
                value: moderatorSearch,
                oninput: (e) => (moderatorSearch = e.target.value),
              }),
            ]),
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
        m('button.create-forum-form__submit',
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
              if (res.body.retval) {
                await util.updatedisplayforums(res.body.forumId);
                if (vnode.attrs.onCreated) await vnode.attrs.onCreated();
                m.redraw();
              }
              res.body.retval === false
                ? util.popupmessage([m('h3', 'Error'), m('hr'), m('p', res.body.errorMessage)])
                : util.popupmessage([
                  m('h3', 'Success'),
                  m('hr'),
                  m('p', 'Forum created successfully'),
                ]);
            },
          },
          'Create'
        ),
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
  let emojiCategory = 'Smileys';
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
        m('.forum-thread-composer__heading', [
          m('.forum-thread-composer__heading-copy', [
            m('h3', (vnode.attrs.parent_thread !== '') > 0 ? 'Add Reply' : 'Create New Thread'),
            m('p', (vnode.attrs.parent_thread !== '') > 0
              ? 'Write a reply and optionally include images or files.'
              : 'Start a discussion and optionally include images or files.'),
          ]),
          m('button.forum-thread-composer__fullscreen[type=button]', {
            title: isFullscreen ? 'Restore default size' : 'Fullscreen',
            'aria-label': isFullscreen ? 'Restore default size' : 'Fullscreen',
            onclick: (e) => {
              isFullscreen = !isFullscreen;
              const modal = e.currentTarget.closest('.modal-content');
              if (modal) modal.classList.toggle('is-fullscreen', isFullscreen);
            },
          }, m(`i.fas.${isFullscreen ? 'fa-compress' : 'fa-expand'}`)),
        ]),
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
            }, m('i.fas.fa-paperclip')),
            m('button.forum-thread-composer__tool[type=button][title=Insert emoji][aria-label=Insert emoji]', {
              class: showEmojiPicker ? 'active' : '',
              onclick: () => (showEmojiPicker = !showEmojiPicker),
            }, m('i.fas.fa-smile')),
            m('label.forum-thread-composer__tool[for=forum-thread-images][title=Attach images][aria-label=Attach images]',
              m('i.fas.fa-image')
            ),
            showEmojiPicker && m('.forum-thread-composer__emoji-picker', [
              m('.forum-thread-composer__emoji-categories', chatEmoji.EMOJI_CATEGORIES.map((category) =>
                m('button[type=button]', {
                  class: category === emojiCategory ? 'active' : '',
                  title: category,
                  onclick: () => (emojiCategory = category),
                }, chatEmoji.EMOJI_ICONS[category])
              )),
              m('.forum-thread-composer__emoji-grid',
                (chatEmoji.EMOJI_DATA[emojiCategory] || []).map((emoji) =>
                  m('button[type=button]', { onclick: () => insertEmoji(emoji) }, emoji)
                )
              ),
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
              m('label[for=forum-thread-files][title=Browse for file]', m('i.fas.fa-folder-open')),
              m('button[type=button]', {
                disabled: fileHashing || !filePath.trim() || filePathNeedsPrefix,
                onclick: attachFile,
              }, fileHashing ? [m('i.fas.fa-spinner.fa-spin'), ' Hashing...'] : 'Attach'),
            ]),
            filePathNeedsPrefix && m('small', [
              'The browser only returned the filename. Add its complete folder path before attaching.',
            ]),
            fileError && m('small.error-text', fileError),
          ]),
          inlineImages.length > 0 && m('.forum-thread-composer__inline-images',
            inlineImages.map((file, index) => m('.forum-thread-composer__inline-image', [
              m('img', { src: file.dataUrl, alt: file.name }),
              m('button[type=button][title=Remove inline image][aria-label=Remove inline image]', {
                onclick: () => inlineImages.splice(index, 1),
              }, m('i.fas.fa-times')),
            ]))
          ),
        ]),
        attachments.length > 0 && m('.forum-thread-composer__attachments', [
          m('.forum-thread-composer__attachments-heading', [
            m('i.fas.fa-paperclip'),
            m('span', `${attachments.length} attachment${attachments.length === 1 ? '' : 's'}`),
          ]),
          m('.forum-thread-composer__attachment-list', attachments.map((file, index) =>
            m('.forum-thread-composer__attachment', [
              m('i.fas.fa-file-alt'),
              m('span', [m('b', file.name), m('small', formatSize(file.size))]),
              m('button[type=button][title=Remove attachment][aria-label=Remove attachment]', {
                onclick: () => attachments.splice(index, 1),
              }, m('i.fas.fa-times')),
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

              res.body.retval === false
                ? util.popupmessage([m('h3', 'Error'), m('hr'), m('p', res.body.errorMessage)])
                : util.popupmessage([
                  m('h3', 'Success'),
                  m('hr'),
                  m('p', 'Thread added successfully'),
                ]);
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

const ThreadView = () => {
  let ownId;
  return {
    showThread: '',
    oninit: (v) => {
      util.updatedisplayforums(v.attrs.forumId);
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
      const forumId = v.attrs.forumId;
      const msgId = v.attrs.msgId;
      const threadStruct = (util.Data.Threads[forumId] && util.Data.Threads[forumId][msgId]) ? util.Data.Threads[forumId][msgId] : null;

      if (!threadStruct) {
        return m('.forum-thread-view', [
          m(
            'a[title=Back]',
            {
              onclick: () => m.route.set('/forums/:tab/:mGroupId', {
                tab: m.route.param().tab,
                mGroupId: forumId,
              }),
            },
            m('i.fas.fa-arrow-left')
          ),
          m('h3', 'Loading...'),
        ]);
      }

      const meta = threadStruct.thread.mMeta;
      const unread = meta.mMsgStatus === util.THREAD_UNREAD;

      return m('.forum-thread-view', { key: msgId }, [
        m(
          'a[title=Back]',
          {
            onclick: () => m.route.set('/forums/:tab/:mGroupId', {
              tab: m.route.param().tab,
              mGroupId: forumId,
            }),
          },
          m('i.fas.fa-arrow-left')
        ),
        m('div.post-header', { style: { margin: '10px 0' } }, [
          m('div.date', { style: { color: '#888', fontSize: '0.9em' } }, formatTimestamp(meta.mPublishTs)),
          m('h4.title', { style: { margin: '5px 0', fontWeight: 'bold' } }, meta.mMsgName),
          m('div.author', { style: { fontStyle: 'italic', fontSize: '1em' } }, rs.userList.username(meta.mAuthorId)),
        ]),
        m('hr'),
        m('div.actions', { style: { marginBottom: '15px' } }, [
          m('button', {
            style: { marginRight: '10px' },
            onclick: () => util.popupmessage(m(AddThread, {
              parent_thread: meta.mMsgName,
              forumId,
              authorId: ownId,
              parentId: msgId,
            }), 'create-forum-thread-modal')
          }, 'Reply'),
          m('button', {
            onclick: async () => {
              const res = await rs.rsJsonApiRequest('/rsgxsforums/markRead', {
                messageId: { first: forumId, second: meta.mOrigMsgId },
                read: !unread,
              });
              if (res.body.retval) {
                util.updatedisplayforums(forumId);
                m.redraw();
              }
            }
          }, unread ? 'Mark Read' : 'Mark Unread'),
        ]),
        m('div.forum-post-content', {
          style: {
            width: '100%',
            backgroundColor: '#f9f9f9',
            padding: '15px',
            borderRadius: '5px',
            whiteSpace: 'pre-wrap', // Preserve line breaks
            wordBreak: 'break-word',
          }
        }, [
          threadStruct.thread.mMsg !== null
            ? m.trust(threadStruct.thread.mMsg)
            : (loadPostContent(forumId, msgId), m('p', 'Loading content...'))
        ]),
      ]);
    },
  };
};

const ForumView = () => {
  let ownId = '';
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
      const allPosts = util.Data.Threads[v.attrs.id]
        ? Object.values(util.Data.Threads[v.attrs.id]).map((ts) => ts.thread.mMeta)
        : [];
      const fname = forumDetails.name;
      const fsubscribed = forumDetails.isSubscribed;
      const createDate = forumDetails.created;
      const lastActivity = forumDetails.activity;
      //  userMap holds {name, isContact} objects, so it must not be read
      //  directly into the view: username() is what turns an id into a string.
      let fauthor = 'Unknown';

      if (Number(forumDetails.author) === 0) {
        fauthor = 'No Contact Author';
      } else if (forumDetails.author) {
        fauthor = rs.userList.username(forumDetails.author);
      }

      return [
        m(
          'a[title=Back]',
          {
            onclick: () =>
              m.route.set('/forums/:tab', {
                tab: m.route.param().tab,
              }),
          },
          m('i.fas.fa-arrow-left')
        ),

        m('.widget__heading.forum-detail-heading', [
          m('h3', fname),
          m(
            'button',
            {
              onclick: async () => {
                const res = await rs.rsJsonApiRequest('/rsgxsforums/subscribeToForum', {
                  forumId: v.attrs.id,
                  subscribe: !fsubscribed,
                });
                if (res.body.retval) {
                  util.Data.DisplayForums[v.attrs.id].isSubscribed = !fsubscribed;
                }
              },
            },
            fsubscribed ? 'Subscribed' : 'Subscribe'
          ),
        ]),
        m('.forum-detail-card', [
          m('.forum-detail-card__icon[role=img][aria-label=Forum]',
            m('i.fas.fa-bullhorn')
          ),
          m('.forum-detail-card__details', [
            m('div', [m('b', 'Date created: '), m('span', formatTimestamp(createDate))]),
            m('div', [m('b', 'Admin: '), m('span', fauthor)]),
            m('div', [m('b', 'Last activity: '), m('span', formatTimestamp(lastActivity))]),
          ]),
          m('.forum-detail-card__description', [
            m('b', 'Description: '),
            m('span', forumDetails.description || 'No Description'),
          ]),
        ]),
        m(
          'threaddetails.forum-threads',
          {
            style: 'display:' + (fsubscribed ? 'block' : 'none'),
          },
          m('.forum-threads__heading', [
            m('h3', 'Threads'),
            m(
              'button.forum-threads__create[type=button][title=New Thread][aria-label=New Thread]',
              {
                onclick: () => {
                  util.popupmessage(
                    m(AddThread, {
                      parent_thread: '',
                      forumId: v.attrs.id,
                      authorId: ownId,
                      parentId: '',
                    }),
                    'create-forum-thread-modal'
                  );
                },
              },
              [m('i.fas.fa-pencil-alt'), m('span', 'New Thread')]
            ),
          ]),
          m(
            util.ThreadsTable,
            m(
              'tbody',
              allPosts
                .sort((a, b) => getTimestampValue(b.mPublishTs) - getTimestampValue(a.mPublishTs))
                .map((thread) =>
                  m(
                    'tr',
                    {
                      style:
                        thread.mMsgStatus === util.THREAD_UNREAD ? { fontWeight: 'bold' } : '',
                    },
                    m('td', { style: { padding: '10px 0' } }, [
                      m('div.date', { style: { fontSize: '0.8em', color: '#888' } },
                        formatTimestamp(thread.mPublishTs)
                      ),
                      m('div.title', {
                        style: { fontWeight: 'bold', fontSize: '1.2em', cursor: 'pointer', margin: '5px 0' },
                        onclick: () => {
                          m.route.set('/forums/:tab/:mGroupId/:mMsgId', {
                            tab: m.route.param().tab,
                            mGroupId: v.attrs.id,
                            mMsgId: thread.mOrigMsgId,
                          });
                        },
                      }, thread.mMsgName),
                      m('div.author', { style: { fontSize: '0.9em', fontStyle: 'italic' } }, rs.userList.username(thread.mAuthorId)),
                    ])
                  )
                )
            )
          )
        ),
      ];
    },
  };
};

module.exports = {
  ForumView,
  ThreadView,
  createforum,
};
