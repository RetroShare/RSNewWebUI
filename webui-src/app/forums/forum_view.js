const m = require('mithril');
const rs = require('rswebui');
const util = require('forums/forums_util');
const peopleUtil = require('people/people_util');
const { loadPostContent, getTimestampValue, formatTimestamp } = require('./forums_util');
const CIRCLE_PUBLIC = 1;
const CIRCLE_EXTERNAL = 2;

function createforum() {
  let title;
  let body;
  let identity;
  let circle = CIRCLE_PUBLIC;
  let circles = [];
  let selectedCircle;
  let enableModerators = false;
  let moderatorFilter = 'all';
  let moderatorSearch = '';
  const moderators = new Set();
  return {
    oninit: async (vnode) => {
      if (vnode.attrs.authorId) {
        identity = vnode.attrs.authorId[0];
      }
      const res = await rs.rsJsonApiRequest('/rsgxscircles/getCirclesSummaries');
      if (res.body.retval) {
        circles = res.body.circles || [];
        selectedCircle = circles[0];
      }
    },
    view: (vnode) => {
      const query = moderatorSearch.trim().toLowerCase();
      const identities = (rs.userList.users || [])
        .filter((item) => item && item.mGroupId)
        .filter((item) => moderatorFilter !== 'contacts' ||
          (rs.userList.userMap[item.mGroupId] && rs.userList.userMap[item.mGroupId].isContact))
        .filter((item) => !query || `${item.mGroupName} ${item.mGroupId}`.toLowerCase().includes(query))
        .sort((a, b) => (a.mGroupName || '').localeCompare(b.mGroupName || ''));
      return m('.widget.create-forum-form', [
        m('.create-forum-form__heading', [
          m('h3', 'Create Forum'),
          m('p', 'Set up the forum and choose its publishing permissions.'),
        ]),
        m('input.create-forum-form__title[type=text][placeholder=Forum title]', {
          oninput: (e) => (title = e.target.value),
        }),
        m('.create-forum-form__field', [
          m('label[for=forum-idtags]', 'Owner identity'),
          m('select.config-style-select[id=forum-idtags]', {
            value: identity,
            onchange: (e) => (identity = vnode.attrs.authorId[e.target.selectedIndex]),
          }, vnode.attrs.authorId && vnode.attrs.authorId.map((o) => m('option', { value: o },
            Number(o) === 0 ? 'No Signature' : `${rs.userList.username(o)} (${o.slice(0, 8)}...)`))),
        ]),
        m('.create-forum-form__field', [
          m('label[for=forum-distribution]', 'Message distribution'),
          m('select.config-style-select[id=forum-distribution]', {
            value: circle,
            onchange: (e) => (circle = e.target.value),
          }, [
            m('option', { value: CIRCLE_PUBLIC }, '\u{1F310}  Public'),
            m('option', { value: CIRCLE_EXTERNAL }, '\u25C9  Restricted to External Circle'),
          ]),
        ]),
        Number(circle) === CIRCLE_EXTERNAL && m('.create-forum-form__field', [
          m('label[for=forum-circle]', 'Circle'),
          m('select.config-style-select[id=forum-circle]', {
            value: selectedCircle && selectedCircle.mGroupId,
            onchange: (e) => (selectedCircle = circles.find((item) => item.mGroupId === e.target.value)),
          }, circles.length
            ? circles.map((item) => m('option', { value: item.mGroupId }, item.mGroupName))
            : m('option[disabled]', 'No circles available')),
        ]),
        m('.create-forum-form__moderators', [
          m('.create-forum-form__moderators-heading', [
            m('label.create-forum-form__moderators-toggle', [
              m('input[type=checkbox]', {
                checked: enableModerators,
                onchange: (e) => {
                  enableModerators = e.target.checked;
                  if (!enableModerators) {
                    moderators.clear();
                  }
                },
              }),
              m('span', 'Add moderators'),
            ]),
            enableModerators && m('span', `${moderators.size} selected`),
          ]),
          enableModerators && m('.create-forum-form__moderator-controls', [
            m('select.config-style-select[id=forum-moderator-filter]', {
              value: moderatorFilter,
              onchange: (e) => {
                moderatorFilter = e.target.value;
              },
            }, [
              m('option[value=all]', 'All identities'),
              m('option[value=contacts]', 'My contacts'),
            ]),
            m('.create-forum-form__search', [
              m('i.fas.fa-search'),
              m('input[id=forum-moderator-search][type=search][placeholder=Search identities]', {
                value: moderatorSearch,
                oninput: (e) => (moderatorSearch = e.target.value),
              }),
            ]),
            m('.create-forum-form__moderator-list', identities.length
              ? identities.map((item) => m('label.create-forum-form__moderator', [
              m('input[type=checkbox]', {
                checked: moderators.has(item.mGroupId),
                onchange: (e) => e.target.checked
                  ? moderators.add(item.mGroupId)
                  : moderators.delete(item.mGroupId),
              }),
              m(peopleUtil.UserAvatar, {
                firstLetter: (item.mGroupName || '?').slice(0, 1).toUpperCase(),
                identityId: item.mGroupId,
                size: 30,
                isSquare: true,
              }),
              m('span', [
                m('b', item.mGroupName || 'Unnamed identity'),
                m('small', item.mGroupId),
              ]),
              ]))
              : m('.create-forum-form__empty', query ? 'No matching identities' : 'No identities available')),
          ]),
        ]),
        m('textarea.create-forum-form__description[rows=5][placeholder=Describe your forum]', {
          oninput: (e) => (body = e.target.value),
          value: body,
        }),
        m('button.create-forum-form__submit',
          {
            onclick: async () => {
              const res = await rs.rsJsonApiRequest('/rsgxsforums/createForumV2', {
                name: title,
                description: body,
                ...(Number(identity) !== 0 && { authorId: identity }),
                moderatorsIds: enableModerators ? Array.from(moderators) : [],
                circleType: Number(circle),
                ...(Number(circle) === CIRCLE_EXTERNAL && selectedCircle && { circleId: selectedCircle.mGroupId }),
              });
              if (res.body.retval) {
                await util.updatedisplayforums(res.body.forumId);
                if (vnode.attrs.onCreated) await vnode.attrs.onCreated();
                m.redraw();
              }
              res.body.retval === false
                ? util.popupmessage([m('h3', 'Error'), m('hr'), m('p', res.body.errorMessage)])
                : util.popupmessage([
                  m('h3', 'Success'),
                  m('hr'),
                  m('p', 'Forum created successfully'),
                ]);
            },
          },
          'Create'
        ),
      ]);
    },
  };
}
const AddThread = () => {
  let title = '';
  let body = '';
  let identity;
  return {
    oninit: (vnode) => {
      if (vnode.attrs.authorId) {
        identity = vnode.attrs.authorId[0];
      }
    },
    view: (vnode) =>
      m('.widget', [
        m('h3', 'Add Thread'),
        m('hr'),
        (vnode.attrs.parent_thread !== '') > 0
          ? [m('h5', 'Reply to thread: '), m('p', vnode.attrs.parent_thread)]
          : '',
        m('input[type=text][placeholder=Title]', {
          oninput: (e) => (title = e.target.value),
        }),
        m('label[for=tags]', 'Select identity'),
        m(
          'select[id=idtags]',
          {
            value: identity,
            onchange: (e) => {
              identity = vnode.attrs.authorId[e.target.selectedIndex];
            },
          },
          [
            vnode.attrs.authorId &&
            vnode.attrs.authorId.map((o) =>
              m(
                'option',
                { value: o },
                rs.userList.username(o) + ' (' + o.slice(0, 8) + '...)'
              )
            ),
          ]
        ),
        m('textarea[rows=5]', {
          style: { width: '90%', display: 'block' },
          oninput: (e) => (body = e.target.value),
          value: body,
        }),
        m(
          'button',
          {
            onclick: async () => {
              const res =
                (vnode.attrs.parent_thread !== '') > 0 // is it a reply or a new thread
                  ? await rs.rsJsonApiRequest('/rsgxsforums/createPost', {
                    forumId: vnode.attrs.forumId,
                    mBody: body,
                    title,
                    authorId: identity,
                    parentId: vnode.attrs.parentId,
                  })
                  : await rs.rsJsonApiRequest('/rsgxsforums/createPost', {
                    forumId: vnode.attrs.forumId,
                    mBody: body,
                    title,
                    authorId: identity,
                  });

              res.body.retval === false
                ? util.popupmessage([m('h3', 'Error'), m('hr'), m('p', res.body.errorMessage)])
                : util.popupmessage([
                  m('h3', 'Success'),
                  m('hr'),
                  m('p', 'Thread added successfully'),
                ]);
              util.updatedisplayforums(vnode.attrs.forumId);
              m.redraw();
            },
          },
          'Add'
        ),
      ]),
  };
};

