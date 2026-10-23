const m = require('mithril');
const util = require('channels/channels_util');

const Layout = () => {
  return {
    view: (v) => [
      m('.widget__body', [
        m(
          util.ChannelTable,
          m('tbody', [
            v.attrs.list.map((channel) =>
              m(util.DisplayChannelsFromList, {
                id: channel.mGroupId,
                details: channel,
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
