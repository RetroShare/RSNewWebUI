const m = require('mithril');
const rs = require('rswebui');
const util = require('files/files_util');
const widget = require('widgets');
const peopleUtil = require('people/people_util');
const compose = require('mail/mail_compose');

// rsmail.h
const RS_MSG_BOXMASK = 0x000f;

const RS_MSG_INBOX = 0x00;
const RS_MSG_SENTBOX = 0x01;
const RS_MSG_OUTBOX = 0x03;
const RS_MSG_DRAFTBOX = 0x05;
const RS_MSG_TRASH = 0x000020;
const RS_MSG_NEW = 0x10;
const RS_MSG_UNREAD_BY_USER = 0x40;
const RS_MSG_STAR = 0x200;
const RS_MSG_SPAM = 0x040000;

const RS_MSGTAGTYPE_IMPORTANT = 1;
const RS_MSGTAGTYPE_WORK = 2;
const RS_MSGTAGTYPE_PERSONAL = 3;
const RS_MSGTAGTYPE_TODO = 4;
const RS_MSGTAGTYPE_LATER = 5;
const RS_MSG_USER_REQUEST = 0x000400;
const RS_MSG_FRIEND_RECOMMENDATION = 0x000800;
const RS_MSG_PUBLISH_KEY = 0x020000;
const RS_MSG_SYSTEM = RS_MSG_USER_REQUEST | RS_MSG_FRIEND_RECOMMENDATION | RS_MSG_PUBLISH_KEY;

const MSG_ADDRESS_MODE_TO = 0x01;
const MSG_ADDRESS_MODE_CC = 0x02;
const MSG_ADDRESS_MODE_BCC = 0x03;

const BOX_ALL = 0x06;

const MessageCache = {};
const UserNicknamesCache = {};
const MailGxsDetailsCache = {};
const MailHoverState = {
  hoveredUser: null,
};

function renderMailUserTooltip() {
  if (!MailHoverState.hoveredUser) return null;
  const hUser = MailHoverState.hoveredUser;
  const details = MailGxsDetailsCache[hUser.gxsId];
  if (!details) return null;

  const avatar = details.mAvatar && details.mAvatar.base64 ? details.mAvatar.base64 : null;
  const firstLetter = (hUser.name || '?').slice(0, 1).toUpperCase();
  const votes = details.mReputation
    ? ((details.mReputation.mFriendsPositiveVotes || 0) - (details.mReputation.mFriendsNegativeVotes || 0))
    : 0;

  const rect = hUser.rect;
  const top = rect ? Math.max(10, Math.min(rect.bottom + 4, window.innerHeight - 185)) : 100;
  const left = rect ? Math.min(Math.max(rect.left, 20), window.innerWidth - 300) : 100;

  return m('.user-tooltip', {
    style: {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 10000,
    }
  }, [
    m('.tooltip-avatar', m(peopleUtil.UserAvatar, { avatar, firstLetter, identityId: hUser.gxsId, size: 64, isSquare: true })),
    m('.tooltip-details', [
      m('.tooltip-row', [m('span.tooltip-label', 'Identity name: '), m('span.tooltip-value', hUser.name)]),
      m('.tooltip-row', [m('span.tooltip-label', 'Identity Id: '), m('span.tooltip-value.tooltip-id', hUser.gxsId)]),
      details.mPgpId && details.mPgpId !== '0000000000000000' && m('.tooltip-row', [
        m('span.tooltip-label', 'Node: '),
        m('span.tooltip-value', `${rs.userList.username(details.mPgpId) || hUser.name} [${details.mPgpId}]`)
      ]),
      m('.tooltip-row', [
        m('span.tooltip-label', 'Votes: '),
        m('span.tooltip-value', {
          style: {
            color: votes >= 0 ? '#008000' : '#cc0000',
            fontWeight: 'bold'
          }
        }, (votes >= 0 ? '+' : '') + votes)
      ])
    ])
  ]);
}

