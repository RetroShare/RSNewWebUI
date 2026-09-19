const m = require('mithril');
const widget = require('widgets');
const rs = require('rswebui');
const util = require('channels/channels_util');
const viewUtil = require('channels/channel_view');
const peopleUtil = require('people/people_util');
const icon = require('icon');

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
      //  Most popular first, the order the All tab has always shown.
      getChannels.All = [...channels].sort((a, b) => (b.mPop || 0) - (a.mPop || 0));
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
      await getChannels.loadDescriptions();
    } catch (error) {
      console.warn('Failed to load channel summaries', error);
    }
  },

  //  Summaries carry no description. getChannelsInfo takes a list, so the whole
  //  page costs one request -- asking per channel cost one per row.
  async loadDescriptions() {
    const ids = getChannels.All.map((channel) => channel.mGroupId).filter(Boolean);
    if (ids.length === 0) return;
    const res = await rs.rsJsonApiRequest('/rsgxschannels/getChannelsInfo', { chanIds: ids });
    const infos = res && res.body && res.body.channelsInfo;
    if (!Array.isArray(infos)) return;
    const byId = {};
    infos.forEach((info) => {
      if (info && info.mMeta) byId[info.mMeta.mGroupId] = info.mDescription;
    });
    getChannels.All.forEach((channel) => {
      channel.description = byId[channel.mGroupId] || '';
    });
    m.redraw();
  },
};

//  Group lists change on the scale of a conversation, not of a frame.
const CHANNEL_LIST_REFRESH_MS = 30000;

//  Popular and Other are the two halves of the NON-subscribed list: neither
//  shows a channel once the user subscribes to it. All is the full list, and
//  the only place a subscribed channel can be found again outside Subscribed.
const sections = {
  MyChannels: require('channels/my_channels'),
  Subscribed: require('channels/subscribed_channels'),
  All: require('channels/all_channels'),
  Popular: require('channels/popular_channels'),
  Other: require('channels/other_channels'),
};

const navLabels = {
  MyChannels: 'My Channels',
  Subscribed: 'Subscribed',
  All: 'All Channels',
  Popular: 'Popular',
  Other: 'Other',
};

//  The page title, which can say more than the rail label beside it.
const pageTitles = {
  MyChannels: 'My Channels',
  Subscribed: 'Subscribed Channels',
  All: 'All Channels',
  Popular: 'Popular Channels',
  Other: 'Other Channels',
};

const navIcons = {
  MyChannels: 'tv',
  Subscribed: 'bookmark',
  All: 'globe',
  Popular: 'fire',
  Other: 'layer-group',
};

const Layout = () => {
  let ownId;
  const createChannel = () => ownId && widget.popupMessage(
    m(viewUtil.createchannel, { authorId: ownId, onCreated: getChannels.load }),
    'create-channel-modal',
    {
      title: 'Create Channel',
      lead: 'Set up the channel appearance and publishing options.',
    }
  );

  return {
    oninit: () => {
      //  The scope predicate has to return a boolean: setBackgroundTask stops
      //  after the first interval on undefined, and the list is then never
      //  refreshed while the page stays open. Same
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
      m('.widget', {
        class: vnode.attrs.pathInfo.mGroupId && !vnode.attrs.pathInfo.mMsgId ? 'channels-detail-widget' : '',
      }, [
        //  Only the list views get a page header: a channel and a post carry
        //  their own heading, which is the channel's name rather than the tab's.
        !vnode.attrs.pathInfo.mGroupId && m(widget.PageHead, {
          class: 'group-list-head',
          title: pageTitles[vnode.attrs.pathInfo.tab] || 'Channels',
          actions: [
            m('button.channels-create-button.is-primary', {
              onclick: createChannel,
            }, [icon('plus'), 'Create Channel']),
            m(util.SearchBar, { category: 'channels', list: getChannels.All }),
          ],
        }),
        Object.prototype.hasOwnProperty.call(vnode.attrs.pathInfo, 'mMsgId') // posts
          ? m(viewUtil.PostView, {
              msgId: vnode.attrs.pathInfo.mMsgId,
              channelId: vnode.attrs.pathInfo.mGroupId,
            })
          : Object.prototype.hasOwnProperty.call(vnode.attrs.pathInfo, 'mGroupId') // channels view
          ? m(viewUtil.ChannelView, {
              id: vnode.attrs.pathInfo.mGroupId,
              onSubscriptionChange: getChannels.load,
            })
          : m(sections[vnode.attrs.pathInfo.tab], {
              // subscribed, all, popular, other
              list: getChannels[vnode.attrs.pathInfo.tab],
              onCreateChannel: createChannel,
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
        title: 'Channels',
        labels: navLabels,
        icons: navIcons,
      }),
      m('.node-panel', m(Layout, { pathInfo: vnode.attrs })),
    ];
  },
};
