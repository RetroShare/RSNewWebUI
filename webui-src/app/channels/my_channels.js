const m = require('mithril');
const util = require('channels/channels_util');

const Layout = () => {
  return {
    view: (v) => [
      m('.widget', [
        m('h3', 'My Channels'),
        m('hr'),
        m(
          util.Table,
          m('tbody', [
            v.attrs.list.map((channel) =>
              m(util.ChannelSummary, {
                details: channel,
                category: 'MyChannels',
              })
            ),
            v.attrs.list.map((channel) =>
              m(util.DisplayChannelsFromList, {
                id: channel.mGroupId,
                category: 'MyChannels',
              })
            ),
          ])
        ),
      ]),
    ],
  };
};

module.exports = Layout;