// getTimestampValue and formatTimestamp are imported from forums_util.js

const ThreadView = () => {
  let ownId;
  return {
    showThread: '',
    oninit: (v) => {
      util.updatedisplayforums(v.attrs.forumId);
      peopleUtil.ownIds((data) => {
        ownId = data;
        for (let i = 0; i < ownId.length; i++) {
          if (Number(ownId[i]) === 0) {
            ownId.splice(i, 1);
          }
        }
      });
    },
    view: (v) => {
      const forumId = v.attrs.forumId;
      const msgId = v.attrs.msgId;
      const threadStruct = (util.Data.Threads[forumId] && util.Data.Threads[forumId][msgId]) ? util.Data.Threads[forumId][msgId] : null;

      if (!threadStruct) {
        return m('.forum-thread-view', [
          m(
            'a[title=Back]',
            {
              onclick: () => m.route.set('/forums/:tab/:mGroupId', {
                tab: m.route.param().tab,
                mGroupId: forumId,
              }),
            },
            m('i.fas.fa-arrow-left')
          ),
          m('h3', 'Loading...'),
        ]);
      }

      const meta = threadStruct.thread.mMeta;
      const unread = meta.mMsgStatus === util.THREAD_UNREAD;

      return m('.forum-thread-view', { key: msgId }, [
        m(
          'a[title=Back]',
          {
            onclick: () => m.route.set('/forums/:tab/:mGroupId', {
              tab: m.route.param().tab,
              mGroupId: forumId,
            }),
          },
          m('i.fas.fa-arrow-left')
        ),
        m('div.post-header', { style: { margin: '10px 0' } }, [
          m('div.date', { style: { color: '#888', fontSize: '0.9em' } }, formatTimestamp(meta.mPublishTs)),
          m('h4.title', { style: { margin: '5px 0', fontWeight: 'bold' } }, meta.mMsgName),
          m('div.author', { style: { fontStyle: 'italic', fontSize: '1em' } }, rs.userList.username(meta.mAuthorId)),
        ]),
        m('hr'),
        m('div.actions', { style: { marginBottom: '15px' } }, [
          m('button', {
            style: { marginRight: '10px' },
            onclick: () => util.popupmessage(m(AddThread, {
              parent_thread: meta.mMsgName,
              forumId,
              authorId: ownId,
              parentId: msgId,
            }))
          }, 'Reply'),
          m('button', {
            onclick: async () => {
              const res = await rs.rsJsonApiRequest('/rsgxsforums/markRead', {
                messageId: { first: forumId, second: meta.mOrigMsgId },
                read: !unread,
              });
              if (res.body.retval) {
                util.updatedisplayforums(forumId);
                m.redraw();
              }
            }
          }, unread ? 'Mark Read' : 'Mark Unread'),
        ]),
        m('div.forum-post-content', {
          style: {
            width: '100%',
            backgroundColor: '#f9f9f9',
            padding: '15px',
            borderRadius: '5px',
            whiteSpace: 'pre-wrap', // Preserve line breaks
            wordBreak: 'break-word',
          }
        }, [
          threadStruct.thread.mMsg !== null
            ? m.trust(threadStruct.thread.mMsg)
            : (loadPostContent(forumId, msgId), m('p', 'Loading content...'))
        ]),
      ]);
    },
  };
};

