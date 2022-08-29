const m = require('mithril');
const widget = require('widgets');
const rs = require('rswebui');
const util = require('forums/forums_util');
const viewUtil = require('forums/forum_view');
const peopleUtil = require('people/people_util');

const getForums = {
  All: [],
  PopularForums: [],
  SubscribedForums: [],
  MyForums: [],
  async load() {
    const res = await rs.rsJsonApiRequest('/rsgxsforums/getForumsSummaries');
    getForums.All = res.body.forums;
    getForums.PopularForums = getForums.All;
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
      m('.tab-page', [
        m(util.SearchBar, {
          list: getForums.All,
        }),
        m(
          'button',
          {
            style: {fontSize: '1.2em', width: '200px'},
            onclick: () =>
              util.popupmessage(
                m(viewUtil.createforum, {
                  authorId: ownId,
                })
              ),
          },
          'Create Forum'
        ),
        m(widget.Sidebar, {
          tabs: Object.keys(sections),
          baseRoute: '/forums/',
        }),
        m(
          '.forums-node-panel',

          Object.prototype.hasOwnProperty.call(vnode.attrs.pathInfo, 'mMsgId')
            ? m(viewUtil.ThreadView, {
                msgId: vnode.attrs.pathInfo.mMsgId,
                // mOrigMsgId: vnode.attrs.pathInfo.mOrigMsgId,
                forumId: vnode.attrs.pathInfo.mGroupId,
              })
            : Object.prototype.hasOwnProperty.call(vnode.attrs.pathInfo, 'mGroupId')
            ? m(viewUtil.ForumView, {
                id: vnode.attrs.pathInfo.mGroupId,
              })
            : m(sections[vnode.attrs.pathInfo.tab], {
                list: getForums[vnode.attrs.pathInfo.tab],
              })
        ),
      ]),
  };
};

module.exports = {
  view: (vnode) => {
    return m(Layout, {
      pathInfo: vnode.attrs,
    });
  },
};
