const m = require('mithril');
const rs = require('rswebui');
const util = require('files/files_util');
const widget = require('widgets');
const peopleUtil = require('people/people_util');

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
  return {
    oninit: async (v) => {
      const res = await rs.rsJsonApiRequest('/rsMsgs/getMessage', {
        msgId: v.attrs.details.msgId,
      });
      if (res.body.retval) {
        details = res.body.msg;
        files = details.files;

        isStarred = (details.msgflags & 0xf00) === RS_MSG_STAR;

        const flag = details.msgflags & 0xf0;
        if (flag === RS_MSG_NEW || flag === RS_MSG_UNREAD_BY_USER) {
          msgStatus = 'unread';
        } else {
          msgStatus = 'read';
        }
      }
      if (details && details.from && details.from._addr_string) {
        rs.rsJsonApiRequest(
          '/rsIdentity/getIdDetails',
          {
            id: details.from._addr_string,
          },
          (data) => {
            fromUserInfo = data.details;
          }
        );
      }
    },
    view: (v) =>
      m(
        'tr.msgbody',
        {
          key: details.msgId,
          class: msgStatus,
          onclick: () =>
            m.route.set('/mail/:tab/:msgId', {
              tab: v.attrs.category,
              msgId: details.msgId,
            }),
        },
        [
          m(
            'td',
            m('input.star-check[type=checkbox][id=msg-' + details.msgId + ']', {
              checked: isStarred,
            }),
            // Use label with  [for] to manipulate hidden checkbox
            m(
              'label.star-check[for=msg-' + details.msgId + ']',
              {
                onclick: (e) => {
                  isStarred = !isStarred;
                  rs.rsJsonApiRequest('/rsMsgs/MessageStar', {
                    msgId: details.msgId,
                    mark: isStarred,
                  });
                  // Stop event bubbling, both functions for supporting IE & FF
                  e.stopImmediatePropagation();
                  e.preventDefault();
                },
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
          v.attrs.files.map((item) =>
            m('tr.attachment', [
              m('td.attachment__name', [m('i.fas.fa-file'), m('span', item.fname)]),
              m(
                'td.attachment__from',
                rs.userList.userMap[item.from._addr_string]
                  ? rs.userList.userMap[item.from._addr_string]
                  : '[Unknown]'
              ),
              m('td.attachment__size', humanReadableSize(item.size.xint64)),
              m('td.attachment__date', new Date(item.ts * 1000).toLocaleString()),
              m(
                'td',
                m(
                  'button',
                  {
                    onclick: () => {
                      try {
                        rs.rsJsonApiRequest(
                          '/rsFiles/FileRequest',
                          {
                            fileName: item.fname,
                            hash: item.hash,
                            flags: util.RS_FILE_REQ_ANONYMOUS_ROUTING,
                            size: {
                              xstr64: item.size.xstr64,
                            },
                          },
                          (status) => {
                            status.retval
                              ? widget.popupMessage([
                                  m('i.fas.fa-file-medical'),
                                  m('h3', 'File is being downloaded!'),
                                ])
                              : widget.popupMessage([
                                  m('i.fas.fa-file-medical'),
                                  m('h3', 'File is already downloaded!'),
                                ]);
                          }
                        );
                      } catch (error) {
                        console.log('error: ', error);
                      }
                    },
                  },
                  'Download'
                )
              ),
            ])
          )
        ),
      ]),
  };
};

const MessageView = () => {
  let details = {};
  let message = '';
  const files = [];
  const toList = {};
  const ccList = {};
  const bccList = {};

  return {
    oninit: async (v) => {
      const res = await rs.rsJsonApiRequest('/rsMsgs/getMessage', {
        msgId: v.attrs.id,
      });
      if (res.body.retval) {
        details = res.body.msg;
        res.body.msg.files.forEach((element) => {
          files.push({ ...element, from: res.body.msg.from, ts: res.body.msg.ts });
        });
        // regex to detect html tags
        // better regex?  /<[a-z][\s\S]*>/gi
        message = /<\/*[a-z][^>]+?>/gi.test(details.msg)
          ? details.msg
          : `<p style="white-space: pre">${details.msg}</p>`;
      }
      details?.destinations?.map((destDetail) => {
        if (destDetail._mode === MSG_ADDRESS_MODE_TO && !toList[destDetail._addr_string]) {
          toList[destDetail._addr_string] = destDetail;
        } else if (destDetail._mode === MSG_ADDRESS_MODE_CC && !ccList[destDetail._addr_string]) {
          ccList[destDetail._addr_string] = destDetail;
        } else if (destDetail._mode === MSG_ADDRESS_MODE_BCC && !bccList[destDetail._addr_string]) {
          bccList[destDetail._addr_string] = destDetail;
        }
      });
      await rs.rsJsonApiRequest(
        '/rsIdentity/getIdDetails',
        {
          id: details.from._addr_string,
        },
        (data) => (details = { ...details, avatar: data.details.mAvatar })
      );
    },
    view: () =>
      m(
        '.msg-view',
        {
          key: details.msgId,
        },
        [
          m('.msg-view-nav', [
            m(
              'a[title=Back]',
              {
                onclick: () =>
                  m.route.set('/mail/:tab', {
                    tab: m.route.param().tab,
                  }),
              },
              m('i.fas.fa-arrow-left')
            ),
            m('.msg-view-nav__action', [
              m('button', 'Reply'),
              m('button', 'Reply All'),
              m('button', 'Forward'),
              m(
                'button',
                {
                  onclick: () =>
                    widget.popupMessage([
                      m('p', 'Are you sure you want to delete this mail?'),
                      m(
                        'button',
                        {
                          onclick: async () => {
                            rs.rsJsonApiRequest('/rsMsgs/MessageToTrash', {
                              msgId: details.msgId,
                              bTrash: true,
                            });
                            const res = await rs.rsJsonApiRequest('/rsMsgs/MessageDelete', {
                              msgId: details.msgId,
                            });
                            res.body.retval
                              ? widget.popupMessage([
                                  m('h3', 'Success'),
                                  m('hr'),
                                  m('p', 'Mail Deleted.'),
                                ])
                              : widget.popupMessage([
                                  m('h3', 'Error'),
                                  m('hr'),
                                  m('p', res.body.errorMessage),
                                ]);
                            m.redraw();
                            m.route.set('/mail/:tab', {
                              tab: m.route.param().tab,
                            });
                          },
                        },
                        'Delete'
                      ),
                    ]),
                },
                'Delete'
              ),
            ]),
          ]),
          m('.msg-view__header', [
            m('h3', details.title),
            m('.msg-details', [
              details.from &&
                m(peopleUtil.UserAvatar, {
                  avatar: details.avatar,
                  firstLetter: rs.userList.userMap[details.from._addr_string]
                    ? rs.userList.userMap[details.from._addr_string].slice(0, 1).toUpperCase()
                    : '',
                }),
              m('.msg-details__info', [
                details.from &&
                  m('.msg-details__info-item', [
                    m('b', 'From: '),
                    rs.userList.userMap[details.from._addr_string] || 'Unknown',
                  ]),
                toList &&
                  Object.keys(toList).length > 0 &&
                  // TODO: optimize javascript for show-more and show-less working
                  m('.msg-details__info-item', [
                    m('b', 'To: '),
                    m(
                      '#truncate',
                      Object.keys(toList).map((key, index) =>
                        m('span', `${rs.userList.userMap[key]}, `)
                      )
                    ),
                    m(
                      'button[id=show-more]',
                      {
                        style: {
                          display: Object.keys(toList).length > 10 ? 'block' : 'none',
                        },
                        onclick: () => {
                          document.querySelector('#show-more').style.display = 'none';
                          document.querySelector('#truncate').style.height = '6rem';
                          document.querySelector('#truncate').style.overflow = 'auto';
                          document.querySelector('#show-less').style.display = 'block';
                        },
                      },
                      '...'
                    ),
                    m(
                      'button[id=show-less][style="display: none;"]',
                      {
                        onclick: () => {
                          document.querySelector('#show-more').style.display = 'block';
                          document.querySelector('#truncate').style.height = '1.75rem';
                          document.querySelector('#truncate').style.overflow = 'hidden';
                          document.querySelector('#show-less').style.display = 'none';
                        },
                      },
                      'less'
                    ),
                  ]),
                ccList &&
                  Object.keys(ccList).length > 0 &&
                  m('.msg-details__info-item', [
                    m('b', 'CC: '),
                    Object.keys(ccList).map((key, index) =>
                      m('p', `${rs.userList.userMap[key]}, `)
                    ),
                  ]),
                bccList &&
                  Object.keys(bccList).length > 0 &&
                  m('.msg-details__info-item', [
                    m('b', 'BCC: '),
                    Object.keys(bccList).map((key, index) =>
                      m('p', `${rs.userList.userMap[key]}, `)
                    ),
                  ]),
              ]),
            ]),
          ]),
          m(
            '.msg-view__body',
            m(
              'iframe[title=message]',
              {
                srcdoc: message,
              },
              message
            )
          ),
          files.length > 0 &&
            m('.msg-view__attachment', [
              m('h3', 'Attachments'),
              m('.msg-view__attachment-items', [
                m(AttachmentSection, {
                  files,
                }),
              ]),
            ]),
        ]
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
    view: (v) =>
      m('input[type=text][placeholder=Search Subject].searchbar', {
        value: searchString,
        oninput: (e) => {
          searchString = e.target.value.toLowerCase();
          for (const hash in v.attrs.list) {
            if (v.attrs.list[hash].fname.toLowerCase().indexOf(searchString) > -1) {
              v.attrs.list[hash].isSearched = true;
            } else {
              v.attrs.list[hash].isSearched = false;
            }
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
    view: (v) =>
      m(
        '.sidebar',
        v.attrs.tabs.map((panelName, index) =>
          m(
            m.route.Link,
            {
              class: index === activeSideLink.sideactive ? 'selected-sidebar-link' : '',
              onclick: () => {
                activeSideLink.sideactive = index;
                activeSideLink.quicksideactive = -1;
              },
              href: v.attrs.baseRoute + panelName,
            },
            v.attrs.size[panelName] > 0
              ? panelName + ' (' + v.attrs.size[panelName] + ')'
              : panelName
          )
        )
      ),
  };
};

const SidebarQuickView = () => {
  // for the Mail tab, to be moved later.
  return {
    view: (v) =>
      m(
        '.sidebarquickview',
        m('h6.bold', 'Quick View'),
        v.attrs.tabs.map((panelName, index) =>
          m(
            m.route.Link,
            {
              class:
                index === activeSideLink.quicksideactive ? 'selected-sidebarquickview-link' : '',
              onclick: () => {
                activeSideLink.quicksideactive = index;
                activeSideLink.sideactive = -1;
              },
              href: v.attrs.baseRoute + panelName,
            },
            v.attrs.size[panelName] > 0
              ? panelName + ' (' + v.attrs.size[panelName] + ')'
              : panelName
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
