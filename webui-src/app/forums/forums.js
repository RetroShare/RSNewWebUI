const m = require('mithril');
const widget = require('widgets');
const rs = require('rswebui');
const util = require('forums/forums_util');
const viewUtil = require('forums/forum_view');
const peopleUtil = require('people/people_util');
const icon = require('icon');

const getForums = {
  All: [],
  //  Keyed by tab name, and the "All Forums" tab is called Other.
  Other: [],
  Popular: [],
  Subscribed: [],
  MyForums: [],
  async load() {
    const res = await rs.rsJsonApiRequest('/rsgxsforums/getForumsSummaries');
    if (res && res.body && res.body.forums) {
      getForums.All = res.body.forums;
      getForums.Other = getForums.All;
      getForums.Popular = getForums.All;
      getForums.Subscribed = getForums.All.filter(
        (forum) =>
          forum.mSubscribeFlags === util.GROUP_SUBSCRIBE_SUBSCRIBED ||
          forum.mSubscribeFlags === util.GROUP_MY_FORUM
      );
      getForums.MyForums = getForums.All.filter(
        (forum) => forum.mSubscribeFlags === util.GROUP_MY_FORUM
      );
      await getForums.loadDescriptions();
    }
  },

  //  Summaries carry no description. getForumsInfo takes a list, so the whole
  //  page costs one request -- asking per forum cost one per row.
  async loadDescriptions() {
    const ids = getForums.All.map((forum) => forum.mGroupId).filter(Boolean);
    if (ids.length === 0) return;
    const res = await rs.rsJsonApiRequest('/rsgxsforums/getForumsInfo', { forumIds: ids });
    const infos = res && res.body && res.body.forumsInfo;
    if (!Array.isArray(infos)) return;
    const byId = {};
    infos.forEach((info) => {
      if (info && info.mMeta) byId[info.mMeta.mGroupId] = info.mDescription;
    });
    getForums.All.forEach((forum) => {
      forum.description = byId[forum.mGroupId] || '';
    });
    m.redraw();
  },
};
//  Group lists change on the scale of a conversation, not of a frame.
const FORUM_LIST_REFRESH_MS = 30000;

//  Forums have no popularity split: Popular is the full list as the core
//  returns it, All the same list sorted by popularity. There is no Other.
const sections = {
  MyForums: require('forums/my_forums'),
  Subscribed: require('forums/subscribed_forums'),
  All: require('forums/all_forums'),
  Popular: require('forums/popular_forums'),
};

const navLabels = {
  MyForums: 'My Forums',
  Subscribed: 'Subscribed',
  All: 'All Forums',
  Popular: 'Popular',
};

//  The page title, which can say more than the rail label beside it.
const pageTitles = {
  MyForums: 'My Forums',
  Subscribed: 'Subscribed Forums',
  All: 'All Forums',
  Popular: 'Popular Forums',
};

const navIcons = {
  MyForums: 'comments',
  Subscribed: 'bookmark',
  All: 'globe',
  Popular: 'fire',
};

const Layout = () => {
  let ownId;
  const createForum = () =>
    ownId &&
    util.popupmessage(
      m(viewUtil.createforum, {
        authorId: ownId,
        onCreated: getForums.load,
      }),
      'create-forum-modal',
      {
        title: 'Create Forum',
        lead: 'Set up the forum and choose its publishing permissions.',
      }
    );

  return {
    oninit: () => {
      //  Was every 5 s. getForumsSummaries returns the whole list every time,
      //  and on a phone each poll is a fresh TCP handshake on a server that
      //  answers one request at a time; the boards list already settled on 30 s.
      rs.setBackgroundTask(getForums.load, FORUM_LIST_REFRESH_MS, () => {
        return m.route.get().includes('/forums');
      });
      peopleUtil.ownIds((data) => {
        ownId = data;
        for (let i = 0; i < ownId.length; i++) {
          if (Number(ownId[i]) === 0) {
            ownId.splice(i, 1);
          }
        }
        ownId.unshift(0);
      });
    },
    view: (vnode) => {
      const forumId = vnode.attrs.pathInfo.mGroupId;
      const msgId = vnode.attrs.pathInfo.mMsgId;
      return m('.widget', {
        //  A selected post is a state of the forum page, not a page of its own.
        //  The phone stylesheet uses it to show the reader in place of the list.
        class: [
          forumId ? 'forums-detail-widget' : '',
          msgId ? 'has-selection' : '',
        ].filter(Boolean).join(' '),
      }, [
        //  Only the list views get a page header: a forum carries its own
        //  heading, which is the forum's name rather than the tab's.
        !forumId && m(widget.PageHead, {
          class: 'group-list-head',
          title: pageTitles[vnode.attrs.pathInfo.tab] || 'Forums',
          actions: [
            vnode.attrs.pathInfo.tab === 'MyForums' &&
              m('button.forums-create-button.is-primary', {
                onclick: createForum,
              }, [icon('plus'), 'Create Forum']),
            m(util.SearchBar, {
              list: getForums.All,
            }),
          ],
        }),
        forumId
          ? m(viewUtil.ForumView, {
            id: forumId,
            msgId,
            onSubscriptionChange: getForums.load,
          })
          : m(sections[vnode.attrs.pathInfo.tab], {
            list: getForums[vnode.attrs.pathInfo.tab],
            onCreateForum: createForum,
          }),
      ]);
    },
  };
};

module.exports = {
  view: (vnode) => {
    return [
      m(widget.Sidebar, {
        tabs: Object.keys(sections),
        baseRoute: '/forums/',
        mobileDrawer: true,
        title: 'Forums',
        labels: navLabels,
        icons: navIcons,
      }),
      m('.node-panel', m(Layout, { pathInfo: vnode.attrs })),
    ];
  },
};
