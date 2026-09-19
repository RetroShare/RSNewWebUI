const m = require('mithril');
const rs = require('rswebui');
const mailApi = require('mail/mail_api');
const util = require('files/files_util');
const widget = require('widgets');
const peopleUtil = require('people/people_util');
const compose = require('mail/mail_compose');
const renderIdentityTooltip = require('mail/mail_identity_tooltip');
const icon = require('icon');
const toast = require('toast');

// rsmail.h
const RS_MSG_BOXMASK = 0x000f;

const RS_MSG_INBOX = 0x00;
const RS_MSG_SENTBOX = 0x01;
const RS_MSG_OUTBOX = 0x03;
const RS_MSG_DRAFT = 0x04;
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

//  What counts as a draft, in one place. The Drafts folder and the reading
//  pane disagreed: the folder listed anything with the DRAFT bit, the toolbar
//  asked for the exact DRAFTBOX box value (OUTGOING|DRAFT) -- so a draft the
//  core had not also marked OUTGOING appeared in the folder and then opened
//  with the Reply / Forward / Spam toolbar of a received mail.
//  0x08 is not a box value rsmail.h defines; it is kept because the folder
//  filter has always listed it and dropping it would change what Drafts shows.
//  Mail with no subject is common enough (invites, system notices, replies
//  sent from the Qt client) that a blank cell reads as a rendering fault. The
//  table left it blank while the cards and the reading pane already said this.
const NO_SUBJECT = '(No Subject)';
function subjectOf(title) {
  return (title && title.trim()) || NO_SUBJECT;
}

function isDraftMessage(msgflags) {
  return (msgflags & RS_MSG_DRAFT) !== 0 || (msgflags & 0x08) !== 0;
}

//  Identity details, fetched once on the first miss. Callers read this
//  synchronously from a view and the redraw brings the avatar and nickname in.
//  Sender details were only ever fetched from the message's own `from`, so a
//  draft the core left without one showed a jdenticon while the same identity
//  showed its real photo in the list.
//  A failed answer (the core unreachable, an HTTP error) is remembered for a
//  while: the request's own redraw calls this again from the view, and with
//  nothing cached the next redraw asked again, once per unresolved address,
//  for as long as the core stayed away.
const GXS_DETAIL_RETRY_MS = 60000;
const GxsDetailFetches = new Set();
const GxsDetailMisses = {};
function identityDetails(addr) {
  if (!addr) return null;
  if (MailGxsDetailsCache[addr]) return MailGxsDetailsCache[addr];
  if (GxsDetailFetches.has(addr)) return null;
  if (GxsDetailMisses[addr] && Date.now() - GxsDetailMisses[addr] < GXS_DETAIL_RETRY_MS) return null;
  GxsDetailFetches.add(addr);
  rs.rsJsonApiRequest('/rsIdentity/getIdDetails', { id: addr }, (data) => {
    GxsDetailFetches.delete(addr);
    if (!data || !data.details) {
      GxsDetailMisses[addr] = Date.now();
      return;
    }
    delete GxsDetailMisses[addr];
    MailGxsDetailsCache[addr] = data.details;
    UserNicknamesCache[addr] = data.details.mNickname || '';
    m.redraw();
  });
  return null;
}

//  rs.userList.username() hands back the id itself while its bulk fetch is in
//  flight, and keeps doing so for an identity this node has never seen -- so
//  the To: chips were 32-character hex strings. That is not a name: shorten it
//  so the row stays readable, and keep the full id in the title.
//  The bulk identity list is asked first: when it knows the name there is
//  nothing to fetch. The per-identity details are only for the names it does
//  not have.
function identityLabel(addr) {
  if (!addr) return '';
  const known = rs.userList.username(addr);
  const name = (known && known !== addr ? known : '')
    || UserNicknamesCache[addr]
    || identityDetails(addr)?.mNickname;
  if (!name) return `${addr.slice(0, 8)}…`;
  return name;
}

//  A draft was written BY us, so an empty `from` means the core never recorded
//  which identity -- not that the sender is a stranger. Fall back to our first
//  identity rather than showing the mail as being from [Unknown].
//
//  Read synchronously from a view, so the fetch is kicked off on the first miss
//  and the redraw picks it up. people_util caches for 30s, so this is one
//  request, not one per row.
let OwnIds = [];
let ownIdsPending = false;
function draftSenderId(addr) {
  if (peopleUtil.isUsableIdentityId(addr)) return addr;
  if (!OwnIds.length && !ownIdsPending) {
    ownIdsPending = true;
    peopleUtil.ownIds((ids) => {
      ownIdsPending = false;
      if (!ids || !ids.length) return;
      OwnIds = ids;
      m.redraw();
    });
  }
  return OwnIds[0] || '';
}

const MessageCache = {};
const UserNicknamesCache = {};
const MailGxsDetailsCache = {};
const MailHoverState = {
  hoveredUser: null,
};

const messageUpdateListeners = [];
function onMessageUpdated(callback) {
  if (typeof callback === 'function') messageUpdateListeners.push(callback);
}
function triggerMessageUpdated(msgId, flag, isSet) {
  messageUpdateListeners.forEach((cb) => {
    try {
      cb(msgId, flag, isSet);
    } catch (e) {
      /* ignore */
    }
  });
}

