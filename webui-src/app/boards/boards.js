const m = require('mithril');
const widget = require('widgets');
const rs = require('rswebui');
const util = require('boards/boards_util');
const viewUtil = require('boards/board_view');
const peopleUtil = require('people/people_util');

const getBoards = {
  All: [],
  Popular: [],
  Subscribed: [],
  MyBoards: [],
  Other: [],
  async load() {
    try {
      const res = await rs.rsJsonApiRequest('/rsPosted/getBoardsSummaries');
      const boards = res && res.body && Array.isArray(res.body.groupInfo) ? res.body.groupInfo : null;
      if (!boards) {
        console.warn('Boards summaries response did not include groupInfo', res && res.body);
        return;
      }
      getBoards.All = boards;
      const popular = [...boards].sort((a, b) => (b.mPop || 0) - (a.mPop || 0));
      getBoards.Other = popular.slice(5);
      getBoards.Popular = popular.slice(0, 5);
      getBoards.Subscribed = boards.filter(
        (board) => board.mSubscribeFlags === util.GROUP_SUBSCRIBE_SUBSCRIBED
      );
      getBoards.MyBoards = boards.filter(
        (board) => board.mSubscribeFlags === util.GROUP_MY_BOARD
      );
      m.redraw();
    } catch (error) {
      console.warn('Failed to load board summaries', error);
    }
  },
};

const sections = {
  MyBoards: require('boards/my_boards'),
  Subscribed: require('boards/subscribed_boards'),
  Popular: require('boards/popular_boards'),
  Other: require('boards/other_boards'),
};

const Layout = () => {
  let ownId;

  return {
    oninit: () => {
      rs.setBackgroundTask(getBoards.load, 30000, () => {
        return m.route.get().startsWith('/boards');
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
        mobileDrawer: true,
      }),
      m('.node-panel', m(Layout, { pathInfo: vnode.attrs })),
    ];
  },
};
