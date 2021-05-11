const m = require('mithril');
const util = require('mail/mail_util');

const Layout = () => {
  return {
    view: (v) => [
      m('.widget .', [
        m('h3', 'Inbox'),
        m('hr'),
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
