const m = require('mithril');
const util = require('forums/forums_util');

const Layout = () => {
  return {
    view: (v) => [
      m('.widget', [
        m('h3', 'Popular Forums'),
        m('hr'),
        m(
          util.Table,
          m(
            'tbody',
            [v.attrs.list.map((forum) =>
              m(util.ForumSummary, {
                details: forum,
                category: 'PopularForums',
              }),
            ),
            v.attrs.list.map((forum) =>
              m(util.DisplayForumsFromList, {
                id: forum.mGroupId,
                category: 'PopularForums',
              }),
            ),
          ]
          )
        ),
      ]),
    ],
  };
};

module.exports = Layout;

