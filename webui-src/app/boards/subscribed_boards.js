const m = require('mithril');
const util = require('boards/boards_util');

const Layout = () => {
  return {
    view: (v) => [
      m('.widget__heading', m('h3', 'Subscribed Boards')),
      m('.widget__body', [
        m(
          util.BoardTable,
          m('tbody', [
            v.attrs.list.map((board) =>
              m(util.BoardSummary, {
                details: board,
                category: 'SubscribedBoards',
              })
            ),
            v.attrs.list.map((board) =>
              m(util.DisplayBoardsFromList, {
                id: board.mGroupId,
                category: 'SubscribedBoards',
              })
            ),
          ])
        ),
      ]),
    ],
  };
};

module.exports = Layout;