function markMessageRead(msgId, onDone) {
  if (!msgId) return;
  if (MessageCache[msgId] && MessageCache[msgId].msgflags !== undefined) {
    MessageCache[msgId].msgflags &= ~(RS_MSG_NEW | RS_MSG_UNREAD_BY_USER);
  }
  triggerMessageUpdated(msgId, RS_MSG_NEW, false);
  rs.rsJsonApiRequest(
    '/rsMail/MessageRead',
    { msgId, unreadByUser: false },
    (data, success) => {
      if (MessageCache[msgId] && MessageCache[msgId].msgflags !== undefined) {
        MessageCache[msgId].msgflags &= ~(RS_MSG_NEW | RS_MSG_UNREAD_BY_USER);
      }
      triggerMessageUpdated(msgId, RS_MSG_NEW, false);
      if (onDone) onDone(Boolean(success && (!data || data.retval !== false)));
    }
  );
}

function renderMailUserTooltip() {
  if (!MailHoverState.hoveredUser) return null;
  const hUser = MailHoverState.hoveredUser;
  const details = MailGxsDetailsCache[hUser.gxsId];
  if (!details) return null;

  return renderIdentityTooltip({
    details,
    gxsId: hUser.gxsId,
    name: hUser.name,
    rect: hUser.rect,
  });
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
  //  The callback form hands the response BODY to the callback; reading
  //  res.body here found nothing, and every tag showed as "Tag <id>" in grey.
  rs.rsJsonApiRequest('/rsMail/getMessageTagTypes', {}, (res) => {
    if (res && res.tags && res.tags.types) {
      res.tags.types.forEach((tag) => {
        tagTypesCache[tag.key] = {
          name: tag.value.first,
          color: `#${tag.value.second.toString(16).padStart(6, '0')}`,
        };
      });
    }
  });
}
loadTagTypes();

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

//  The compact form, for the card list where the date sits beside a name.
function formatMailDate(ts) {
  if (!ts) return '';
  const date = new Date(ts * 1000);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  }
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear().toString().slice(2)}`;
}

//  The table has a column to itself, so it carries the time as well -- which
//  is the only thing that separates two mails that arrived the same day.
function formatMailDateTime(ts) {
  if (!ts) return '';
  const date = new Date(ts * 1000);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === new Date().toDateString()) return time;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear().toString().slice(2)}, ${time}`;
}

// Utility functions
const humanReadableSize = (fileSize) => {
  return fileSize / 1024 > 1024
    ? fileSize / 1024 / 1024 > 1024
      ? (fileSize / 1024 / 1024 / 1024).toFixed(2) + ' GB'
      : (fileSize / 1024 / 1024).toFixed(2) + ' MB'
    : (fileSize / 1024).toFixed(2) + ' KB';
};

