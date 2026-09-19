const m = require('mithril');
const util = require('forums/forums_util');

//  The whole list, most popular first: the one section where a group is
//  listed whether or not the user is subscribed to it.
const Layout = () => {
  return {
    view: (v) => [
      m('.widget__body', [
        m(
          util.ForumTable,
          m('tbody', [
            v.attrs.list.map((forum) =>
              m(util.DisplayForumsFromList, {
                id: forum.mGroupId,
                details: forum,
                category: 'All',
              })
            ),
          ])
        ),
      ]),
    ],
  };
};

module.exports = Layout;
