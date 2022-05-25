const m = require('mithril');
const widget = require('widgets');
const rs = require('rswebui');

const getChannels =
{
  PopularChannels : [],
  load(){

    rs.rsJsonApiRequest('/rsgxschannels/getChannelsSummaries', {}, (data) => {
      this.PopularChannels = data;
    });
  }
};

const sections = {
  MyChannels: require('channels/my_channels'),
  SubscribedChannels: require('channels/subscribed_channels'),
  PopularChannels: require('channels/popular_channels'),
  OtherChannels: require('channels/other_channels')
};

const Layout = {
  oninit: getChannels.load,
  view: (vnode) =>
    m('.tab-page', [
      m(widget.Sidebar, {
        tabs: Object.keys(sections),
        baseRoute: '/channels/',
      }),
      m('.channel-node-panel', vnode.children),
    ]),
};

module.exports = {
  view: (vnode) => {
    const tab = vnode.attrs.tab;
    return m(Layout, m(sections[tab]));
  },
};