const stripHtmlForSnippet = (html) => {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\.[A-Za-z0-9_-]+\s*\{[^}]*\}/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, '\'')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Layouts
const MessageSummary = () => {
  let details = {};
  let files;
  let isStarred = false;
  let isSpam = false;
  let fromUserInfo;
  function starMessage(e) {
    isStarred = !isStarred;
    rs.rsJsonApiRequest('/rsMail/MessageStar', { msgId: details.msgId, mark: isStarred });
    triggerMessageUpdated(details.msgId, RS_MSG_STAR, isStarred);
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
            isSpam = Boolean(details.msgflags & RS_MSG_SPAM);
            if (v.attrs.details && v.attrs.details.msgflags !== undefined) {
              details.msgflags = v.attrs.details.msgflags;
              isStarred = (details.msgflags & 0xf00) === RS_MSG_STAR;
              isSpam = Boolean(details.msgflags & RS_MSG_SPAM);
            }
            MessageCache[v.attrs.details.msgId] = details;
          }
        })
        .then(() => {
          //  Through the shared fetch, which the view also goes through: one
          //  request per identity, not one per row plus one per redraw.
          if (details?.from?._addr_string) identityDetails(details.from._addr_string);
        });
    },
    //  The reading pane's star/spam toggles refresh the summaries; the row's
    //  closure flags must follow the refreshed attrs or the icon stays stale
    //  until a remount.
    onupdate: (v) => {
      if (v.attrs.details && v.attrs.details.msgflags !== undefined) {
        isStarred = (v.attrs.details.msgflags & 0xf00) === RS_MSG_STAR;
        isSpam = Boolean(v.attrs.details.msgflags & RS_MSG_SPAM);
      }
    },
    view: (v) => {
      const spamActive = isSpam || Boolean((details.msgflags || v.attrs.details.msgflags) & RS_MSG_SPAM);
      function spamMessage(e) {
        isSpam = !spamActive;
        const targetId = details.msgId || (v.attrs.details && v.attrs.details.msgId);
        if (details.msgflags !== undefined) {
          if (isSpam) details.msgflags |= RS_MSG_SPAM;
          else details.msgflags &= ~RS_MSG_SPAM;
        }
        if (v.attrs.details && v.attrs.details.msgflags !== undefined) {
          if (isSpam) v.attrs.details.msgflags |= RS_MSG_SPAM;
          else v.attrs.details.msgflags &= ~RS_MSG_SPAM;
        }
        if (MessageCache[targetId]) {
          if (isSpam) MessageCache[targetId].msgflags |= RS_MSG_SPAM;
          else MessageCache[targetId].msgflags &= ~RS_MSG_SPAM;
        }
        rs.rsJsonApiRequest('/rsMail/MessageJunk', { msgId: targetId, mark: isSpam });
        triggerMessageUpdated(targetId, RS_MSG_SPAM, isSpam);
        e.stopImmediatePropagation();
        e.preventDefault();
        m.redraw();
      }

      const summaryMsg = v.attrs.details;
      const currentDetails = MessageCache[summaryMsg.msgId] || details || summaryMsg;
      const currentFlags = summaryMsg.msgflags !== undefined ? summaryMsg.msgflags : (currentDetails.msgflags || 0);
      if (MessageCache[summaryMsg.msgId] && summaryMsg.msgflags !== undefined) {
        MessageCache[summaryMsg.msgId].msgflags = summaryMsg.msgflags;
      }
      const flag = currentFlags & 0xf0;
      const isUnread = (flag === RS_MSG_NEW || flag === RS_MSG_UNREAD_BY_USER)
        && !(currentFlags & RS_MSG_TRASH)
        && !(currentFlags & RS_MSG_SPAM);
      const currentStatus = isUnread ? 'unread' : 'read';
      const isDraft = isDraftMessage(currentFlags);
      const hideJudgements = v.attrs.category === 'drafts';
      //  An old draft can carry no `from` at all; it was still written by us.
      const fromAddr = isDraft
        ? draftSenderId(details.from?._addr_string)
        : details.from?._addr_string;
      if (details.from?._addr_string) fromUserInfo = MailGxsDetailsCache[details.from._addr_string];
      const fromName = fromUserInfo && Number(fromUserInfo.mId) !== 0
        ? fromUserInfo.mNickname
        : (fromAddr && identityLabel(fromAddr)) || '[Unknown]';

      return m(
        'tr.msgbody',
        {
          key: v.attrs.details.msgId,
          class: [
            currentStatus,
            v.attrs.isSelected ? 'selected' : '',
          ].filter(Boolean).join(' '),
          onclick: () => {
            if (v.attrs.onOpen) v.attrs.onOpen();
            if (v.attrs.onSelect) {
              v.attrs.onSelect(v.attrs.details.msgId);
            } else {
              m.route.set('/mail/:tab/:msgId', { tab: v.attrs.category, msgId: v.attrs.details.msgId });
            }
          },
        },
        [
          //  Star and spam are judgements about mail someone sent you; a draft
          //  is yours and unsent. In the Drafts folder the columns come out
          //  altogether -- a header over nothing but blank cells reads as
          //  broken -- so the header and the cells key off the same folder.
          !hideJudgements && m(
            'td.cell-star',
            isDraft ? null : m(`input.star-check[type=checkbox][id=msg-${v.attrs.details.msgId}]`, { checked: isStarred }),
            // Use label with  [for] to manipulate hidden checkbox
            isDraft ? null : m(
              `label.star-check[for=msg-${v.attrs.details.msgId}]`,
              {
                onclick: starMessage,
                class: (details.msgflags & 0xf00) === RS_MSG_STAR ? 'starred' : 'unstarred',
              },
              icon((details.msgflags & 0xf00) === RS_MSG_STAR ? 'star-fill' : 'star')
            )
          ),
          m('td.cell-attachment', files && files.length > 0 ? icon('paperclip', { title: `${files.length} attachment(s)` }) : null),
          m('td.cell-subject', [
            m('.cell-subject__row', [
              files && files.length > 0 && icon('paperclip', { class: 'mobile-subject-clip',  title: `${files.length} attachment(s)` }),
              m('span', {
                class: subjectOf(details.title) === NO_SUBJECT ? 'is-placeholder' : '',
              }, subjectOf(details.title)),
            ])
          ]),
          m(
            'td.cell-from',
            m(
              '.cell-from__row',
              {
                onmouseenter: (e) => {
                  if (!fromAddr) return;
                  const gxsId = fromAddr;
                  const name = fromName;
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
                  firstLetter: fromUserInfo?.mNickname,
                  identityId: fromAddr,
                  size: 24,
                }),
                m('span', fromName),
              ]
            )
          ),
          !hideJudgements && m(
            'td.cell-spam',
            isDraft ? null : m(
              'button.spam-btn[type=button]',
              {
                onclick: spamMessage,
                class: spamActive ? 'spammed' : '',
                title: spamActive ? 'Mark as not spam' : 'Mark as spam',
              },
              icon(spamActive ? 'fire-fill' : 'fire')
            )
          ),
          m('td.cell-date', { title: new Date(details.ts * 1000).toLocaleString() }, formatMailDateTime(details.ts)),
          m('td.cell-tags', (details.msgtags || []).map((tagId) => {
            const tag = getTagDetails(tagId);
            return m('span.mail-card-tag-badge', {
              title: tag.name,
              style: { '--tag': tag.color },
            }, [m('span.mail-card-tag-dot'), tag.name]);
          })),
          m('td.cell-spacer'),
        ]
      );
    },
  };
};

//  Bodies already being fetched for a card: a remount during the round trip
//  (filter toggle, page change) must not fire the same getMessage again.
const CardFetchesInFlight = new Set();

