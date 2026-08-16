const m = require('mithril');
const widget = require('widgets');
const rs = require('rswebui');
const util = require('channels/channels_util');
const viewUtil = require('channels/channel_view');
const peopleUtil = require('people/people_util');

const getChannels = {
  All: [],
  Popular: [],
  Subscribed: [],
  MyChannels: [],
  Other: [],
  async load() {
    try {
      const res = await rs.rsJsonApiRequest('/rsgxschannels/getChannelsSummaries');
      const channels = res && res.body && Array.isArray(res.body.channels) ? res.body.channels : null;
      if (!channels) {
        console.warn('Channels summaries response did not include channels', res && res.body);
        return;
      }
      getChannels.All = channels;
      getChannels.Subscribed = channels.filter(
      (channel) =>
        channel.mSubscribeFlags === util.GROUP_SUBSCRIBE_SUBSCRIBED ||
        channel.mSubscribeFlags === util.GROUP_MY_CHANNEL // my channel is subscribed
      );
      const popular = channels.filter((channel) => !getChannels.Subscribed.includes(channel));
      popular.sort((a, b) => (b.mPop || 0) - (a.mPop || 0));
      getChannels.Other = popular.slice(5);
      getChannels.Popular = popular.slice(0, 5);

      getChannels.MyChannels = channels.filter(
        (channel) => channel.mSubscribeFlags === util.GROUP_MY_CHANNEL
      );
      m.redraw();
    } catch (error) {
      console.warn('Failed to load channel summaries', error);
    }
  },
};

//  Group lists change on the scale of a conversation, not of a frame.
const CHANNEL_LIST_REFRESH_MS = 30000;

const sections = {
  MyChannels: require('channels/my_channels'),
  Subscribed: require('channels/subscribed_channels'),
  Popular: require('channels/popular_channels'),
  Other: require('channels/other_channels'),
};

const Layout = () => {
  let ownId;

  return {
    oninit: () => {
      //  The scope predicate used to be commented out, so it returned undefined
      //  and setBackgroundTask stopped after the first interval: the channel list
      //  was loaded once and never refreshed while the page stayed open. Same
      //  period as the boards list, which asks the same kind of question -- a
      //  five second poll of a whole summaries list is a lot to pay on a phone.
      rs.setBackgroundTask(getChannels.load, CHANNEL_LIST_REFRESH_MS, () =>
        m.route.get().startsWith('/channels')
      );
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
                    onCreated: getChannels.load,
                  }),
                  'create-channel-modal'
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
        mobileDrawer: true,
      }),
      m('.node-panel', m(Layout, { pathInfo: vnode.attrs })),
    ];
  },
};
