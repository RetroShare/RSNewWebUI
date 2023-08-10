const m = require('mithril');
const util = require('forums/forums_util');

const Layout = () => {
  let forumList = [];
  return {
    oninit: async (v) => {
      forumList = await v.attrs.list;
      forumList.map((forum) => util.updatedisplayforums(forum.mGroupId, 'SubscribedForums'));
    },
    view: (v) => [
      m('.widget__heading', m('h3', 'Subscribed Forums')),
      m('.widget__body', [
        m(
          util.ForumTable,
          m('tbody', [
            forumList &&
              forumList.map((forum) =>
                m(util.DisplayForumsFromList, {
                  id: forum.mGroupId,
                  category: 'SubscribedForums',
                })
              ),
          ])
        ),
      ]),
    ],
  };
};

module.exports = Layout;
