const m = require('mithril');
const widget = require('widgets');
const rs = require('rswebui');
const util = require('channels/channels_util');

const getChannels = {
  All: [],
  PopularChannels: [],
  SubscribedChannels: [],
  async load() {
    await rs.rsJsonApiRequest('/rsgxschannels/getChannelsSummaries', {}, (data) => {
      getChannels.All = data.channels;
      console.log(getChannels.All);
      getChannels.PopularChannels = getChannels.All;
      // console.log(util.GROUP_SUBSCRIBE_SUBSCRIBED === 4);
      getChannels.SubscribedChannels = getChannels.All.filter(
        (channel) => channel.mSubscribeFlags === util.GROUP_SUBSCRIBE_SUBSCRIBED
      );
    });
  },
};

const sections = {
  MyChannels: require('channels/my_channels'),
  SubscribedChannels: require('channels/subscribed_channels'),
  PopularChannels: require('channels/popular_channels'),
  OtherChannels: require('channels/other_channels'),
};

const Layout = {
  onupdate: getChannels.load,
  view: (vnode) =>
    m('.tab-page', [
      m(util.SearchBar, {
        list: getChannels.All,
      }),
      m(widget.Sidebar, {
        tabs: Object.keys(sections),
        baseRoute: '/channels/',
      }),
      m(
        '.channel-node-panel',

        vnode.attrs.check
          ? m(util.MessageView, {
              id: vnode.attrs.id,
            })
          : m(sections[vnode.attrs.tab], {
              list: getChannels[vnode.attrs.tab],
            })
      ),
    ]),
};

module.exports = {
  view: (vnode) => {
    if (Object.prototype.hasOwnProperty.call(vnode.attrs, 'mGroupId')) {
      return m(Layout, {
        check: true, // for channel description
        id: vnode.attrs.mGroupId,
      });
    }
    return m(Layout, {
      check: false,
      tab: vnode.attrs.tab,
    });
  },
};
