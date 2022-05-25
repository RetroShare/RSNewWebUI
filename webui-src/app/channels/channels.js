const m = require('mithril');
const widget = require('widgets');
const rs = require('rswebui');
const util = require('channels/channels_util');

const getChannels =
{
  PopularChannels : [],
  load(){

    rs.rsJsonApiRequest('/rsgxschannels/getChannelsSummaries', {}, (data) => {
      getChannels.PopularChannels = data.channels;
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
    // if (Object.prototype.hasOwnProperty.call(vnode.attrs, 'mGroupId')) {
    //   return m(
    //     Layout,
    //     m(util.MessageView, {
    //       id: vnode.attrs.mGroupId,
    //     })
    //   );
    // }
    return m(
      Layout,
      m((sections[tab]), {
      list: getChannels.PopularChannels,
      }),
    );
  },
};
