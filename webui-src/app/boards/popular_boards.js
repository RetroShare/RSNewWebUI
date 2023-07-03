const m = require('mithril');
const util = require('boards/boards_util');

const Layout = () => {
  return {
    view: (v) => [
      m('.widget__heading', m('h3', 'Popular Boards')),
      m('.widget__body', [
        m(
          util.BoardTable,
          m('tbody', [
            v.attrs.list.map((board) =>
              m(util.BoardSummary, {
                details: board,
                category: 'PopularBoards',
              })
            ),
            v.attrs.list.map((board) =>
              m(util.DisplayBoardsFromList, {
                id: board.mGroupId,
                category: 'PopularBoards',
              })
            ),
          ])
        ),
      ]),
    ],
  };
};

module.exports = Layout;
