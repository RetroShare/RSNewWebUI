const m = require('mithril');
const widget = require('widgets');
const rs = require('rswebui');
const util = require('forums/forums_util');

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
      (forum) => forum.mSubscribeFlags === util.GROUP_SUBSCRIBE_SUBSCRIBED ||
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

const Layout = {
  oninit : () => {
    rs.setBackgroundTask(getForums.load, 5000, () => {
      // return m.route.get() === '/files/files';
    });
  },
  view: (vnode) =>
    m('.tab-page', [
      m(util.SearchBar, {
        list: getForums.All,
      }),
      m(widget.Sidebar, {
        tabs: Object.keys(sections),
        baseRoute: '/forums/',
      }),
      m(
        '.forums-node-panel',

        Object.prototype.hasOwnProperty.call(vnode.attrs.pathInfo, 'mGroupId')
          ? m(util.MessageView, {
              id: vnode.attrs.pathInfo.mGroupId,
            })
          : m(sections[vnode.attrs.pathInfo.tab], {
              list: getForums[vnode.attrs.pathInfo.tab],
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
