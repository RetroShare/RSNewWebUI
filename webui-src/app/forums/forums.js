const m = require('mithril');
const widget = require('widgets');
const rs = require('rswebui');
const util = require('forums/forums_util');
const viewUtil = require('forums/forum_view');
const peopleUtil = require('people/people_util');

const getForums = {
  All: [],
  Popular: [],
  Subscribed: [],
  MyForums: [],
  async load() {
    const res = await rs.rsJsonApiRequest('/rsgxsforums/getForumsSummaries');
    if (res && res.body && res.body.forums) {
      getForums.All = res.body.forums;
      getForums.Popular = getForums.All;
      getForums.Subscribed = getForums.All.filter(
        (forum) =>
          forum.mSubscribeFlags === util.GROUP_SUBSCRIBE_SUBSCRIBED ||
          forum.mSubscribeFlags === util.GROUP_MY_FORUM
      );
      getForums.MyForums = getForums.All.filter(
        (forum) => forum.mSubscribeFlags === util.GROUP_MY_FORUM
      );
    }
  },
};
const sections = {
  MyForums: require('forums/my_forums'),
  Subscribed: require('forums/subscribed_forums'),
  Popular: require('forums/popular_forums'),
  Other: require('forums/other_forums'),
};

const Layout = () => {
  let ownId;

  return {
    oninit: () => {
      rs.setBackgroundTask(getForums.load, 5000, () => {
        return m.route.get().includes('/forums');
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
          vnode.attrs.pathInfo.tab === 'MyForums' &&
          m(
            'button',
            {
              onclick: () =>
                ownId &&
                util.popupmessage(
                  m(viewUtil.createforum, {
                    authorId: ownId,
                    onCreated: getForums.load,
                  }),
                  'create-forum-modal'
                ),
            },
            'Create Forum'
          ),
          m(util.SearchBar, {
            list: getForums.All,
          }),
        ]),
        Object.prototype.hasOwnProperty.call(vnode.attrs.pathInfo, 'mMsgId') // thread's view
          ? m(viewUtil.ThreadView, {
            msgId: vnode.attrs.pathInfo.mMsgId,
            forumId: vnode.attrs.pathInfo.mGroupId,
          })
          : Object.prototype.hasOwnProperty.call(vnode.attrs.pathInfo, 'mGroupId') // Forum's view
            ? m(viewUtil.ForumView, {
              id: vnode.attrs.pathInfo.mGroupId,
            })
            : m(sections[vnode.attrs.pathInfo.tab], {
              list: getForums[vnode.attrs.pathInfo.tab],
            }),
      ]),
  };
};

module.exports = {
  view: (vnode) => {
    return [
      m(widget.Sidebar, {
        tabs: Object.keys(sections),
        baseRoute: '/forums/',
        mobileDrawer: true,
      }),
      m('.node-panel', m(Layout, { pathInfo: vnode.attrs })),
    ];
  },
};
