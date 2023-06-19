const m = require('mithril');
const widget = require('widgets');
const rs = require('rswebui');
const util = require('boards/boards_util');
const viewUtil = require('boards/board_view');
const peopleUtil = require('people/people_util');

const getBoards = {
  All: [],
  PopularBoards: [],
  SubscribedBoards: [],
  MyBoards: [],
  OtherBoards: [],
  async load() {
    const res = await rs.rsJsonApiRequest('/rsPosted/getBoardsSummaries');
    const data = res.body;
    getBoards.All = data.groupInfo;
    getBoards.PopularBoards = getBoards.All;
    getBoards.PopularBoards.sort((a, b) => b.mPop - a.mPop);
    getBoards.OtherBoards = getBoards.PopularBoards.slice(5);
    getBoards.PopularBoards = getBoards.PopularBoards.slice(0, 5);
    getBoards.SubscribedBoards = getBoards.All.filter(
      (board) => board.mSubscribeFlags === util.GROUP_SUBSCRIBE_SUBSCRIBED
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
  OtherBoards: require('boards/other_boards'),
};

const Layout = () => {
  let ownId;

  return {
    oninit: () => {
      rs.setBackgroundTask(getBoards.load, 5000, () => {
        // return m.route.get() === '/files/files';
      });
      peopleUtil.ownIds((data) => {
        ownId = data;
        for (let i = 0; i < ownId.length; i++) {
          if (Number(ownId[i]) === 0) {
            ownId.splice(i, 1);
          }
        }
        ownId.unshift(0);
      });
    },
    view: (vnode) =>
      m('.widget', [
        m('.top-heading', [
          m(
            'button',
            {
              onclick: () =>
                ownId &&
                util.popupmessage(
                  m(viewUtil.createboard, {
                    authorId: ownId,
                  })
                ),
            },
            'Create Board'
          ),
          m(util.SearchBar, {
            list: getBoards.All,
          }),
        ]),
        Object.prototype.hasOwnProperty.call(vnode.attrs.pathInfo, 'mMsgId')
          ? m(viewUtil.PostView, {
              msgId: vnode.attrs.pathInfo.mMsgId,
              forumId: vnode.attrs.pathInfo.mGroupId,
            })
          : Object.prototype.hasOwnProperty.call(vnode.attrs.pathInfo, 'mGroupId')
          ? m(viewUtil.BoardView, {
              id: vnode.attrs.pathInfo.mGroupId,
            })
          : m(sections[vnode.attrs.pathInfo.tab], {
              list: getBoards[vnode.attrs.pathInfo.tab],
            }),
      ]),
  };
};

module.exports = {
  view: (vnode) => {
    return [
      m(widget.Sidebar, {
        tabs: Object.keys(sections),
        baseRoute: '/boards/',
      }),
      m('.node-panel', m(Layout, { pathInfo: vnode.attrs })),
    ];
  },
};
