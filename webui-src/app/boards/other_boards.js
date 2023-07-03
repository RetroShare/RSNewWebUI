const m = require('mithril');
const util = require('boards/boards_util');

const Layout = () => {
  return {
    view: (v) => [
      m('.widget__heading', m('h3', 'Other Boards')),
      m('.widget__body', [
        m(
          util.BoardTable,
          m('tbody', [
            v.attrs.list.map((board) =>
              m(util.BoardSummary, {
                details: board,
                category: 'OtherBoards',
              })
            ),
            v.attrs.list.map((board) =>
              m(util.DisplayBoardsFromList, {
                id: board.mGroupId,
                category: 'OtherBoards',
              })
            ),
          ])
        ),
      ]),
    ],
  };
};

module.exports = Layout();
