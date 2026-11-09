const m = require('mithril');
const util = require('channels/channels_util');

//  The whole list, most popular first: the one section where a group is
//  listed whether or not the user is subscribed to it.
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
                category: 'All',
              })
            ),
          ])
        ),
      ]),
    ],
  };
};

module.exports = Layout;
