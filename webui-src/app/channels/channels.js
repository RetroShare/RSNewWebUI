const m = require('mithril');
const widget = require('widgets');
const rs = require('rswebui');
const util = require('channels/channels_util');
const viewUtil = require('channels/channel_view');
const peopleUtil = require('people/people_util');

const getChannels = {
  All: [],
  PopularChannels: [],
  SubscribedChannels: [],
  MyChannels: [],
  OtherChannels: [],
  async load() {
    const res = await rs.rsJsonApiRequest('/rsgxschannels/getChannelsSummaries');
    const data = res.body;
    getChannels.All = data.channels;
    getChannels.SubscribedChannels = getChannels.All.filter(
      (channel) =>
        channel.mSubscribeFlags === util.GROUP_SUBSCRIBE_SUBSCRIBED ||
        channel.mSubscribeFlags === util.GROUP_MY_CHANNEL // my channel is subscribed
    );
    // getChannels.PopularChannels = getChannels.All;
    getChannels.PopularChannels = getChannels.All.filter(
      (a) => !getChannels.SubscribedChannels.includes(a)
    );
    getChannels.PopularChannels.sort((a, b) => b.mPop - a.mPop);
    getChannels.OtherChannels = getChannels.PopularChannels.slice(5);
    getChannels.PopularChannels = getChannels.PopularChannels.slice(0, 5);

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

const Layout = () => {
  let ownId;

  return {
    oninit: () => {
      rs.setBackgroundTask(getChannels.load, 5000, () => {
        // return m.route.get() === '/files/files';
      });
      peopleUtil.ownIds((data) => {
        ownId = data;
        for (let i = 0; i < ownId.length; i++) {
          if (Number(ownId[i]) === 0) {
            ownId.splice(i, 1);
          }
        }
        ownId.unshift(0); // we need an extra check when a channel is created with no identity.
      });
    },
    // onupdate: getChannels.load,
    view: (vnode) =>
      m('.widget', [
        m('.top-heading', [
          m(
            'button',
            {
              onclick: () =>
                ownId &&
                widget.popupMessage(
                  m(viewUtil.createchannel, {
                    authorId: ownId,
                  })
                ),
            },
            'Create Channel'
          ),
          Object.prototype.hasOwnProperty.call(vnode.attrs.pathInfo, 'mMsgId')
            ? ''
            : Object.prototype.hasOwnProperty.call(vnode.attrs.pathInfo, 'mGroupId')
            ? m(util.SearchBar, {
                category: 'posts',
                channelId: vnode.attrs.pathInfo.mGroupId,
              })
            : m(util.SearchBar, {
                category: 'channels',
              }),
        ]),
        Object.prototype.hasOwnProperty.call(vnode.attrs.pathInfo, 'mMsgId') // posts
          ? m(viewUtil.PostView, {
              msgId: vnode.attrs.pathInfo.mMsgId,
              channelId: vnode.attrs.pathInfo.mGroupId,
            })
          : Object.prototype.hasOwnProperty.call(vnode.attrs.pathInfo, 'mGroupId') // channels view
          ? m(viewUtil.ChannelView, {
              id: vnode.attrs.pathInfo.mGroupId,
            })
          : m(sections[vnode.attrs.pathInfo.tab], {
              // subscribed, all, popular, other
              list: getChannels[vnode.attrs.pathInfo.tab],
            }),
      ]),
  };
};

module.exports = {
  view: (vnode) => {
    return [
      m(widget.Sidebar, {
        tabs: Object.keys(sections),
        baseRoute: '/channels/',
      }),
      m('.node-panel', m(Layout, { pathInfo: vnode.attrs })),
    ];
  },
};
