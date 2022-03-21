const m = require('mithril');
const rs = require('rswebui');

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
const RS_MSGTAGTYPE_WORK      = 2;
const RS_MSGTAGTYPE_PERSONAL  = 3;
const RS_MSGTAGTYPE_TODO      = 4;
const RS_MSGTAGTYPE_LATER     = 5;
const RS_MSG_USER_REQUEST = 0x000400;
const RS_MSG_FRIEND_RECOMMENDATION = 0x000800;
const RS_MSG_PUBLISH_KEY = 0x020000;
const RS_MSG_SYSTEM = (RS_MSG_USER_REQUEST | RS_MSG_FRIEND_RECOMMENDATION | RS_MSG_PUBLISH_KEY);

const MessageSummary = () => {
  let details = {};
  let files = [];
  let isStarred = undefined;
  let msgStatus = '';
  let fromUserInfo = {};
  return {
    oninit: (v) => {
      rs.rsJsonApiRequest(
        '/rsMsgs/getMessage',
        {
          msgId: v.attrs.details.msgId,
        },
        (data) => {
          details = data.msg;
          files = details.files;

          isStarred = (details.msgflags & 0xf00) === RS_MSG_STAR;

          const flag = details.msgflags & 0xf0;
          if (flag === RS_MSG_NEW || flag === RS_MSG_UNREAD_BY_USER) {
            msgStatus = 'unread';
          } else {
            msgStatus = 'read';
          }
        }
      ),
        rs.rsJsonApiRequest(
          '/rsIdentity/getIdDetails',
          {
            id: details.rsgxsid_srcId || details.rspeerid_srcId,
          },
          (data) => {
            fromUserInfo = data.details;
            // console.log(data, details.rsgxsid_srcId, details.rspeerid_srcId);
            // console.log(fromUserInfo);
          }
        );
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
          m('td', files.length),
          m('td', details.title),
          m('td', Number(details.rsgxsid_srcId) === 0 ? '[Unknown]' : fromUserInfo.mNickname),
          m('td', new Date(details.ts * 1000).toLocaleString()),
        ]
      ),
  };
};

const MessageView = () => {
  let details = {};
  let message = '';
  return {
    oninit: (v) =>
      rs.rsJsonApiRequest(
        '/rsMsgs/getMessage',
        {
          msgId: v.attrs.id,
        },
        (data) => {
          details = data.msg;
          // regex to detect html tags
          // better regex?  /<[a-z][\s\S]*>/gi
          if (/<\/*[a-z][^>]+?>/gi.test(details.msg)) {
            message = details.msg;
          } else {
            message = '<p style="white-space: pre">' + details.msg + '</p>';
          }
        }
      ),
    view: (v) =>
      m(
        '.widget.msgview',
        {
          key: details.msgId,
        },
        [
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
          m('h3', details.title),
          m('hr'),
          m(
            'iframe[title=message].msg',
            {
              srcdoc: message,
            },
            message
          ),
        ]
      ),
  };
};

const Table = () => {
  return {
    oninit: (v) => {},
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
      m('input[type=text][id=searchmail][placeholder=Search Subject].searchbar', {
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
function popupMessageCompose(message) {
  const container = document.getElementById('modal-container');
  container.style.display = 'block';
  m.render(
    container,
    m('.modal-content[id=composepopup]', [
      m(
        'button.red',
        {
          onclick: () => (container.style.display = 'none'),
        },
        m('i.fas.fa-times')
      ),
      message,
    ])
  );
}
module.exports = {
  MessageSummary,
  MessageView,
  Table,
  SearchBar,
  popupMessageCompose,
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
  RS_MSGTAGTYPE_WORK
};
