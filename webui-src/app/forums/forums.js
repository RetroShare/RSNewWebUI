const m = require('mithril');
const widget = require('widgets');
const rs = require('rswebui');
const util = require('forums/forums_util');

const getForums =
{
  PopularForums : [],
  load(){

    rs.rsJsonApiRequest('/rsgxsforums/getForumsSummaries', {}, (data) => {
      getForums.PopularForums = data.forums;
      console.log(getForums.PopularForums);
    });
  }
};
const sections = {
  MyForums: require('forums/my_forums'),
  SubscribedForums: require('forums/subscribed_forums'),
  PopularForums: require('forums/popular_forums'),
  OtherForums: require('forums/other_forums')
};

const Layout = {
  oninit: getForums.load,
  view: (vnode) =>
    m('.tab-page', [
      m(util.SearchBar, {
        list: getForums.PopularForums
      }),
      m(widget.Sidebar, {
        tabs: Object.keys(sections),
        baseRoute: '/forums/',
      }),
      m('.forums-node-panel', vnode.children),
    ]),
};

module.exports = {
  view: (vnode) => {
    const tab = vnode.attrs.tab;
    if (Object.prototype.hasOwnProperty.call(vnode.attrs, 'mGroupId')) {
      return m(
        Layout,
        m(util.MessageView, {
          id: vnode.attrs.mGroupId,
        })
      );
    }
    return m(
      Layout,
      m((sections[tab]), {
      list: getForums.PopularForums,
      }),
    );
  },
};
