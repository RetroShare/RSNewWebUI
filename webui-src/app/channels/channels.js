const m = require('mithril');
const widget = require('widgets');
const rs = require('rswebui');
const util = require('channels/channels_util');

const getChannels = {
  All: [],
  PopularChannels: [],
  SubscribedChannels: [],
  MyChannels: [],
  async load() {
    const res = await rs.rsJsonApiRequest('/rsgxschannels/getChannelsSummaries');
    const data = res.body;
    getChannels.All = data.channels;
    getChannels.PopularChannels = getChannels.All;
    getChannels.SubscribedChannels = getChannels.All.filter(
      (channel) =>
        channel.mSubscribeFlags === util.GROUP_SUBSCRIBE_SUBSCRIBED ||
        channel.mSubscribeFlags === util.GROUP_MY_CHANNEL
    );
    getChannels.MyChannels = getChannels.All.filter(
      (channel) => channel.mSubscribeFlags === util.GROUP_MY_CHANNEL
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

        Object.prototype.hasOwnProperty.call(vnode.attrs.pathInfo, 'mMsgId')
          ? m(util.PostView, {
              msgId: vnode.attrs.pathInfo.mMsgId,
              channelId: vnode.attrs.pathInfo.mGroupId,
            })
          : Object.prototype.hasOwnProperty.call(vnode.attrs.pathInfo, 'mGroupId')
          ? m(util.ChannelView, {
              id: vnode.attrs.pathInfo.mGroupId,
            })
          : m(sections[vnode.attrs.pathInfo.tab], {
              list: getChannels[vnode.attrs.pathInfo.tab],
            })
      ),
    ]),
};

module.exports = {
  view: (vnode) => {
    return m(Layout, {
      pathInfo: vnode.attrs,
    });
    // if (Object.prototype.hasOwnProperty.call(vnode.attrs, 'mMsgId')) {
    //   return m(Layout, {
    //     check: 0, // for channel description
    //     channelId: vnode.attrs.mGroupId,
    //     msgId: vnode.attrs.mMsgId,
    //   });
    // } else if (Object.prototype.hasOwnProperty.call(vnode.attrs, 'mGroupId')) {
    //   return m(Layout, {
    //     check: 1, // for channel description
    //     id: vnode.attrs.mGroupId,
    //   });
    // }
    // return m(Layout, {
    //   check: 2,
    //   tab: vnode.attrs.tab,
    // });
    // this check is implemented for Layout and helps to send in updated list each time.
  },
};
