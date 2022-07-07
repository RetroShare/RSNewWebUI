const m = require('mithril');
const widget = require('widgets');
const rs = require('rswebui');
const util = require('boards/boards_util');
const viewUtil = require('boards/board_view');

const getBoards =
{
  All : [],
  PopularBoards : [],
  SubscribedBoards : [],
  MyBoards : [],
  async load(){
    const res = await rs.rsJsonApiRequest('/rsPosted/getBoardsSummaries');
    const data = res.body;
    getBoards.All = data.groupInfo;
    getBoards.PopularBoards = getBoards.All;
    getBoards.SubscribedBoards = getBoards.All.filter(
        (board) => 
          board.mSubscribeFlags === util.GROUP_SUBSCRIBE_SUBSCRIBED
    );
    getBoards.MyBoards = getBoards.All.filter(
        (board) => board.mSubscribeFlags === util.GROUP_MY_BOARD
    );
  },
};

const sections = {
  MyBoards: require('boards/my_boards'),
  SubscribedBoards: require('boards/subscribed_boards'),
  PopularBoards: require('boards/popular_boards'),
  OtherBoards: require('boards/other_boards')
};

const Layout = {
  oninit : () => {
    rs.setBackgroundTask(getBoards.load, 5000, () => {
    });
  },
  // onupdate: getBoards.load,
  view: (vnode) =>
    m('.tab-page', [
      Object.prototype.hasOwnProperty.call(vnode.attrs.pathInfo, 'mMsgId')
          ? ''
          : Object.prototype.hasOwnProperty.call(vnode.attrs.pathInfo, 'mGroupId')
          ? m(util.SearchBar, {
            category: 'posts',
            boardId: vnode.attrs.pathInfo.mGroupId
          })
          : m(util.SearchBar, {
            category: 'boards'
          }),
      m(widget.Sidebar, {
        tabs: Object.keys(sections),
        baseRoute: '/boards/',
      }),
      m('.board-node-panel', 
        Object.prototype.hasOwnProperty.call(vnode.attrs.pathInfo, 'mMsgId')
          ? m(viewUtil.PostView, {
              msgId: vnode.attrs.pathInfo.mMsgId,
              boardId: vnode.attrs.pathInfo.mGroupId,
            })
          : Object.prototype.hasOwnProperty.call(vnode.attrs.pathInfo, 'mGroupId')
          ? m(viewUtil.BoardView, {
              id: vnode.attrs.pathInfo.mGroupId,
            })
          : m(sections[vnode.attrs.pathInfo.tab], {
              list: getBoards[vnode.attrs.pathInfo.tab],
            })
      ),
    ]),
};

module.exports = {
  view: (vnode) => {
    return m(Layout, {
      pathInfo: vnode.attrs,
    });
  },
};
