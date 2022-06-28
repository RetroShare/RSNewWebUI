const m = require('mithril');
const rs = require('rswebui');
const util = require('boards/boards_util');
const Data = util.Data;
const peopleUtil = require('people/people_util');

const BoardView = () => {
  let bname = '';
  let bimage = '';
  let bauthor = '';
  let bsubscribed = {};
  let bposts = 0;
  let plist = {};
  let createDate = {};
  let lastActivity = {};
  return {
    oninit: (v) => {
      if (Data.DisplayBoards[v.attrs.id]) {
        bname = Data.DisplayBoards[v.attrs.id].name;
        bimage = Data.DisplayBoards[v.attrs.id].image;
        if (rs.userList.userMap[Data.DisplayBoards[v.attrs.id].author]) {
          bauthor = rs.userList.userMap[Data.DisplayBoards[v.attrs.id].author];
        } else if (Number(Data.DisplayBoards[v.attrs.id].author) === 0) {
          bauthor = 'No Contact Author';
        } else {
          bauthor = 'Unknown';
        }
        bsubscribed = Data.DisplayBoards[v.attrs.id].isSubscribed;
        bposts = Data.DisplayBoards[v.attrs.id].posts;
        breateDate = Data.DisplayBoards[v.attrs.id].created;
        lastActivity = Data.DisplayBoards[v.attrs.id].activity;
      }
      if (Data.Posts[v.attrs.id]) {
        plist = Data.Posts[v.attrs.id];
      }
    },
    view: (v) =>
      m(
        '.widget',
        {
          key: v.attrs.id,
        },
        [
          m(
            'a[title=Back]',
            {
              onclick: () =>
                m.route.set('/boards/:tab', {
                  tab: m.route.param().tab,
                }),
            },
            m('i.fas.fa-arrow-left')
          ),
          m('h3', bname),

          /*m(
            'button',
            {
              onclick: async () => {
                const res = await rs.rsJsonApiRequest('/rsposted/subscribeToBoard', {
                  channelId: v.attrs.id,
                  subscribe: !csubscribed,
                });
                if (res.body.retval) {
                  csubscribed = !csubscribed;
                  Data.DisplayBoards[v.attrs.id].isSubscribed = csubscribed;
                }
              },
            },
            bsubscribed ? 'Subscribed' : 'Subscribe'
          ),*/

          m('img.boardpic', {
            src: 'data:image/png;base64,' + bimage.mData.base64,
          }),
          m('[id=boarddetails]', [
            m('p', m('b', 'Posts: '), bposts),
            m(
              'p',
              m('b', 'Date created: '),
              typeof createDate === 'object'
                ? new Date(createDate.xint64 * 1000).toLocaleString()
                : 'undefined'
            ),
            m('p', m('b', 'Admin: '), bauthor),
            m(
              'p',
              m('b', 'Last activity: '),
              typeof lastActivity === 'object'
                ? new Date(lastActivity.xint64 * 1000).toLocaleString()
                : 'undefined'
            ),
          ]),
          m('hr'),
          m('boarddesc', m('b', 'Description: '), Data.DisplayBoards[v.attrs.id].description),
          m('hr'),
          m(
            'postdetails',
            {
              style: 'display:' + (csubscribed ? 'block' : 'none'),
            },
            m('h3', 'Posts'),

            m(
              '[id=grid]',
              Object.keys(plist).map((key, index) => [
                m(
                  'div',
                  {
                    class: 'card',
                    style: 'display: ' + (plist[key].isSearched? 'block': 'none'),
                    onclick: () => {
                      m.route.set('/boards/:tab/:mGroupId/:mMsgId', {
                        tab: m.route.param().tab,
                        mGroupId: v.attrs.id,
                        mMsgId: key,
                      });
                    },
                  },
                  [
                    m('img', {
                      class: 'card-img',
                      src: 'data:image/png;base64,' + plist[key].post.mThumbnail.mData.base64,

                      alt: 'No Thumbnail',
                    }),
                    m('div', { class: 'card-info' }, [
                      m('h4', { class: 'card-title' }, plist[key].post.mMeta.mMsgName),
                    ]),
                  ]
                ),
              ])
            )
          ),
        ]
      ),
  };
};


module.exports = {
  BoardView,
};
