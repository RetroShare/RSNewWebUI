const m = require('mithril');

const util = require('mail/mail_util');

const Layout = () => {
  return {
    view: (v) => [
      m('.widget__heading', m('h3', 'Draft')),
      m('.widget__body', [
        m(
          util.Table,
          m(
            'tbody',
            v.attrs.list.map((msg) =>
              m(util.MessageSummary, {
                details: msg,
                category: 'drafts',
              })
            )
          )
        ),
      ]),
    ],
  };
};

module.exports = Layout;
