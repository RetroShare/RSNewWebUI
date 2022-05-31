const m = require('mithril');
const util = require('channels/channels_util');

const Layout = () => {
  return {
    view: (v) => [
      m('.widget', [
        m('h3', 'Subscribed Channels'),
        m('hr'),
        m(
          util.Table,
          m(
            'tbody',
            [v.attrs.list.map((channel) =>
              m(util.ChannelSummary, {
                details: channel,
                category: 'SubscribedChannels',
              }),
            ),
            v.attrs.list.map((channel) =>
              m(util.DisplayChannelsFromList, {
                id: channel.mGroupId,
                category: 'SubscribedChannels',
              }),
            ),
          ]
          )
        ),
      ]),
    ],
  };
};

module.exports = Layout;

