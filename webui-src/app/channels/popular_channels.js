const m = require('mithril');
const util = require('channels/channels_util');

const Layout = () => {
  return {
    view: (v) => [
      m('.widget', [
        m('h3', 'Popular Channels'),
        m('hr'),
        m(
          util.Table,
          m(
            'tbody',
            [v.attrs.list.map((channel) =>
              m(util.ChannelSummary, {
                details: channel,
                category: 'PopularChannels',
              }),
            ),
            v.attrs.list.map((channel) =>
              m(util.DisplayChannels, {
                id: channel.mGroupId,
                category: 'PopularChannels',
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

