const m = require('mithril');
const util = require('mail/mail_util');

const Layout = () => {
  let visibleCount = 50;
  return {
    view: (v) => [
      m('.widget__heading', m('h3', v.attrs.heading || 'Messages')),
      m('.widget__body', [
        m(
          util.Table,
          m(
            'tbody',
            v.attrs.list.slice(0, visibleCount).map((msg) =>
              m(util.MessageSummary, {
                details: msg,
                category: v.attrs.category || 'inbox',
              })
            )
          )
        ),
        visibleCount < v.attrs.list.length &&
          m(
            'button',
            {
              onclick: () => (visibleCount += 50),
              style: 'margin-top:0.5rem;display:block;',
            },
            `Load More (${v.attrs.list.length - visibleCount} remaining)`
          ),
      ]),
    ],
  };
};

module.exports = Layout;