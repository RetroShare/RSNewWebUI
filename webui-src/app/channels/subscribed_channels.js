const m = require('mithril');
const util = require('channels/channels_util');

const Layout = () => {
  return {
    view: (v) => [
      m('.widget__heading', m('h3', 'Subscribed Channels')),
      m('.widget__body', [
        m(
          util.ChannelTable,
          m('tbody', [
            v.attrs.list.map((channel) =>
              m(util.ChannelSummary, {
                details: channel,
                category: 'SubscribedChannels',
              })
            ),
            v.attrs.list.map((channel) =>
              m(util.DisplayChannelsFromList, {
                id: channel.mGroupId,
                category: 'SubscribedChannels',
              })
            ),
          ])
        ),
      ]),
    ],
  };
};

module.exports = Layout;
