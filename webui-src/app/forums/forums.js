const m = require('mithril');
const widget = require('widgets');
const rs = require('rswebui');
const util = require('forums/forums_util');

const getForums = {
  All: [],
  PopularForums: [],
  SubscribedForums: [],
  async load() {
    await rs.rsJsonApiRequest('/rsgxsforums/getForumsSummaries', {}, (data) => {
      getForums.All = data.forums;
      getForums.PopularForums = getForums.All;
      getForums.SubscribedForums = getForums.All.filter(
        (forum) => forum.mSubscribeFlags === util.GROUP_SUBSCRIBE_SUBSCRIBED
      );
    });
  },
};
const sections = {
  MyForums: require('forums/my_forums'),
  SubscribedForums: require('forums/subscribed_forums'),
  PopularForums: require('forums/popular_forums'),
  OtherForums: require('forums/other_forums')
};

const Layout = {
  // oninit : getForums.load,
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

        vnode.attrs.check
          ? m(util.MessageView, {
              id: vnode.attrs.id,
            })
          : m(sections[vnode.attrs.tab], {
              list: getForums[vnode.attrs.tab],
            })
      ),
    ]),
};

module.exports = {
  view: (vnode) => {
    if (Object.prototype.hasOwnProperty.call(vnode.attrs, 'mGroupId')) {
      return m(Layout, {
        check: true, // for forum description
        id: vnode.attrs.mGroupId,
      });
    }
    return m(Layout, {
      check: false,
      tab: vnode.attrs.tab,
    });
    // this check is implemented for Layout and helps to send in updated list each time.
  },
};
