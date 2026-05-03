const m = require('mithril');
const rs = require('rswebui');
const util = require('mail/mail_util');

const Layout = () => {
  let viewMode = localStorage.getItem('mailViewMode') || 'side';
  return {
    view: (v) => [
      m('.widget__heading', [
        m('h3', 'Inbox'),
        m('.mail-actions', [
          m('button', {
            title: 'Mark all as read',
            onclick: () => {
              v.attrs.list.forEach((msg) => {
                const flag = msg.msgflags & 0xf0;
                if (flag === 0x10 || flag === 0x20) { // RS_MSG_NEW or RS_MSG_UNREAD_BY_USER
                  rs.rsJsonApiRequest('/rsMail/MessageToTrash', { msgId: msg.msgId, bTrash: false });
                }
              });
              m.redraw();
            },
          }, m('i.fas.fa-envelope-open')),
        ]),
        m('.mail-view-toggle', [
          m('span', 'View:'),
          m('button', {
            class: viewMode === 'side' ? 'active' : '',
            onclick: () => {
              viewMode = 'side';
              localStorage.setItem('mailViewMode', 'side');
              m.redraw();
            },
            title: 'Side by side',
          }, m('i.fas.fa-columns')),
          m('button', {
            class: viewMode === 'below' ? 'active' : '',
            onclick: () => {
              viewMode = 'below';
              localStorage.setItem('mailViewMode', 'below');
              m.redraw();
            },
            title: 'Below',
          }, m('i.fas.fa-list')),
        ]),
      ]),
      m('.widget__body', {
        class: 'mail-layout-' + viewMode,
      }, [
        m(
          util.Table,
          m(
            'tbody',
            v.attrs.list.map((msg) =>
              m(util.MessageSummary, {
                details: msg,
                category: 'inbox',
              })
            )
          )
        ),
      ]),
    ],
  };
};

module.exports = Layout;
