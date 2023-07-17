const m = require('mithril');
const rs = require('rswebui');
const util = require('files/files_util');
const widget = require('widgets');
const peopleUtil = require('people/people_util');
const compose = require('mail/mail_compose');

// rsmsgs.h
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
    rs.rsJsonApiRequest('/rsMsgs/MessageStar', { msgId: details.msgId, mark: isStarred });
    // Stop event bubbling, both functions for supporting IE & FF
    e.stopImmediatePropagation();
    e.preventDefault();
  }
  return {
    oninit: (v) => {
      rs.rsJsonApiRequest('/rsMsgs/getMessage', {
        msgId: v.attrs.details.msgId,
      })
        .then((res) => {
          if (res.body.retval) {
            details = res.body.msg;
            files = details.files;
            isStarred = (details.msgflags & 0xf00) === RS_MSG_STAR;
            const flag = details.msgflags & 0xf0;
            msgStatus = flag === RS_MSG_NEW || flag === RS_MSG_UNREAD_BY_USER ? 'unread' : 'read';
          }
        })
        .then(() => {
          if (details?.from?._addr_string) {
            rs.rsJsonApiRequest(
              '/rsIdentity/getIdDetails',
              { id: details.from._addr_string },
              (data) => (fromUserInfo = data.details)
            );
          }
        });
    },
    view: (v) =>
      m(
        'tr.msgbody',
        {
          key: details.msgId,
          class: msgStatus,
          onclick: () =>
            m.route.set('/mail/:tab/:msgId', { tab: v.attrs.category, msgId: details.msgId }),
        },
        [
          m(
            'td',
            m(`input.star-check[type=checkbox][id=msg-${details.msgId}]`, { checked: isStarred }),
            // Use label with  [for] to manipulate hidden checkbox
            m(
              `label.star-check[for=msg-${details.msgId}]`,
              {
                onclick: starMessage,
                class: (details.msgflags & 0xf00) === RS_MSG_STAR ? 'starred' : 'unstarred',
              },
              m('i.fas.fa-star')
            )
          ),
          files && m('td', files.length),
          m('td', details.title),
          m(
            'td',
            fromUserInfo && Number(fromUserInfo.mId) !== 0 ? fromUserInfo.mNickname : '[Unknown]'
          ),
          m('td', new Date(details.ts * 1000).toLocaleString()),
        ]
      ),
  };
};

const AttachmentSection = () => {
  function handleAttachmentDownload(item) {
    const { fname: fileName, hash, size: xstr64 } = item;
    const flags = util.RS_FILE_REQ_ANONYMOUS_ROUTING;
    rs.rsJsonApiRequest(
      '/rsFiles/FileRequest',
      { fileName, hash, flags, size: { xstr64 } },
      (status) =>
        widget.popupMessage([
          m('i.fas.fa-file-medical'),
          m('h3', `File is ${status.retval ? 'being' : 'already'} downloaded!`),
        ])
    ).catch((error) => console.log('error: ', error));
  }
  return {
    view: (v) =>
      m('table.attachment-container', [
        m('tr.attachment-header', [
          m('th', 'File Name'),
          m('th', 'From'),
          m('th', 'Size'),
          m('th', 'Date'),
          m('th', 'Download'),
        ]),
        m(
          'tbody',
          v.attrs.files.map((file) =>
            m('tr.attachment', [
              m('td.attachment__name', [m('i.fas.fa-file'), m('span', file.fname)]),
              m('td.attachment__from', rs.userList.userMap[file.from._addr_string] || '[Unknown]'),
              m('td.attachment__size', humanReadableSize(file.size.xint64)),
              m('td.attachment__date', new Date(file.ts * 1000).toLocaleString()),
              m('td', m('button', { onclick: () => handleAttachmentDownload(file) }, 'Download')),
            ])
          )
        ),
      ]),
  };
};