const MessageCard = () => {
  return {
    oninit: (v) => {
      const msgId = v.attrs.msg.msgId;
      if (!MessageCache[msgId] && !CardFetchesInFlight.has(msgId)) {
        CardFetchesInFlight.add(msgId);
        rs.rsJsonApiRequest('/rsMail/getMessage', { msgId }).then((res) => {
          CardFetchesInFlight.delete(msgId);
          if (res && res.body && res.body.retval) {
            MessageCache[msgId] = res.body.msg;
            MessageCache[msgId].msgtags = v.attrs.msg.msgtags;
            if (v.attrs.msg && v.attrs.msg.msgflags !== undefined) {
              MessageCache[msgId].msgflags = v.attrs.msg.msgflags;
            }
            identityDetails(res.body.msg.from?._addr_string);
            m.redraw();
          }
        });
      } else {
        identityDetails(MessageCache[msgId]?.from?._addr_string || v.attrs.msg.from?._addr_string);
      }
    },
    view: (v) => {
      const msg = v.attrs.msg;
      const details = MessageCache[msg.msgId] || msg;
      if (MessageCache[msg.msgId] && msg.msgflags !== undefined) {
        MessageCache[msg.msgId].msgflags = msg.msgflags;
      }
      const currentFlags = msg.msgflags !== undefined ? msg.msgflags : (details.msgflags || 0);
      const isDraft = isDraftMessage(currentFlags);
      const rawSenderAddr = details.from?._addr_string || msg.from?._addr_string;
      const senderAddr = isDraft ? draftSenderId(rawSenderAddr) : rawSenderAddr;
      const senderName = (senderAddr && identityLabel(senderAddr)) || '[Unknown]';
      const senderInfo = MailGxsDetailsCache[senderAddr];
      const flag = currentFlags & 0xf0;
      const isUnread = (flag === RS_MSG_NEW || flag === RS_MSG_UNREAD_BY_USER)
        && !(currentFlags & RS_MSG_TRASH)
        && !(currentFlags & RS_MSG_SPAM);
      const isStarred = (currentFlags & 0xf00) === RS_MSG_STAR;
      const isSpam = Boolean(currentFlags & RS_MSG_SPAM);
      const filesCount = (details.files && details.files.length) || msg.count || 0;
      const tags = details.msgtags || msg.msgtags || [];
      const isSelected = Boolean(v.attrs.isSelected);

      const rawMsg = details.msg || '';
      const snippet = stripHtmlForSnippet(rawMsg).slice(0, 110);
      const openMessage = () => {
        if (v.attrs.onSelect) v.attrs.onSelect(msg.msgId);
      };

      return m(
        '.mail-card-item',
        {
          key: msg.msgId,
          class: [
            isSelected ? 'selected' : '',
            isUnread ? 'unread' : 'read',
          ].filter(Boolean).join(' '),
          onclick: openMessage,
        },
        [
          isUnread && m('.mail-card-unread-dot'),
          m('.mail-card-avatar-col', [
            m(peopleUtil.UserAvatar, {
              avatar: senderInfo?.mAvatar,
              firstLetter: senderName,
              identityId: senderAddr,
              size: 38,
            }),
          ]),
          m('.mail-card-content-col', [
            m('.mail-card-row-top', [
              m(
                '.mail-card-sender',
                {
                  title: senderName,
                  onmouseenter: (e) => {
                    if (!senderAddr) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    MailHoverState.hoveredUser = { gxsId: senderAddr, name: senderName, rect };
                    m.redraw();
                  },
                  onmouseleave: () => {
                    MailHoverState.hoveredUser = null;
                    m.redraw();
                  },
                },
                senderName
              ),
              m('.mail-card-date', { title: new Date((msg.ts?.xint64 || msg.ts || details.ts) * 1000).toLocaleString() }, formatMailDate(msg.ts?.xint64 || msg.ts || details.ts)),
            ]),
            m('.mail-card-row-subject', [
              m('button.mail-card-subject[type=button]', {
                class: subjectOf(details.title || msg.title) === NO_SUBJECT ? 'is-placeholder' : '',
                title: details.title || msg.title,
                onclick: (e) => {
                  e.stopPropagation();
                  openMessage();
                },
              }, subjectOf(details.title || msg.title)),
              m('.mail-card-indicators', [
                filesCount > 0 && icon('paperclip', { class: 'mail-card-clip',  title: `${filesCount} attachment(s)` }),
                //  Star and spam are judgements about mail someone sent you.
                //  A draft is yours and unsent, so neither applies to it.
                !isDraft && m(
                  'button.mail-card-spam-btn[type=button]',
                  {
                    class: isSpam ? 'spammed' : '',
                    title: isSpam ? 'Mark as not spam' : 'Mark as spam',
                    'aria-label': isSpam ? 'Mark as not spam' : 'Mark as spam',
                    'aria-pressed': String(isSpam),
                    onclick: (e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const next = !isSpam;
                      if (details.msgflags !== undefined) {
                        if (next) details.msgflags |= RS_MSG_SPAM;
                        else details.msgflags &= ~RS_MSG_SPAM;
                      }
                      if (msg.msgflags !== undefined) {
                        if (next) msg.msgflags |= RS_MSG_SPAM;
                        else msg.msgflags &= ~RS_MSG_SPAM;
                      }
                      if (MessageCache[msg.msgId]) {
                        if (next) MessageCache[msg.msgId].msgflags |= RS_MSG_SPAM;
                        else MessageCache[msg.msgId].msgflags &= ~RS_MSG_SPAM;
                      }
                      rs.rsJsonApiRequest('/rsMail/MessageJunk', { msgId: msg.msgId, mark: next });
                      triggerMessageUpdated(msg.msgId, RS_MSG_SPAM, next);
                      m.redraw();
                    },
                  },
                  icon(isSpam ? 'fire-fill' : 'fire')
                ),
                !isDraft && m(
                  'button.mail-card-star-btn[type=button]',
                  {
                    class: isStarred ? 'starred' : '',
                    title: isStarred ? 'Unstar' : 'Star',
                    'aria-label': isStarred ? 'Unstar message' : 'Star message',
                    'aria-pressed': String(isStarred),
                    onclick: (e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const next = !isStarred;
                      rs.rsJsonApiRequest('/rsMail/MessageStar', { msgId: msg.msgId, mark: next });
                      if (details.msgflags !== undefined) {
                        if (next) details.msgflags |= RS_MSG_STAR;
                        else details.msgflags &= ~RS_MSG_STAR;
                      }
                      if (msg.msgflags !== undefined) {
                        if (next) msg.msgflags |= RS_MSG_STAR;
                        else msg.msgflags &= ~RS_MSG_STAR;
                      }
                      if (MessageCache[msg.msgId]) {
                        if (next) MessageCache[msg.msgId].msgflags |= RS_MSG_STAR;
                        else MessageCache[msg.msgId].msgflags &= ~RS_MSG_STAR;
                      }
                      triggerMessageUpdated(msg.msgId, RS_MSG_STAR, next);
                      m.redraw();
                    },
                  },
                  icon(isStarred ? 'star-fill' : 'star')
                ),
              ]),
            ]),
            snippet && m('.mail-card-snippet', snippet),
            tags.length > 0 &&
              m(
                '.mail-card-tags',
                tags.map((tagId) => {
                  const tag = getTagDetails(tagId);
                  return m(
                    'span.mail-card-tag-badge',
                    {
                      title: tag.name,
                      style: { '--tag': tag.color },
                    },
                    [m('span.mail-card-tag-dot'), tag.name]
                  );
                })
              ),
          ]),
        ]
      );
    },
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
        toast.info(`File is ${status.retval ? 'being' : 'already'} downloaded!`)
    ).catch((error) => { });
  }
  return {
    view: (v) =>
      m('.attachments-wrapper', [
        v.attrs.files.map((file) => {
          const fileSizeNum = file.size ? (typeof file.size === 'object' ? file.size.xint64 || parseInt(file.size.xstr64) || 0 : Number(file.size) || 0) : 0;
          return m('.attachment-card', [
            m('.attachment-icon', icon('paperclip')),
            m('.attachment-info', [
              m('.attachment-name', file.fname),
              m('.attachment-size', humanReadableSize(fileSizeNum)),
            ]),
            m('button.btn-attachment-download.is-primary',
              { onclick: () => handleAttachmentDownload(file) },
              [icon('download'), m('span.btn-text', ' Download')]
            ),
          ]);
        }),
      ]),
  };
};

