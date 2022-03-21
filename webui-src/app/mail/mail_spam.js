const m = require('mithril');
const util = require('mail/mail_util');

const Layout = () => {
  return {
    view: (v) => [
      m('.widget', [
        m('h3', 'Spam'),
        m('hr'),
        m(
          util.Table,
          m(
            'tbody',
            v.attrs.list.map((msg) =>
              m(util.MessageSummary, {
                details: msg,
                category: 'spam',
              })
            )
          )
        ),
      ]),
    ],
  };
};

module.exports = Layout;
