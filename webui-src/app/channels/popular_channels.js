const m = require('mithril');
const util = require('channels/channels_util');

const Layout = () => {
  return {
    view: (v) => [
      m('.widget', [
        m('h3', 'Popular Channels'),
        m('hr'),
        m(
          util.ChannelTable,
          m('tbody', [
            v.attrs.list.map((channel) =>
              m(util.ChannelSummary, {
                details: channel,
                category: 'PopularChannels',
              })
            ),
            v.attrs.list.map((channel) =>
              m(util.DisplayChannelsFromList, {
                id: channel.mGroupId,
                category: 'PopularChannels',
              })
            ),
          ])
        ),
      ]),
    ],
  };
};

module.exports = Layout;