const MessageView = () => {
  let showReplyCompose = false;
  const MailData = {
    msgId: '',
    message: '',
    subject: '',
    sender: {},
    recipients: [],
    toList: {},
    ccList: {},
    bccList: {},
    files: [],
  };
  function deleteMail() {
    rs.rsJsonApiRequest('/rsMsgs/MessageToTrash', { msgId: MailData.msgId, bTrash: true });
    rs.rsJsonApiRequest('/rsMsgs/MessageDelete', { msgId: MailData.msgId }).then((res) => {
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
      const res = await rs.rsJsonApiRequest('/rsMsgs/getMessage', {
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
        MailData.sender = msgDetails.from;
        MailData.subject = msgDetails.title;
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
        });
        rs.rsJsonApiRequest(
          '/rsIdentity/getIdDetails',
          { id: MailData?.sender?._addr_string },
          (data) => (MailData.avatar = data?.details?.mAvatar)
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
              m('button', { onclick: () => (showReplyCompose = true) }, 'Reply'),
              m('button', 'Reply All'),
              m('button', 'Forward'),
              m('button', { onclick: confirmMailDelete }, 'Delete'),
            ]),
          ]),
          m('.msg-view__header', [
            m('h3', MailData.subject),
            m('.msg-details', [
              MailData.sender &&
                m(peopleUtil.UserAvatar, {
                  avatar: MailData.avatar,
                  firstLetter: rs.userList.userMap[MailData.sender._addr_string]
                    ? rs.userList.userMap[MailData.sender._addr_string].slice(0, 1).toUpperCase()
                    : '',
                }),
              m('.msg-details__info', [
                MailData.sender &&
                  m('.msg-details__info-item', [
                    m('b', 'From: '),
                    rs.userList.userMap[MailData.sender._addr_string] || 'Unknown',
                  ]),
                m('.msg-details__info-item', [
                  m('b', 'To: '),
                  MailData.toList && Object.keys(MailData.toList).length > 0
                    ? [
                        m('#truncate.truncated-view', [
                          Object.keys(MailData.toList).map((key, index) =>
                            m('span', { key: index }, `${rs.userList.userMap[key]}, `)
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
                      m('p', { key: index }, `${rs.userList.userMap[key]}, `)
                    ),
                  ]),
                MailData.bccList &&
                  Object.keys(MailData.bccList).length > 0 &&
                  m('.msg-details__info-item', [
                    m('b', 'Bcc: '),
                    Object.keys(MailData.bccList).map((key, index) =>
                      m('p', { key: index }, `${rs.userList.userMap[key]}, `)
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
        m(
          '.composePopupOverlay',
          { style: { display: showReplyCompose ? 'block' : 'none' } },
          m(
            '.composePopup',
            MailData.sender._addr_string
              ? m(compose, {
                  msgType: 'reply',
                  senderId: MailData.sender._addr_string,
                  recipientList: MailData.toList,
                  subject: MailData.subject,
                  replyMessage: MailData.message,
                })
              : m('.widget', m('.widget__heading', m('h3', 'Sender is not known'))),
            m(
              'button.red.close-btn',
              { onclick: () => (showReplyCompose = false) },
              m('i.fas.fa-times')
            )
          )
        )
      ),
  };
};

const Table = () => {
  return {
    view: (v) =>
      m('table.mails', [
        m('tr', [
          m('th[title=starred]', m('i.fas.fa-star')),
          m('th[title=attachments]', m('i.fas.fa-paperclip')),
          m('th', 'Subject'),
          m('th', 'From'),
          m('th', 'Date'),
        ]),
        v.children,
      ]),
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

const Sidebar = () => {
  return {
    view: ({ attrs: { tabs, baseRoute, size } }) =>
      m(
        '.sidebar',
        tabs.map((panelName, index) =>
          m(
            m.route.Link,
            {
              class: index === activeSideLink.sideactive ? 'selected-sidebar-link' : '',
              onclick: () => {
                activeSideLink.sideactive = index;
                activeSideLink.quicksideactive = -1;
              },
              href: baseRoute + panelName,
            },
            size[panelName] > 0 ? `${panelName} (${size[panelName]})` : panelName
          )
        )
      ),
  };
};

const SidebarQuickView = () => {
  // for the Mail tab, to be moved later.
  return {
    view: ({ attrs: { tabs, baseRoute, size } }) =>
      m(
        '.sidebarquickview',
        m('h6.bold', 'Quick View'),
        tabs.map((panelName, index) =>
          m(
            m.route.Link,
            {
              class:
                index === activeSideLink.quicksideactive ? 'selected-sidebarquickview-link' : '',
              onclick: () => {
                activeSideLink.quicksideactive = index;
                activeSideLink.sideactive = -1;
              },
              href: baseRoute + panelName,
            },
            size[panelName] > 0 ? `${panelName} (${size[panelName]})` : panelName
          )
        )
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
