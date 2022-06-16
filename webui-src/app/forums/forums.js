const m = require('mithril');
const widget = require('widgets');
const rs = require('rswebui');
const util = require('forums/forums_util');

const getForums = {
  All: [],
  PopularForums: [],
  SubscribedForums: [],
  async load() {
    const res = await rs.rsJsonApiRequest('/rsgxsforums/getForumsSummaries');
    getForums.All = res.body.forums;
    getForums.PopularForums = getForums.All;
    getForums.SubscribedForums = getForums.All.filter(
      (forum) => forum.mSubscribeFlags === util.GROUP_SUBSCRIBE_SUBSCRIBED
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
  onupdate: getForums.load,
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
        '.forum-node-panel',

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
