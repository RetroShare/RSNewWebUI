const m = require('mithril');
const rs = require('rswebui');
const util = require('forums/forums_util');

const ThreadView = () => {

  let thread = {};
    return {
    oninit: (v) => {
      if (
        util.Data.ParentThreads[v.attrs.forumId] &&
        util.Data.ParentThreads[v.attrs.forumId][v.attrs.msgId]
      ) {
        thread = util.Data.ParentThreads[v.attrs.forumId][v.attrs.msgId];
      }
    },
    view: (v) =>
      m('.widget', { key: v.attrs.msgId }, [
        m(
          'a[title=Back]',
          {
            onclick: () =>
              m.route.set('/forums/:tab/:mGroupId', {
                tab: m.route.param().tab,
                mGroupId: m.route.param().mGroupId,
              }),
          },
          m('i.fas.fa-arrow-left')
        ),
        m('h3', thread.mMsgName),
      ]),
  };
};

const ForumView = () => {
  let fname = '';
  let fauthor = '';
  let fsubscribed = {};
  let createDate = {};
  let lastActivity = {};
  let topThreads = {};
  return {
    oninit: (v) => {
      if (util.Data.DisplayForums[v.attrs.id]) {
        fname = util.Data.DisplayForums[v.attrs.id].name;
        fsubscribed = util.Data.DisplayForums[v.attrs.id].isSubscribed;
        createDate = util.Data.DisplayForums[v.attrs.id].created;
        lastActivity = util.Data.DisplayForums[v.attrs.id].activity;
        if (rs.userList.userMap[util.Data.DisplayForums[v.attrs.id].author]) {
          fauthor = rs.userList.userMap[util.Data.DisplayForums[v.attrs.id].author];
        } else if (Number(util.Data.DisplayForums[v.attrs.id].author) === 0) {
          fauthor = 'No Contact Author';
        } else {
          fauthor = 'Unknown';
        }
      }
      if (util.Data.ParentThreads[v.attrs.id]) {
        topThreads = util.Data.ParentThreads[v.attrs.id];
      }
      console.log(util.Data.ParentThreads, v.attrs.id);
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
                m.route.set('/forums/:tab', {
                  tab: m.route.param().tab,
                }),
            },
            m('i.fas.fa-arrow-left')
          ),

          m('h3', fname),
          m(
            'button',
            {
              onclick: async () => {
                const res = await rs.rsJsonApiRequest('/rsgxsforums/subscribeToForum', {
                  forumId: v.attrs.id,
                  subscribe: !fsubscribed,
                });
                if (res.body.retval) {
                  fsubscribed = !fsubscribed;
                  util.Data.DisplayForums[v.attrs.id].isSubscribed = fsubscribed;
                }
              },
            },
            fsubscribed ? 'Subscribed' : 'Subscribe'
          ),
          m('[id=forumdetails]', [
            m(
              'p',
              m('b', 'Date created: '),
              typeof createDate === 'object'
                ? new Date(createDate.xint64 * 1000).toLocaleString()
                : 'undefined'
            ),
            m('p', m('b', 'Admin: '), fauthor),
            m(
              'p',
              m('b', 'Last activity: '),
              typeof lastActivity === 'object'
                ? new Date(lastActivity.xint64 * 1000).toLocaleString()
                : 'undefined'
            ),
          ]),
          m('hr'),
          m('forumdesc', m('b', 'Description: '), util.Data.DisplayForums[v.attrs.id].description),
          m('hr'),
          m(
            'threaddetails',
            {
              style: 'display:' + (fsubscribed ? 'block' : 'none'),
            },
            m('h3', 'Threads'),
            m('button', { onclick: () => util.popupMessage() }, [
              'New Thread',
              m('i.fas.fa-pencil-alt'),
            ]),
            m('hr'),
            m(
              util.ThreadsTable,
              m(
                'tbody',
                Object.keys(topThreads).map((key, index) =>
                  m(
                    'tr',
                    {
                      onclick: () => {
                        m.route.set('/forums/:tab/:mGroupId/:mMsgId', {
                          tab: m.route.param().tab,
                          mGroupId: v.attrs.id,
                          mMsgId: topThreads[key].mMsgId,
                        });
                      },
                    },
                    [
                      m('td', topThreads[key].mMsgName),
                      m(
                        'td',
                        typeof topThreads[key].mPublishTs === 'object'
                          ? new Date(topThreads[key].mPublishTs.xint64 * 1000).toLocaleString()
                          : 'undefined'
                      ),
                      m(
                        'td',
                        rs.userList.userMap[topThreads[key].mAuthorId]
                          ? rs.userList.userMap[topThreads[key].mAuthorId]
                          : 'Unknown'
                      ),
                    ]
                  )
                )
              )
            )
          ),
        ]
      ),
  };
};

module.exports = {
  ForumView,
  ThreadView,
};
