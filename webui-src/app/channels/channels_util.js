const m = require('mithril');
const rs = require('rswebui');

const ChannelSummary = () => {
  let details = {};
  let name = '';
  return {
    oninit: (v) => {
    // console.log(v.attrs.details);
      rs.rsJsonApiRequest(
        '/rsgxschannels/getChannelsInfo',
        {
          chanIds: [v.attrs.details.mGroupId],
        },
        (data) => {
          details = data.channelsInfo[0];
          console.log('yo');
          console.log(details.mMeta);
          console.log(details.mMeta.mGroupName);
          name = details.mMeta.mGroupName;
        }
      );
    },
    view: (v) =>
      m(
        'tr',
        {
          key: v.attrs.details.mGroupId,
          onclick: () =>
            m.route.set('/channels/:tab/:mGroupId', {
              tab: v.attrs.category,
              mGroupId: v.attrs.details.mGroupId,
            }),
        },
        [m('td', name)]
      ),
  };
};

const MessageView = () => {
  let details = {};
  let message = '';
  return {
    oninit: (v) =>
      rs.rsJsonApiRequest(
        '/rsMsgs/getMessage',
        {
          msgId: v.attrs.id,
        },
        (data) => {
          details = data.msg;
          // regex to detect html tags
          // better regex?  /<[a-z][\s\S]*>/gi
          if (/<\/*[a-z][^>]+?>/gi.test(details.msg)) {
            message = details.msg;
          } else {
            message = '<p style="white-space: pre">' + details.msg + '</p>';
          }
        }
      ),
    view: (v) =>
      m(
        '.widget.msgview',
        {
          key: details.msgId,
        },
        [
          m(
            'a[title=Back]',
            {
              onclick: () =>
                m.route.set('/mail/:tab', {
                  tab: m.route.param().tab,
                }),
            },
            m('i.fas.fa-arrow-left')
          ),
          m('h3', details.title),
          m('button', 'Reply'),
          m('button', 'Reply All'),
          m('button', 'Forward'),
          m(
            'button',
            {
              onclick: () => {
                rs.rsJsonApiRequest('/rsMsgs/MessageToTrash', {
                  msgId: details.msgId,
                  bTrash: true,
                }),
                  rs.rsJsonApiRequest('/rsMsgs/MessageDelete', {
                    msgId: details.msgId,
                  });
              },
            },
            'Delete'
          ),
          m('hr'),
          m(
            'iframe[title=message].msg',
            {
              srcdoc: message,
            },
            message
          ),
        ]
      ),
  };
};

const Table = () => {
  return {
    oninit: (v) => {},
    view: (v) =>
      m('table.channels', [
        m('tr', [
          m('th', 'Channel Name'),
        ]),
        v.children,
      ]),
  };
};
const SearchBar = () => {
  let searchString = '';
  return {
    view: (v) =>
      m('input[type=text][id=searchmail][placeholder=Search Subject].searchbar', {
        value: searchString,
        oninput: (e) => {
          searchString = e.target.value.toLowerCase();
          for (const hash in v.attrs.list) {
            if (v.attrs.list[hash].fname.toLowerCase().indexOf(searchString) > -1) {
              v.attrs.list[hash].isSearched = true;
            } else {
              v.attrs.list[hash].isSearched = false;
            }
          }
        },
      }),
  };
};

module.exports = {
  SearchBar,
  ChannelSummary,
  MessageView,
  Table,
};
