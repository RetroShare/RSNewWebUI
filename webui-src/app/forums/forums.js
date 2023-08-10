const m = require('mithril');
const widget = require('widgets');
const rs = require('rswebui');
const util = require('forums/forums_util');
const viewUtil = require('forums/forum_view');
const peopleUtil = require('people/people_util');

const getForums = {
  All: [],
  OtherForums: [],
  PopularForums: [],
  SubscribedForums: [],
  MyForums: [],
  async load() {
    const res = await rs.rsJsonApiRequest('/rsgxsforums/getForumsSummaries');
    getForums.All = res.body.forums;
    getForums.OtherForums = getForums.All.filter((forum) => forum.mPop <= 2);
    getForums.PopularForums = getForums.All.filter(
      (forum) => forum.mPop > 2 && forum.mSubscribeFlags !== util.GROUP_SUBSCRIBE_SUBSCRIBED
    );
    getForums.SubscribedForums = getForums.All.filter(
      (forum) =>
        forum.mSubscribeFlags === util.GROUP_SUBSCRIBE_SUBSCRIBED ||
        forum.mSubscribeFlags === util.GROUP_MY_FORUM
    );
    getForums.MyForums = getForums.All.filter(
      (forum) => forum.mSubscribeFlags === util.GROUP_MY_FORUM
    );
  },
};
const sections = {
  MyForums: require('forums/my_forums'),
  SubscribedForums: require('forums/subscribed_forums'),
  PopularForums: require('forums/popular_forums'),
  OtherForums: require('forums/other_forums'),
};

const Layout = () => {
  let ownId;

  return {
    oninit: () => {
      rs.setBackgroundTask(getForums.load, 5000, () => {
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
                  m(viewUtil.createforum, {
                    authorId: ownId,
                  })
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
      }),
      m('.node-panel', m(Layout, { pathInfo: vnode.attrs })),
    ];
  },
};
