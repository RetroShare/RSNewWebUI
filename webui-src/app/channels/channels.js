const m = require('mithril');
const widget = require('widgets');
const rs = require('rswebui');
const util = require('channels/channels_util');

const getChannels = {
  All: [],
  PopularChannels: [],
  SubscribedChannels: [],
  async load() {
    const res = await rs.rsJsonApiRequest('/rsgxschannels/getChannelsSummaries');
    const data = res.body;
    getChannels.All = data.channels;
    getChannels.PopularChannels = getChannels.All;
    getChannels.SubscribedChannels = getChannels.All.filter(
      (channel) => channel.mSubscribeFlags === util.GROUP_SUBSCRIBE_SUBSCRIBED
    );
  },
};

const sections = {
  MyChannels: require('channels/my_channels'),
  SubscribedChannels: require('channels/subscribed_channels'),
  PopularChannels: require('channels/popular_channels'),
  OtherChannels: require('channels/other_channels'),
};

const Layout = {
  // oninit : getChannels.load,
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
    // this check is implemented for Layout and helps to send in updated list each time.
  },
};