const ForumView = () => {
  let ownId = '';
  return {
    oninit: (v) => {
      util.updatedisplayforums(v.attrs.id);
      peopleUtil.ownIds((data) => {
        ownId = data;
        for (let i = 0; i < ownId.length; i++) {
          if (Number(ownId[i]) === 0) {
            ownId.splice(i, 1);
          }
        }
      });
    },
    view: (v) => {
      const forumDetails = util.Data.DisplayForums[v.attrs.id] || {
        name: 'Loading...',
        isSubscribed: false,
        created: {},
        activity: {},
        author: '0',
        description: 'Loading...',
      };
      const allPosts = util.Data.Threads[v.attrs.id]
        ? Object.values(util.Data.Threads[v.attrs.id]).map((ts) => ts.thread.mMeta)
        : [];
      const fname = forumDetails.name;
      const fsubscribed = forumDetails.isSubscribed;
      const createDate = forumDetails.created;
      const lastActivity = forumDetails.activity;
      //  userMap holds {name, isContact} objects, so it must not be read
      //  directly into the view: username() is what turns an id into a string.
      let fauthor = 'Unknown';

      if (Number(forumDetails.author) === 0) {
        fauthor = 'No Contact Author';
      } else if (forumDetails.author) {
        fauthor = rs.userList.username(forumDetails.author);
      }

      return [
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

        m('.widget__heading.forum-detail-heading', [
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
                  util.Data.DisplayForums[v.attrs.id].isSubscribed = !fsubscribed;
                }
              },
            },
            fsubscribed ? 'Subscribed' : 'Subscribe'
          ),
        ]),
        m('.forum-detail-card', [
          m('.forum-detail-card__icon[role=img][aria-label=Forum]',
            m('i.fas.fa-bullhorn')
          ),
          m('.forum-detail-card__details', [
            m('div', [m('b', 'Date created: '), m('span', formatTimestamp(createDate))]),
            m('div', [m('b', 'Admin: '), m('span', fauthor)]),
            m('div', [m('b', 'Last activity: '), m('span', formatTimestamp(lastActivity))]),
          ]),
          m('.forum-detail-card__description', [
            m('b', 'Description: '),
            m('span', forumDetails.description || 'No Description'),
          ]),
        ]),
        m(
          'threaddetails.forum-threads',
          {
            style: 'display:' + (fsubscribed ? 'block' : 'none'),
          },
          m('.forum-threads__heading', [
            m('h3', 'Threads'),
            m(
              'button.forum-threads__create[type=button][title=New Thread][aria-label=New Thread]',
              {
                onclick: () => {
                  util.popupmessage(
                    m(AddThread, {
                      parent_thread: '',
                      forumId: v.attrs.id,
                      authorId: ownId,
                      parentId: '',
                    })
                  );
                },
              },
              [m('i.fas.fa-pencil-alt'), m('span', 'New Thread')]
            ),
          ]),
          m(
            util.ThreadsTable,
            m(
              'tbody',
              allPosts
                .sort((a, b) => getTimestampValue(b.mPublishTs) - getTimestampValue(a.mPublishTs))
                .map((thread) =>
                  m(
                    'tr',
                    {
                      style:
                        thread.mMsgStatus === util.THREAD_UNREAD ? { fontWeight: 'bold' } : '',
                    },
                    m('td', { style: { padding: '10px 0' } }, [
                      m('div.date', { style: { fontSize: '0.8em', color: '#888' } },
                        formatTimestamp(thread.mPublishTs)
                      ),
                      m('div.title', {
                        style: { fontWeight: 'bold', fontSize: '1.2em', cursor: 'pointer', margin: '5px 0' },
                        onclick: () => {
                          m.route.set('/forums/:tab/:mGroupId/:mMsgId', {
                            tab: m.route.param().tab,
                            mGroupId: v.attrs.id,
                            mMsgId: thread.mOrigMsgId,
                          });
                        },
                      }, thread.mMsgName),
                      m('div.author', { style: { fontSize: '0.9em', fontStyle: 'italic' } }, rs.userList.username(thread.mAuthorId)),
                    ])
                  )
                )
            )
          )
        ),
      ];
    },
  };
};

module.exports = {
  ForumView,
  ThreadView,
  createforum,
};
