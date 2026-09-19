const m = require('mithril');
const widget = require('widgets');
const rs = require('rswebui');
const util = require('boards/boards_util');
const viewUtil = require('boards/board_view');
const peopleUtil = require('people/people_util');
const icon = require('icon');

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
      const popular = [...boards].sort((a, b) => (b.mPop || 0) - (a.mPop || 0));
      getBoards.All = popular;
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

//  Group lists change on the scale of a conversation, not of a frame.
const BOARD_LIST_REFRESH_MS = 30000;

//  Popular is the top five by popularity and Other the rest; All is the
//  whole list in that same order.
const sections = {
  MyBoards: require('boards/my_boards'),
  Subscribed: require('boards/subscribed_boards'),
  All: require('boards/all_boards'),
  Popular: require('boards/popular_boards'),
  Other: require('boards/other_boards'),
};

const navLabels = {
  MyBoards: 'My Boards',
  Subscribed: 'Subscribed',
  All: 'All Boards',
  Popular: 'Popular',
  Other: 'Other',
};

//  The page title, which can say more than the rail label beside it.
const pageTitles = {
  MyBoards: 'My Boards',
  Subscribed: 'Subscribed Boards',
  All: 'All Boards',
  Popular: 'Popular Boards',
  Other: 'Other Boards',
};

const navIcons = {
  MyBoards: 'th-large',
  Subscribed: 'bookmark',
  All: 'globe',
  Popular: 'fire',
  Other: 'layer-group',
};

const Layout = () => {
  let ownId;
  const createBoard = () => ownId && util.popupmessage(
    m(viewUtil.createboard, { authorId: ownId, onCreated: getBoards.load }),
    'create-board-modal',
    {
      title: 'Create Board',
      lead: 'Set up the board appearance and publishing options.',
    }
  );

  return {
    oninit: () => {
      rs.setBackgroundTask(getBoards.load, BOARD_LIST_REFRESH_MS, () => {
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
      m('.widget', {
        class: vnode.attrs.pathInfo.mGroupId && !vnode.attrs.pathInfo.mMsgId ? 'boards-detail-widget' : '',
      }, [
        //  Only the list views get a page header: a board and a post carry
        //  their own heading, which is the board's name rather than the tab's.
        !vnode.attrs.pathInfo.mGroupId && m(widget.PageHead, {
          class: 'group-list-head',
          title: pageTitles[vnode.attrs.pathInfo.tab] || 'Boards',
          actions: [
            m('button.boards-create-button.is-primary', {
              onclick: createBoard,
            }, [icon('plus'), 'Create Board']),
            m(util.SearchBar, {
              list: getBoards.All,
            }),
          ],
        }),
        Object.prototype.hasOwnProperty.call(vnode.attrs.pathInfo, 'mMsgId')
          ? m(viewUtil.PostView, {
              msgId: vnode.attrs.pathInfo.mMsgId,
              forumId: vnode.attrs.pathInfo.mGroupId,
            })
          : Object.prototype.hasOwnProperty.call(vnode.attrs.pathInfo, 'mGroupId')
          ? m(viewUtil.BoardView, {
              id: vnode.attrs.pathInfo.mGroupId,
              onSubscriptionChange: getBoards.load,
            })
          : m(sections[vnode.attrs.pathInfo.tab], {
              list: getBoards[vnode.attrs.pathInfo.tab],
              onCreateBoard: createBoard,
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
        title: 'Boards',
        labels: navLabels,
        icons: navIcons,
      }),
      m('.node-panel', m(Layout, { pathInfo: vnode.attrs })),
    ];
  },
};