const tagTypesCache = {};
const defaultTagTypes = {
  1: { name: 'Important', color: '#ef4444' },
  2: { name: 'Work', color: '#f97316' },
  3: { name: 'Personal', color: '#22c55e' },
  4: { name: 'Todo', color: '#3b82f6' },
  5: { name: 'Later', color: '#a855f7' },
};

function getTagDetails(tagId) {
  return tagTypesCache[tagId] || defaultTagTypes[tagId] || { name: `Tag ${tagId}`, color: '#cbd5e1' };
}

function loadTagTypes() {
  rs.rsJsonApiRequest('/rsMail/getMessageTagTypes', {}, (res) => {
    if (res && res.body && res.body.tags && res.body.tags.types) {
      res.body.tags.types.forEach((tag) => {
        tagTypesCache[tag.key] = {
          name: tag.value.first,
          color: `#${tag.value.second.toString(16).padStart(6, '0')}`,
        };
      });
    }
  });
}
loadTagTypes();

function formatMailDate(ts) {
  if (!ts) return '';
  const date = new Date(ts * 1000);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const isThisYear = date.getFullYear() === now.getFullYear();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (isThisYear) {
    return `${date.getDate()} ${months[date.getMonth()]}`;
  }
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear().toString().slice(2)}`;
}

// Utility functions
const humanReadableSize = (fileSize) => {
  return fileSize / 1024 > 1024
    ? fileSize / 1024 / 1024 > 1024
      ? (fileSize / 1024 / 1024 / 1024).toFixed(2) + ' GB'
      : (fileSize / 1024 / 1024).toFixed(2) + ' MB'
    : (fileSize / 1024).toFixed(2) + ' KB';
};

// Layouts
const MessageSummary = () => {
  let details = {};
  let files;
  let isStarred = false;
  let msgStatus = '';
  let fromUserInfo;
  function starMessage(e) {
    isStarred = !isStarred;
    rs.rsJsonApiRequest('/rsMail/MessageStar', { msgId: details.msgId, mark: isStarred });
    // Stop event bubbling, both functions for supporting IE & FF
    e.stopImmediatePropagation();
    e.preventDefault();
  }
  return {
    oninit: (v) => {
      rs.rsJsonApiRequest('/rsMail/getMessage', {
        msgId: v.attrs.details.msgId,
      })
        .then((res) => {
          if (res.body.retval) {
            details = res.body.msg;
            details.msgtags = v.attrs.details.msgtags;
            files = details.files;
            isStarred = (details.msgflags & 0xf00) === RS_MSG_STAR;
            const flag = details.msgflags & 0xf0;
            msgStatus = flag === RS_MSG_NEW || flag === RS_MSG_UNREAD_BY_USER ? 'unread' : 'read';
            MessageCache[v.attrs.details.msgId] = details;
          }
        })
        .then(() => {
          if (details?.from?._addr_string) {
            rs.rsJsonApiRequest(
              '/rsIdentity/getIdDetails',
              { id: details.from._addr_string },
              (data) => {
                fromUserInfo = data.details;
                if (fromUserInfo) {
                  UserNicknamesCache[details.from._addr_string] = fromUserInfo.mNickname || '';
                  MailGxsDetailsCache[details.from._addr_string] = fromUserInfo;
                }
              }
            );
          }
        });
    },
    view: (v) =>
      m(
        'tr.msgbody',
        {
          key: v.attrs.details.msgId,
          class: msgStatus,
          onclick: () =>
            m.route.set('/mail/:tab/:msgId', { tab: v.attrs.category, msgId: v.attrs.details.msgId }),
        },
        [
          m(
            'td.cell-star',
            m(`input.star-check[type=checkbox][id=msg-${v.attrs.details.msgId}]`, { checked: isStarred }),
            // Use label with  [for] to manipulate hidden checkbox
            m(
              `label.star-check[for=msg-${v.attrs.details.msgId}]`,
              {
                onclick: starMessage,
                class: (details.msgflags & 0xf00) === RS_MSG_STAR ? 'starred' : 'unstarred',
              },
              m('i.fas.fa-star')
            )
          ),
          m('td.cell-attachment', files && files.length > 0 ? m('i.fas.fa-paperclip', { title: `${files.length} attachment(s)` }) : null),
          m('td.cell-subject', [
            m('div', {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }
            }, [
              m('span', details.title),
              details.msgtags && details.msgtags.length > 0 && m('.mail-tags-container', { style: 'display: inline-flex; gap: 0.25rem;' },
                details.msgtags.map((tagId) => {
                  const tag = getTagDetails(tagId);
                  return m('span.mail-tag-badge', {
                    title: tag.name,
                    style: `display: inline-block; width: 10px; height: 10px; border-radius: 2px; background-color: ${tag.color};`
                  });
                })
              )
            ])
          ]),
          m(
            'td.cell-from',
            m(
              'div',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  justifyContent: 'start',
                  cursor: 'pointer',
                },
                onmouseenter: (e) => {
                  if (!details?.from?._addr_string) return;
                  const gxsId = details.from._addr_string;
                  const name = fromUserInfo && Number(fromUserInfo.mId) !== 0 ? fromUserInfo.mNickname : '[Unknown]';
                  const rect = e.currentTarget.getBoundingClientRect();
                  MailHoverState.hoveredUser = { gxsId, name, rect };
                  if (fromUserInfo) MailGxsDetailsCache[gxsId] = fromUserInfo;
                  if (!MailGxsDetailsCache[gxsId]) {
                    rs.rsJsonApiRequest('/rsIdentity/getIdDetails', { id: gxsId }, (d) => {
                      if (d && d.details) {
                        MailGxsDetailsCache[gxsId] = d.details;
                        m.redraw();
                      }
                    });
                  }
                  m.redraw();
                },
                onmouseleave: () => {
                  MailHoverState.hoveredUser = null;
                  m.redraw();
                }
              },
              [
                m(peopleUtil.UserAvatar, {
                  avatar: fromUserInfo?.mAvatar,
                  firstLetter: (fromUserInfo?.mNickname || '').slice(0, 1).toUpperCase(),
                  identityId: details.from?._addr_string,
                  size: 24,
                }),
                m('span', fromUserInfo && Number(fromUserInfo.mId) !== 0 ? fromUserInfo.mNickname : '[Unknown]'),
              ]
            )
          ),
          m('td.cell-date', { title: new Date(details.ts * 1000).toLocaleString() }, formatMailDate(details.ts)),
        ]
      ),
  };
};

const AttachmentSection = () => {
  function handleAttachmentDownload(item) {
    const { fname: fileName, hash, size } = item;
    const xstr64 = typeof size === 'object' ? size.xstr64 : String(size);
    const flags = util.RS_FILE_REQ_ANONYMOUS_ROUTING;
    rs.rsJsonApiRequest(
      '/rsFiles/FileRequest',
      { fileName, hash, flags, size: { xstr64 } },
      (status) =>
        widget.popupMessage([
          m('i.fas.fa-file-medical'),
          m('h3', `File is ${status.retval ? 'being' : 'already'} downloaded!`),
        ])
    ).catch((error) => { });
  }
  return {
    view: (v) =>
      m('.attachments-wrapper', [
        v.attrs.files.map((file) => {
          const fileSizeNum = file.size ? (typeof file.size === 'object' ? file.size.xint64 || parseInt(file.size.xstr64) || 0 : Number(file.size) || 0) : 0;
          return m('.attachment-card', [
            m('.attachment-icon', m('i.fas.fa-paperclip')),
            m('.attachment-info', [
              m('.attachment-name', file.fname),
              m('.attachment-size', humanReadableSize(fileSizeNum)),
            ]),
            m(
              'button.btn-attachment-download',
              { onclick: () => handleAttachmentDownload(file) },
              [m('i.fas.fa-download'), m('span.btn-text', ' Download')]
            ),
          ]);
        }),
      ]),
  };
};

const MessageView = () => {
  let showCompose = false;
  let composeType = 'reply';
  // setFunction like react to show/hide popup
  function setShowCompose(bool) {
    showCompose = bool;
  }
  const MailData = {
    msgId: '',
    message: '',
    subject: '',
    sender: {},
    recipients: [],
    toList: {},
    ccList: {},
    bccList: {},
    timeStamp: '',
    files: [],
  };
  function deleteMail() {
    rs.rsJsonApiRequest('/rsMail/MessageToTrash', { msgId: MailData.msgId, bTrash: true });
    rs.rsJsonApiRequest('/rsMail/MessageDelete', { msgId: MailData.msgId }).then((res) => {
      widget.popupMessage(
        m('.widget', [
          m('.widget__heading', m('h3', res.body.retval ? 'Success' : 'Error')),
          m('.widget__body', m('p', res.body.retval ? 'Mail Deleted.' : 'Error in Deleting.')),
        ])
      );
      m.route.set('/mail/:tab', { tab: m.route.param().tab });
    });
  }
  function confirmMailDelete() {
    widget.popupMessage([
      m('p', 'Are you sure you want to delete this mail?'),
      m('button', { onclick: deleteMail }, 'Delete'),
    ]);
  }

  return {
    oninit: async (v) => {
      const res = await rs.rsJsonApiRequest('/rsMail/getMessage', {
        msgId: v.attrs.msgId,
      });
      if (res.body.retval) {
        const msgDetails = await res.body.msg;
        msgDetails.files.forEach((element) =>
          MailData.files.push({ ...element, from: msgDetails.from, ts: msgDetails.ts })
        );
        // regex to detect html tags, better regex?  /<[a-z][\s\S]*>/gi
        MailData.message = /<\/*[a-z][^>]+?>/gi.test(msgDetails.msg)
          ? msgDetails.msg
          : `<p style="white-space: pre">${msgDetails.msg}</p>`;
        document.querySelector('#msgView').innerHTML = MailData.message;
        MailData.msgId = msgDetails.msgId;
        MailData.sender = msgDetails.from;
        MailData.subject = msgDetails.title;
        MailData.timeStamp = msgDetails.ts;
        MailData.recipients = msgDetails.destinations;
        MailData?.recipients?.forEach((destDetail) => {
          const { _addr_string: addrString, _mode: mode } = destDetail; // destructuring + renaming
          if (mode === MSG_ADDRESS_MODE_TO && !MailData.toList[addrString]) {
            MailData.toList[addrString] = destDetail;
          } else if (mode === MSG_ADDRESS_MODE_CC && !MailData.ccList[addrString]) {
            MailData.ccList[addrString] = destDetail;
          } else if (mode === MSG_ADDRESS_MODE_BCC && !MailData.bccList[addrString]) {
            MailData.bccList[addrString] = destDetail;
          }
          if (addrString && !UserNicknamesCache[addrString]) {
            rs.rsJsonApiRequest(
              '/rsIdentity/getIdDetails',
              { id: addrString },
              (data) => {
                if (data?.details) {
                  UserNicknamesCache[addrString] = data.details.mNickname || '';
                }
              }
            );
          }
        });
        rs.rsJsonApiRequest(
          '/rsIdentity/getIdDetails',
          { id: MailData?.sender?._addr_string },
          (data) => {
            if (data?.details) {
              MailData.avatar = data.details.mAvatar;
              UserNicknamesCache[MailData.sender._addr_string] = data.details.mNickname || '';
            }
          }
        );
      }
    },
    view: () =>
      m(
        '.msg-view',
        [
          m('.msg-view-nav', [
            m(
              'a[title=Back]',
              { onclick: () => m.route.set('/mail/:tab', { tab: m.route.param().tab }) },
              m('i.fas.fa-arrow-left')
            ),
            m('.msg-view-nav__action', [
              m('button', { onclick: () => { composeType = 'reply'; setShowCompose(true); } }, [m('i.fas.fa-reply'), m('span.btn-text', ' Reply')]),
              m('button', { onclick: () => { composeType = 'replyAll'; setShowCompose(true); } }, [m('i.fas.fa-reply-all'), m('span.btn-text', ' Reply All')]),
              m('button', { onclick: () => { composeType = 'forward'; setShowCompose(true); } }, [m('i.fas.fa-forward'), m('span.btn-text', ' Forward')]),
              m('button.red', { onclick: confirmMailDelete }, [m('i.fas.fa-trash'), m('span.btn-text', ' Delete')]),
            ]),
          ]),
          m('.msg-view__header', [
            m('h3', MailData.subject),
            m('.msg-details', [
              MailData.sender &&
              m(peopleUtil.UserAvatar, {
                avatar: MailData.avatar,
                firstLetter: (UserNicknamesCache[MailData.sender._addr_string] || rs.userList.username(MailData.sender._addr_string) || '').slice(0, 1).toUpperCase(),
                identityId: MailData.sender._addr_string,
              }),
              m('.msg-details__info', [
                MailData.sender &&
                m('.msg-details__info-item', {
                  style: { cursor: 'pointer', display: 'inline-flex', gap: '0.25rem', alignItems: 'center' },
                  onmouseenter: (e) => {
                    if (!MailData.sender._addr_string) return;
                    const gxsId = MailData.sender._addr_string;
                    const name = UserNicknamesCache[gxsId] || rs.userList.username(gxsId) || 'Unknown';
                    const rect = e.currentTarget.getBoundingClientRect();
                    MailHoverState.hoveredUser = { gxsId, name, rect };
                    if (!MailGxsDetailsCache[gxsId]) {
                      rs.rsJsonApiRequest('/rsIdentity/getIdDetails', { id: gxsId }, (d) => {
                        if (d && d.details) {
                          MailGxsDetailsCache[gxsId] = d.details;
                          m.redraw();
                        }
                      });
                    }
                    m.redraw();
                  },
                  onmouseleave: () => {
                    MailHoverState.hoveredUser = null;
                    m.redraw();
                  }
                }, [
                  m('b', 'From: '),
                  UserNicknamesCache[MailData.sender._addr_string] || rs.userList.username(MailData.sender._addr_string) || 'Unknown',
                ]),
                m('.msg-details__info-item', [
                  m('b', 'To: '),
                  MailData.toList && Object.keys(MailData.toList).length > 0
                    ? [
                      m('#truncate.truncated-view', [
                        Object.keys(MailData.toList).map((key, index) =>
                          m('span', { key: index }, `${UserNicknamesCache[key] || rs.userList.username(key) || 'Unknown'}, `)
                        ),
                      ]),
                      m(
                        'button.toggle-truncate',
                        {
                          style: {
                            display: Object.keys(MailData.toList).length > 10 ? 'block' : 'none',
                          },
                          onclick: () => {
                            document
                              .querySelector('#truncate')
                              .classList.toggle('truncated-view');
                          },
                        },
                        '...'
                      ),
                    ]
                    : m('span', 'Unknown'),
                ]),
                MailData.ccList &&
                Object.keys(MailData.ccList).length > 0 &&
                m('.msg-details__info-item', [
                  m('b', 'Cc: '),
                  Object.keys(MailData.ccList).map((key, index) =>
                    m('span', { key: index }, `${UserNicknamesCache[key] || rs.userList.username(key) || 'Unknown'}, `)
                  ),
                ]),
                MailData.bccList &&
                Object.keys(MailData.bccList).length > 0 &&
                m('.msg-details__info-item', [
                  m('b', 'Bcc: '),
                  Object.keys(MailData.bccList).map((key, index) =>
                    m('span', { key: index }, `${UserNicknamesCache[key] || rs.userList.username(key) || 'Unknown'}, `)
                  ),
                ]),
              ]),
            ]),
          ]),
          m('.msg-view__body', m('#msgView')),
          MailData.files.length > 0 &&
          m('.msg-view__attachment', [
            m('h3', 'Attachments'),
            m('.msg-view__attachment-items', m(AttachmentSection, { files: MailData.files })),
          ]),
        ],
        showCompose && m(
          '.composePopupOverlay#mailComposerPopup',
          m(
            '.composePopup',
            MailData.sender._addr_string
              ? m(compose, {
                msgType: composeType,
                senderId: MailData.sender._addr_string,
                recipientList: MailData.toList,
                ccList: MailData.ccList,
                subject: MailData.subject,
                replyMessage: MailData.message,
                timeStamp: new Date(MailData.timeStamp * 1000),
                setShowCompose,
              })
              : m('.widget', m('.widget__heading', m('h3', 'Sender is not known'))),
            m('button.red.close-btn', { onclick: () => setShowCompose(false) }, m('i.fas.fa-times'))
          )
        ),
        renderMailUserTooltip(),
      ),
  };
};

const SortState = {
  column: 'date',
  direction: 'desc',
};

function setSort(column) {
  if (SortState.column === column) {
    SortState.direction = SortState.direction === 'asc' ? 'desc' : 'asc';
  } else {
    SortState.column = column;
    SortState.direction = (column === 'date' || column === 'attachments' || column === 'starred') ? 'desc' : 'asc';
  }
}

function sortList(list) {
  if (!list) return [];
  return [...list].sort((msgA, msgB) => {
    let valA, valB;
    switch (SortState.column) {
      case 'starred': {
        const aStarred = (MessageCache[msgA.msgId]?.msgflags & 0xf00) === RS_MSG_STAR || (msgA.msgflags & 0xf00) === RS_MSG_STAR;
        const bStarred = (MessageCache[msgB.msgId]?.msgflags & 0xf00) === RS_MSG_STAR || (msgB.msgflags & 0xf00) === RS_MSG_STAR;
        valA = aStarred ? 1 : 0;
        valB = bStarred ? 1 : 0;
        break;
      }
      case 'attachments': {
        const aCount = MessageCache[msgA.msgId]?.files?.length || msgA.count || 0;
        const bCount = MessageCache[msgB.msgId]?.files?.length || msgB.count || 0;
        valA = Number(aCount);
        valB = Number(bCount);
        break;
      }
      case 'subject': {
        const aTitle = MessageCache[msgA.msgId]?.title || msgA.title || '';
        const bTitle = MessageCache[msgB.msgId]?.title || msgB.title || '';
        valA = aTitle.toLowerCase();
        valB = bTitle.toLowerCase();
        break;
      }
      case 'from': {
        const aSenderId = MessageCache[msgA.msgId]?.from?._addr_string || msgA.from?._addr_string;
        const bSenderId = MessageCache[msgB.msgId]?.from?._addr_string || msgB.from?._addr_string;
        const aName = aSenderId && rs.userList.userMap[aSenderId];
        const bName = bSenderId && rs.userList.userMap[bSenderId];
        const aFrom = (UserNicknamesCache[aSenderId] || (aName && aName.name) || aName || '') + '';
        const bFrom = (UserNicknamesCache[bSenderId] || (bName && bName.name) || bName || '') + '';
        valA = aFrom.toLowerCase();
        valB = bFrom.toLowerCase();
        break;
      }
      case 'date':
      default: {
        const aTs = MessageCache[msgA.msgId]?.ts || msgA.ts?.xint64 || msgA.ts || 0;
        const bTs = MessageCache[msgB.msgId]?.ts || msgB.ts?.xint64 || msgB.ts || 0;
        valA = Number(aTs);
        valB = Number(bTs);
        break;
      }
    }

    if (valA < valB) return SortState.direction === 'asc' ? -1 : 1;
    if (valA > valB) return SortState.direction === 'asc' ? 1 : -1;
    return 0;
  });
}

const Table = () => {
  let currentPage = 0;
  const pageSize = 50;
  return {
    view: (v) => {
      const renderHeader = (colName, label, isIcon = false) => {
        const isActive = SortState.column === colName;
        const iconClass = isActive
          ? (SortState.direction === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down')
          : 'fas fa-sort';
        return m(
          'th.sortable-th',
          {
            onclick: () => setSort(colName),
            style: { cursor: 'pointer', userSelect: 'none' },
          },
          [
            isIcon ? label : m('span', label),
            ' ',
            m(`i.${iconClass}`, {
              style: {
                marginLeft: '0.25rem',
                opacity: isActive ? 1 : 0.2,
                transition: 'opacity 0.2s',
              },
            }),
          ]
        );
      };

      let totalItems = 0;
      let tbody = v.children[0];
      if (tbody && tbody.children) {
        const flatChildren = Array.isArray(tbody.children) ? tbody.children.flat().filter(Boolean) : [tbody.children].filter(Boolean);
        totalItems = flatChildren.length;
        
        const start = currentPage * pageSize;
        const end = start + pageSize;
        tbody.children = flatChildren.slice(start, end);
      }

      const totalPages = Math.ceil(totalItems / pageSize) || 1;
      if (currentPage >= totalPages) currentPage = totalPages - 1;
      if (currentPage < 0) currentPage = 0;

      const paginationUI = totalItems > pageSize && m('.pagination', {
        style: {
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '1rem',
          padding: '1rem',
          borderTop: '1px solid #eee',
          fontSize: '1rem',
          color: '#555',
          userSelect: 'none'
        }
      }, [
        m('button', {
          disabled: currentPage === 0,
          onclick: () => currentPage--,
          style: {
            padding: '0.4rem 0.8rem',
            background: currentPage === 0 ? '#ccc' : '#019dff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
            boxShadow: 'none'
          }
        }, m('i.fas.fa-chevron-left')),
        m('span.bold', `${totalItems > 0 ? currentPage * pageSize + 1 : 0} - ${Math.min((currentPage + 1) * pageSize, totalItems)} of ${totalItems}`),
        m('button', {
          disabled: currentPage >= totalPages - 1,
          onclick: () => currentPage++,
          style: {
            padding: '0.4rem 0.8rem',
            background: currentPage >= totalPages - 1 ? '#ccc' : '#019dff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
            boxShadow: 'none'
          }
        }, m('i.fas.fa-chevron-right'))
      ]);

      return m('.table-pagination-container', [
        m('table.mails', [
          m('tr', [
            renderHeader('starred', m('i.fas.fa-star'), true),
            renderHeader('attachments', m('i.fas.fa-paperclip'), true),
            renderHeader('subject', 'Subject'),
            renderHeader('from', 'From'),
            renderHeader('date', 'Date'),
          ]),
          tbody,
        ]),
        paginationUI,
        renderMailUserTooltip(),
      ]);
    },
  };
};

const SearchBar = () => {
  let searchString = '';
  return {
    view: ({ attrs: { list } }) =>
      m('input[type=text][placeholder=Search Subject].searchbar', {
        value: searchString,
        oninput: (e) => {
          searchString = e.target.value.toLowerCase();
          for (const hash in list) {
            list[hash].isSearched = list[hash].fname.toLowerCase().indexOf(searchString) > -1;
          }
        },
      }),
  };
};

const activeSideLink = {
  sideactive: 0,
  quicksideactive: -1,
};

const sidebarIcons = {
  inbox: m('i.fas.fa-inbox', { style: 'color: #3b82f6; margin-right: 0.75rem; font-size: 24px; width: 24px; text-align: center;' }),
  outbox: m('i.fas.fa-envelope-open-text', { style: 'color: #10b981; margin-right: 0.75rem; font-size: 24px; width: 24px; text-align: center;' }),
  drafts: m('i.fas.fa-edit', { style: 'color: #6b7280; margin-right: 0.75rem; font-size: 24px; width: 24px; text-align: center;' }),
  sent: m('i.fas.fa-envelope-open', { style: 'color: #f59e0b; margin-right: 0.75rem; font-size: 24px; width: 24px; text-align: center;' }),
  trash: m('i.fas.fa-trash-alt', { style: 'color: #ef4444; margin-right: 0.75rem; font-size: 24px; width: 24px; text-align: center;' }),
  starred: m('i.fas.fa-star', { style: 'color: #eab308; margin-right: 0.75rem; font-size: 24px; width: 24px; text-align: center;' }),
  system: m('i.fas.fa-bell', { style: 'color: #3b82f6; margin-right: 0.75rem; font-size: 24px; width: 24px; text-align: center;' }),
  spam: m('i.fas.fa-fire', { style: 'color: #f97316; margin-right: 0.75rem; font-size: 24px; width: 24px; text-align: center;' }),
  attachment: m('i.fas.fa-paperclip', { style: 'color: #06b6d4; margin-right: 0.75rem; font-size: 24px; width: 24px; text-align: center;' }),
  important: m('i.fas.fa-square', { style: 'color: #ef4444; margin-right: 0.75rem; font-size: 24px; width: 24px; text-align: center;' }),
  work: m('i.fas.fa-square', { style: 'color: #f97316; margin-right: 0.75rem; font-size: 24px; width: 24px; text-align: center;' }),
  personal: m('i.fas.fa-square', { style: 'color: #22c55e; margin-right: 0.75rem; font-size: 24px; width: 24px; text-align: center;' }),
  todo: m('i.fas.fa-square', { style: 'color: #3b82f6; margin-right: 0.75rem; font-size: 24px; width: 24px; text-align: center;' }),
  later: m('i.fas.fa-square', { style: 'color: #a855f7; margin-right: 0.75rem; font-size: 24px; width: 24px; text-align: center;' }),
};

const Sidebar = () => {
  return {
    view: ({ attrs: { tabs, baseRoute, size, onNavigate } }) =>
      m(
        '.sidebar',
        tabs.map((panelName, index) => {
          const displayName = panelName.charAt(0).toUpperCase() + panelName.slice(1);
          return m(
            m.route.Link,
            {
              class: index === activeSideLink.sideactive ? 'selected-sidebar-link' : '',
              style: 'display: flex; align-items: center;',
              onclick: () => {
                activeSideLink.sideactive = index;
                activeSideLink.quicksideactive = -1;
                if (onNavigate) onNavigate();
              },
              href: baseRoute + panelName,
            },
            [
              sidebarIcons[panelName] || null,
              m('span.sidebar-link-text', displayName),
              size[panelName] > 0 && m('span.sidebar-badge', size[panelName]),
            ]
          );
        })
      ),
  };
};

const SidebarQuickView = () => {
  // for the Mail tab, to be moved later.
  return {
    view: ({ attrs: { tabs, baseRoute, size, onNavigate } }) =>
      m(
        '.sidebarquickview',
        m('h6.bold', 'Quick View'),
        tabs.map((panelName, index) => {
          const displayName = panelName.charAt(0).toUpperCase() + panelName.slice(1);
          return m(
            m.route.Link,
            {
              class:
                index === activeSideLink.quicksideactive ? 'selected-sidebarquickview-link' : '',
              style: 'display: flex; align-items: center;',
              onclick: () => {
                activeSideLink.quicksideactive = index;
                activeSideLink.sideactive = -1;
                if (onNavigate) onNavigate();
              },
              href: baseRoute + panelName,
            },
            [
              sidebarIcons[panelName] || null,
              m('span.sidebar-link-text', displayName),
              size[panelName] > 0 && m('span.sidebar-badge', size[panelName]),
            ]
          );
        })
      ),
  };
};

module.exports = {
  MessageSummary,
  MessageView,
  AttachmentSection,
  Table,
  SearchBar,
  Sidebar,
  SidebarQuickView,
  SortState,
  setSort,
  sortList,
  RS_MSG_BOXMASK,
  RS_MSG_INBOX,
  RS_MSG_SENTBOX,
  RS_MSG_OUTBOX,
  RS_MSG_DRAFTBOX,
  RS_MSG_NEW,
  RS_MSG_UNREAD_BY_USER,
  RS_MSG_STAR,
  RS_MSG_TRASH,
  RS_MSG_SYSTEM,
  RS_MSG_SPAM,
  RS_MSGTAGTYPE_IMPORTANT,
  RS_MSGTAGTYPE_LATER,
  RS_MSGTAGTYPE_PERSONAL,
  RS_MSGTAGTYPE_TODO,
  RS_MSGTAGTYPE_WORK,
  BOX_ALL,
};