const ReadingPanePlaceholder = {
  view: () =>
    m('.mail-reading-placeholder', [
      m('.mail-reading-placeholder__icon', icon('envelope-open-text')),
      m('h3.mail-reading-placeholder__title', 'Select an email to read'),
      m('p.mail-reading-placeholder__subtitle', 'Choose a message from the list to display its full content here.'),
    ]),
};

//  One recipient line. A broadcast can carry hundreds of addresses, so the
//  chips scroll in a box of their own, with the label fixed beside them,
//  rather than wrapping down the pane and pushing the message off the screen.
function recipientRow(label, keys) {
  if (!keys || keys.length === 0) return null;
  return m('.msg-recipients-row', [
    m('span.recipient-label', label),
    m('.msg-recipients-row__list', keys.map((addr) => {
      return m('span.recipient-chip', { title: addr }, identityLabel(addr));
    })),
    keys.length > 8 && m('span.msg-recipients-row__count', `${keys.length}`),
  ]);
}

const MessageView = () => {
  let showCompose = false;
  let composeType = 'reply';
  let isStarred = false;
  let isSpam = false;
  let currentMsgId = null;

  function setShowCompose(bool) {
    showCompose = bool;
  }

  const MailData = {
    msgId: '',
    message: '',
    subject: '',
    sender: {},
    avatar: null,
    recipients: [],
    toList: {},
    ccList: {},
    bccList: {},
    timeStamp: '',
    files: [],
    msgtags: [],
    msgflags: 0,
  };

  function loadMail(msgId) {
    if (!msgId) return;
    currentMsgId = msgId;
    MailData.msgId = msgId;
    MailData.files = [];
    MailData.toList = {};
    MailData.ccList = {};
    MailData.bccList = {};
    MailData.avatar = null;
    MailData.subject = '';
    MailData.message = '';
    MailData.sender = {};
    MailData.timeStamp = '';
    MailData.msgtags = [];
    MailData.msgflags = 0;

    markMessageRead(msgId);

    rs.rsJsonApiRequest('/rsMail/getMessage', { msgId }).then(async (res) => {
      if (res && res.body && res.body.retval) {
        const msgDetails = res.body.msg;
        msgDetails.msgflags &= ~(RS_MSG_NEW | RS_MSG_UNREAD_BY_USER);
        MessageCache[msgId] = msgDetails;
        MailData.msgId = msgDetails.msgId;
        MailData.sender = msgDetails.from;
        MailData.subject = subjectOf(msgDetails.title);
        MailData.timeStamp = msgDetails.ts;
        MailData.msgtags = msgDetails.msgtags || (MessageCache[msgId] && MessageCache[msgId].msgtags) || [];
        MailData.msgflags = msgDetails.msgflags || 0;
        isStarred = (msgDetails.msgflags & 0xf00) === RS_MSG_STAR;
        isSpam = Boolean(msgDetails.msgflags & RS_MSG_SPAM);

        MailData.files = [];
        (msgDetails.files || []).forEach((element) =>
          MailData.files.push({ ...element, from: msgDetails.from, ts: msgDetails.ts })
        );

        MailData.message = /<\/*[a-z][^>]+?>/gi.test(msgDetails.msg)
          ? msgDetails.msg
          : `<p style="white-space: pre-wrap; word-break: break-word; font-family: inherit;">${msgDetails.msg}</p>`;

        MailData.recipients = msgDetails.destinations || [];
        MailData.recipients.forEach((destDetail) => {
          const { _addr_string: addrString, _mode: mode } = destDetail;
          if (mode === MSG_ADDRESS_MODE_TO && !MailData.toList[addrString]) {
            MailData.toList[addrString] = destDetail;
          } else if (mode === MSG_ADDRESS_MODE_CC && !MailData.ccList[addrString]) {
            MailData.ccList[addrString] = destDetail;
          } else if (mode === MSG_ADDRESS_MODE_BCC && !MailData.bccList[addrString]) {
            MailData.bccList[addrString] = destDetail;
          }
          if (addrString && !UserNicknamesCache[addrString]) {
            rs.rsJsonApiRequest('/rsIdentity/getIdDetails', { id: addrString }, (data) => {
              if (data?.details) {
                UserNicknamesCache[addrString] = data.details.mNickname || '';
                MailGxsDetailsCache[addrString] = data.details;
                m.redraw();
              }
            });
          }
        });

        if (MailData.sender?._addr_string) {
          const sAddr = MailData.sender._addr_string;
          rs.rsJsonApiRequest('/rsIdentity/getIdDetails', { id: sAddr }, (data) => {
            if (data?.details) {
              MailData.avatar = data.details.mAvatar;
              UserNicknamesCache[sAddr] = data.details.mNickname || '';
              MailGxsDetailsCache[sAddr] = data.details;
              m.redraw();
            }
          });
        }
        m.redraw();
      }
    });
  }

  function toggleStar() {
    isStarred = !isStarred;
    rs.rsJsonApiRequest('/rsMail/MessageStar', { msgId: MailData.msgId, mark: isStarred }, () => {
      if (MessageCache[MailData.msgId]) {
        if (isStarred) MessageCache[MailData.msgId].msgflags |= RS_MSG_STAR;
        else MessageCache[MailData.msgId].msgflags &= ~RS_MSG_STAR;
      }
      triggerMessageUpdated(MailData.msgId, RS_MSG_STAR, isStarred);
      m.redraw();
    });
  }

  function toggleSpam() {
    isSpam = !isSpam;
    rs.rsJsonApiRequest('/rsMail/MessageJunk', { msgId: MailData.msgId, mark: isSpam }, () => {
      if (MessageCache[MailData.msgId]) {
        if (isSpam) MessageCache[MailData.msgId].msgflags |= RS_MSG_SPAM;
        else MessageCache[MailData.msgId].msgflags &= ~RS_MSG_SPAM;
      }
      triggerMessageUpdated(MailData.msgId, RS_MSG_SPAM, isSpam);
      toast.info(isSpam ? 'Marked as spam' : 'Removed from spam');
      m.redraw();
    });
  }

  function markUnread() {
    rs.rsJsonApiRequest('/rsMail/MessageRead', { msgId: MailData.msgId, unreadByUser: true }, () => {
      if (MessageCache[MailData.msgId]) {
        MessageCache[MailData.msgId].msgflags |= RS_MSG_UNREAD_BY_USER;
      }
      triggerMessageUpdated(MailData.msgId, RS_MSG_UNREAD_BY_USER, true);
      toast.info('Marked as unread');
      m.redraw();
    });
  }

  function deleteMail(vnode) {
    mailApi.deleteMessage(MailData.msgId).then((ok) => {
      toast.result(ok, 'Mail deleted.', 'Could not delete the mail.');
      if (vnode.attrs.onDeleted) {
        vnode.attrs.onDeleted(MailData.msgId);
      } else {
        m.route.set('/mail/:tab', { tab: m.route.param().tab || 'inbox' });
      }
    });
  }

  function confirmMailDelete(vnode) {
    widget.confirmMessage({
      title: 'Delete mail',
      message: 'This message will be removed from your node.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => deleteMail(vnode),
    });
  }

  return {
    oninit: (v) => {
      loadMail(v.attrs.msgId);
    },
    onupdate: (v) => {
      if (v.attrs.msgId && v.attrs.msgId !== currentMsgId) {
        loadMail(v.attrs.msgId);
      }
    },
    view: (v) => {
      const isDraft = isDraftMessage(MailData.msgflags);
      const senderAddr = isDraft
        ? draftSenderId(MailData.sender?._addr_string)
        : MailData.sender?._addr_string;
      const senderName = (senderAddr && identityLabel(senderAddr)) || '[Unknown]';
      const toKeys = Object.keys(MailData.toList || {});
      const ccKeys = Object.keys(MailData.ccList || {});
      const bccKeys = Object.keys(MailData.bccList || {});

      return m(
        '.msg-view.mail-reading-card',
        [
          m('.msg-view-nav', [
            m(widget.BackButton, {
              label: 'Back to messages',
              onclick: () => {
                if (v.attrs.onBack) v.attrs.onBack();
                else m.route.set('/mail/:tab', { tab: m.route.param().tab || 'inbox' });
              },
            }),
            //  A draft has not been sent, so there is nothing to reply to,
            //  forward, mark unread or flag as spam. Two actions apply to it:
            //  carry on writing, or throw it away.
            m('.msg-view-nav__action', isDraft
              ? [
                  m('button.mail-action-btn.is-primary', {
                    title: 'Continue writing this draft',
                    onclick: () => { composeType = 'draft'; setShowCompose(true); },
                  }, [icon('edit'), m('span.btn-text', ' Edit draft')]),
                  m('button.mail-action-btn.mail-action-btn--delete', {
                    title: 'Discard draft',
                    onclick: () => confirmMailDelete(v),
                  }, [icon('trash-alt'), m('span.btn-text', ' Discard')]),
                ]
              : [
              m('button.mail-action-btn', {
                title: 'Reply',
                onclick: () => { composeType = 'reply'; setShowCompose(true); },
              }, [icon('reply'), m('span.btn-text', ' Reply')]),
              m('button.mail-action-btn', {
                title: 'Forward',
                onclick: () => { composeType = 'forward'; setShowCompose(true); },
              }, [icon('forward'), m('span.btn-text', ' Forward')]),
              m('button.mail-action-btn', {
                title: 'Reply All',
                onclick: () => { composeType = 'replyAll'; setShowCompose(true); },
              }, [icon('reply-all'), m('span.btn-text', ' Reply All')]),
              m('button.mail-action-btn', {
                title: isStarred ? 'Unstar' : 'Star',
                class: isStarred ? 'mail-action-btn--starred' : '',
                onclick: toggleStar,
              }, [icon(isStarred ? 'star-fill' : 'star'), m('span.btn-text', isStarred ? ' Starred' : ' Star')]),
              m('button.mail-action-btn', {
                title: isSpam ? 'Remove from spam' : 'Mark as spam',
                class: isSpam ? 'mail-action-btn--spam' : '',
                onclick: toggleSpam,
              }, [icon(isSpam ? 'fire-fill' : 'fire'), m('span.btn-text', 'Spam')]),
              m('button.mail-action-btn', {
                title: 'Mark as unread',
                onclick: markUnread,
              }, [icon('envelope'), m('span.btn-text', ' Unread')]),
              m('button.mail-action-btn.mail-action-btn--delete', {
                title: 'Delete mail',
                onclick: () => confirmMailDelete(v),
              }, [icon('trash-alt'), m('span.btn-text', ' Delete')]),
            ]),
          ]),
          m('.msg-view__header', [
            m('.mail-reading-title-row', [
              m('h2.msg-view__title', MailData.subject),
              MailData.msgtags && MailData.msgtags.length > 0 &&
                m('.mail-reading-tags', MailData.msgtags.map((tagId) => {
                  const tag = getTagDetails(tagId);
                  return m('span.mail-card-tag-badge', {
                    title: tag.name,
                    style: { '--tag': tag.color },
                  }, [m('span.mail-card-tag-dot'), tag.name]);
                })),
            ]),
            m('.msg-details', [
              senderAddr &&
                m(peopleUtil.UserAvatar, {
                  avatar: MailData.avatar || identityDetails(senderAddr)?.mAvatar,
                  firstLetter: senderName,
                  identityId: senderAddr,
                  size: 46,
                }),
              m('.msg-details__info', [
                m('.msg-details__info-row', [
                  m(
                    '.msg-sender-name',
                    {
                      onmouseenter: (e) => {
                        if (!senderAddr) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        MailHoverState.hoveredUser = { gxsId: senderAddr, name: senderName, rect };
                        m.redraw();
                      },
                      onmouseleave: () => {
                        MailHoverState.hoveredUser = null;
                        m.redraw();
                      },
                    },
                    senderName
                  ),
                  MailData.timeStamp &&
                    m('.msg-timestamp', { title: new Date(MailData.timeStamp * 1000).toLocaleString() },
                      new Date(MailData.timeStamp * 1000).toLocaleString()
                    ),
                ]),
                //  Bcc is on own sent mail only.
                recipientRow('To:', toKeys),
                recipientRow('Cc:', ccKeys),
                recipientRow('Bcc:', bccKeys),
              ]),
            ]),
          ]),
          MailData.files && MailData.files.length > 0 &&
            m('.msg-view__attachment', [
              m('h4.attachments-title', [
                icon('paperclip'),
                m('span', `Attachments (${MailData.files.length})`),
              ]),
              m('.msg-view__attachment-items', m(AttachmentSection, { files: MailData.files })),
            ]),
          m('.msg-view__body', [
            m('.mail-body-container', m.trust(MailData.message || '<p class="mail-body-empty">(No message content)</p>')),
          ]),
          showCompose &&
            m(
              '.composePopupOverlay#mailComposerPopup',
              m(
                '.composePopup',
                senderAddr
                  ? m(compose, {
                      msgType: composeType,
                      senderId: senderAddr,
                      recipientList: MailData.toList,
                      ccList: MailData.ccList,
                      //  The prefix depends on the ACTION, not on whatever
                      //  prefix the subject already has: forwarding "Re: X"
                      //  must send "Fwd: Re: X", not "Re: X".
                      subject: composeType === 'draft'
                        ? MailData.subject
                        : composeType === 'forward'
                          ? (MailData.subject.startsWith('Fwd:') ? MailData.subject : `Fwd: ${MailData.subject}`)
                          : (MailData.subject.startsWith('Re:') ? MailData.subject : `Re: ${MailData.subject}`),
                      replyMessage: MailData.message,
                      timeStamp: new Date(MailData.timeStamp * 1000),
                      //  Only when resuming: saving then replaces this
                      //  draft instead of leaving a second copy behind.
                      draftMsgId: composeType === 'draft' ? MailData.msgId : undefined,
                      setShowCompose,
                    })
                  : m('.widget', m('.widget__heading', m('h3', 'Sender is not known'))),
                m('button.red.close-btn', {
                  onclick: () => compose.requestClose(() => setShowCompose(false)),
                }, icon('times'))
              )
            ),
          renderMailUserTooltip(),
        ]
      );
    },
  };
};

//  `column: null` is the unsorted state -- newest first, the order the core
//  hands the list back in.
const SortState = {
  column: 'date',
  direction: 'desc',
};

//  Three clicks on one header: ascending, descending, off. Moving to another
//  header starts that cycle over, so a column is never picked up mid-way.
function setSort(column) {
  if (SortState.column !== column) {
    SortState.column = column;
    SortState.direction = 'asc';
    return;
  }
  if (SortState.direction === 'asc') {
    SortState.direction = 'desc';
    return;
  }
  SortState.column = null;
  SortState.direction = 'desc';
}

function sortList(list) {
  if (!list) return [];
  //  Unsorted: newest first, which is what the list looks like before anyone
  //  touches a header.
  if (!SortState.column) {
    return [...list].sort((msgA, msgB) => {
      const aTs = Number(MessageCache[msgA.msgId]?.ts || msgA.ts?.xint64 || msgA.ts || 0);
      const bTs = Number(MessageCache[msgB.msgId]?.ts || msgB.ts?.xint64 || msgB.ts || 0);
      return bTs - aTs;
    });
  }
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
      case 'spam': {
        const aSpam = Boolean((MessageCache[msgA.msgId]?.msgflags & RS_MSG_SPAM) || (msgA.msgflags & RS_MSG_SPAM));
        const bSpam = Boolean((MessageCache[msgB.msgId]?.msgflags & RS_MSG_SPAM) || (msgB.msgflags & RS_MSG_SPAM));
        valA = aSpam ? 1 : 0;
        valB = bSpam ? 1 : 0;
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
      case 'tags': {
        const firstTag = (msg) => {
          const tags = MessageCache[msg.msgId]?.msgtags || msg.msgtags || [];
          return tags.length ? getTagDetails(tags[0]).name.toLowerCase() : '';
        };
        //  Untagged mail sorts last in both directions: it is the absence of
        //  the thing being sorted by, not the lowest value of it.
        valA = firstTag(msgA) || '\uffff';
        valB = firstTag(msgB) || '\uffff';
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
        //  A caret for the direction, `arrows-down-up` when idle. The
        //  sort-ascending/descending glyphs are bars-plus-arrow, too busy to
        //  read at 12px; colour is what says "this is the sorted column".
        const iconClass = isActive
          ? (SortState.direction === 'asc' ? 'sort-up' : 'sort-down')
          : 'sort';
        const next = !isActive ? 'ascending'
          : SortState.direction === 'asc' ? 'descending' : 'unsorted';
        return m(
          `th.sortable-th.col-${colName}`,
          {
            onclick: () => setSort(colName),
            title: `Sort ${next}`,
            'aria-sort': isActive
              ? (SortState.direction === 'asc' ? 'ascending' : 'descending')
              : 'none',
          },
          //  One row, always: the label and its sort glyph beside it. Without
          //  the wrapper the glyph fell to a second line in the two icon-only
          //  columns, since a `th` is not a flex container.
          m('.sortable-th__inner', [
            isIcon ? label : m('span', label),
            icon(iconClass, { class: isActive ? 'sort-glyph is-active' : 'sort-glyph' }),
          ])
        );
      };

      let totalItems = 0;
      const tbody = v.children[0];
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

      //  `.pagination` is already styled inside .table-pagination-container,
      //  so nothing is spelled inline here. A disabled button already looks
      //  disabled, too.
      const paginationUI = totalItems > pageSize && m('.pagination', [
        m('button.is-icon[type=button][aria-label=Previous page]', {
          disabled: currentPage === 0,
          onclick: () => currentPage--,
        }, icon('chevron-left')),
        m('span.pagination__range',
          `${totalItems > 0 ? currentPage * pageSize + 1 : 0} - ${Math.min((currentPage + 1) * pageSize, totalItems)} of ${totalItems}`),
        m('button.is-icon[type=button][aria-label=Next page]', {
          disabled: currentPage >= totalPages - 1,
          onclick: () => currentPage++,
        }, icon('chevron-right'))
      ]);

      //  Drafts cannot be starred or marked as spam, so in that folder the two
      //  columns are dropped rather than left as headers over blank cells.
      const hideJudgements = v.attrs.category === 'drafts';

      return m('.table-pagination-container', [
        m('table.mails', [
          m('tr', [
            !hideJudgements && renderHeader('starred', icon('star'), true),
            renderHeader('attachments', icon('paperclip'), true),
            renderHeader('subject', 'Subject'),
            renderHeader('from', 'From'),
            !hideJudgements && renderHeader('spam', icon('fire'), true),
            renderHeader('date', 'Date & time'),
            renderHeader('tags', 'Tags'),
            m('th.col-spacer'),
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
      m(widget.SearchField, {
        placeholder: 'Search subject',
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

//  Folder glyphs inherit the link's colour, so the selected folder is the only
//  coloured thing in the column. A colour per folder would make it read as a
//  legend rather than a list of places, and leave selection nothing to say.
//
//  The five Quick View entries are tags, where the colour IS the data: those
//  keep it, taken from the tag the core defines rather than written here.
const folderIcons = {
  inbox: 'inbox',
  outbox: 'envelope-open-text',
  drafts: 'edit',
  sent: 'envelope-open',
  trash: 'trash-alt',
  starred: 'star',
  system: 'bell',
  spam: 'fire',
  attachment: 'paperclip',
};

const quickViewTagIds = {
  important: 1,
  work: 2,
  personal: 3,
  todo: 4,
  later: 5,
};

function sidebarIcon(panelName) {
  if (folderIcons[panelName]) {
    return icon(folderIcons[panelName], { class: 'sidebar-link-icon' });
  }
  const tagId = quickViewTagIds[panelName];
  if (!tagId) return null;
  return m('span.sidebar-link-swatch', {
    style: { backgroundColor: getTagDetails(tagId).color },
  });
}

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
              onclick: () => {
                activeSideLink.sideactive = index;
                activeSideLink.quicksideactive = -1;
                if (onNavigate) onNavigate();
              },
              href: baseRoute + panelName,
            },
            [
              sidebarIcon(panelName),
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
              onclick: () => {
                activeSideLink.quicksideactive = index;
                activeSideLink.sideactive = -1;
                if (onNavigate) onNavigate();
              },
              href: baseRoute + panelName,
            },
            [
              sidebarIcon(panelName),
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
  MessageCard,
  MessageView,
  ReadingPanePlaceholder,
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
  RS_MSG_DRAFT,
  RS_MSG_DRAFTBOX,
  isDraftMessage,
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
  markMessageRead,
  onMessageUpdated,
  triggerMessageUpdated,
  MessageCache,
  getTagDetails,
};
