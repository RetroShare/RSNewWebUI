const m = require('mithril');
const util = require('mail/mail_util');

const Layout = () => {
  let viewMode = localStorage.getItem('mailViewMode') || 'side';
  return {
    view: (v) => [
      m('.widget__heading', [
        m('h3', 'Inbox'),
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
