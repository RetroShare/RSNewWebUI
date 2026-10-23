const m = require('mithril');
const util = require('boards/boards_util');

//  The whole list, most popular first: the one section where a group is
//  listed whether or not the user is subscribed to it.
const Layout = () => {
  return {
    view: (v) => [
      m('.widget__body', [
        m(
          util.BoardTable,
          m('tbody', [
            v.attrs.list &&
              v.attrs.list.map((board) =>
                m(util.BoardSummary, {
                  key: board.mGroupId,
                  details: board,
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
