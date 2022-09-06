const m = require('mithril');
const rs = require('rswebui');
const util = require('forums/forums_util');
const peopleUtil = require('people/people_util');
const { updatedisplayforums } = require('./forums_util');

function createforum() {
  let title;
  let body;
  let identity;
  return {
    oninit: (vnode) => {
      if (vnode.attrs.authorId) {
        identity = vnode.attrs.authorId[0];
      }
    },
    view: (vnode) =>
      m('.widget', [
        m('h3', 'Create Forum'),
        m('hr'),
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
                  rs.userList.userMap[o] ? rs.userList.userMap[o].toLocaleString() : 'No Signature'
                )
              ),
          ]
        ),
        m('textarea[rows=5][placeholder=Description]', {
          style: { width: '90%', display: 'block' },
          oninput: (e) => (body = e.target.value),
          value: body,
        }),
        m(
          'button',
          {
            onclick: async () => {
              const res = await rs.rsJsonApiRequest('/rsgxsforums/createForumV2', {
                name: title,
                description: body,
                ...(Number(identity) !== 0 && { authorId: identity }), // if id == '0', authorId is left empty
              });
              if (res.body.retval) {
                util.updatedisplayforums(res.body.forumId);
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
      ]),
  };
}
const EditThread = () => {
  let title = '';
  let body = '';
  return {
    oninit: (vnode) => {
      title = vnode.attrs.current_title;
      body = vnode.attrs.current_body;
    },
    view: (vnode) =>
      m('.widget', [
        m('h3', 'Edit Thread'),
        m('hr'),

        m(
          'iddisplay',
          {
            style: { display: 'block ruby' }, // same line block ruby
          },
          [
            'Identity: ',
            m('h5[id=authid]', rs.userList.userMap[vnode.attrs.authorId].toLocaleString()),
          ]
        ),
        m(
          'titledisplay',
          {
            style: { display: 'block ruby' },
          },
          [
            'Title: ',
            m('input[type=text][placeholder=Title]', {
              value: vnode.attrs.current_title,
              oninput: (e) => (title = e.target.value),
            }),
          ]
        ),
        m('textarea[rows=5]', {
          style: { width: '90%', display: 'block' },
          oninput: (e) => (body = e.target.value),
          value: vnode.attrs.current_body,
        }),
        m(
          'button',
          {
            onclick: async () => {
              const res = await rs.rsJsonApiRequest('/rsgxsforums/createPost', {
                forumId: vnode.attrs.forumId,
                mBody: body,
                title: title,
                authorId: vnode.attrs.authorId,
                parentId: vnode.attrs.current_parent,
                origPostId: vnode.attrs.current_msgid,
              });
              res.body.retval === false
                ? util.popupmessage([m('h3', 'Error'), m('hr'), m('p', res.body.errorMessage)])
                : util.popupmessage([
                    m('h3', 'Success'),
                    m('hr'),
                    m('p', 'Thread edited successfully'),
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
                m('option', { value: o }, rs.userList.userMap[o].toLocaleString())
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
                      title: title,
                      authorId: identity,
                      parentId: vnode.attrs.parentId,
                    })
                  : await rs.rsJsonApiRequest('/rsgxsforums/createPost', {
                      forumId: vnode.attrs.forumId,
                      mBody: body,
                      title: title,
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
function displaythread() {
  // recursive function to display all the threads
  let groupmessagepair;
  let unread;
  let editpermission = false;
  return {
    view: (v) => {
      const thread = v.attrs.threadStruct.thread;
      groupmessagepair = { first: thread.mMeta.mGroupId, second: thread.mMeta.mOrigMsgId };
      let parMap = [];
      if (util.Data.ParentThreadMap[thread.mMeta.mOrigMsgId]) {
        parMap = util.Data.ParentThreadMap[thread.mMeta.mOrigMsgId];
      }
      unread = thread.mMeta.mMsgStatus === util.THREAD_UNREAD;
      v.attrs.identity &&
        v.attrs.identity.map((val) => {
          if (val.localeCompare(thread.mMeta.mAuthorId) === 0) {
            // if the author of the thread matches one of our own ids
            editpermission = true;
          }
        });
      return [
        m(
          'tr',
          {
            style: unread ? { fontWeight: 'bold' } : '',
          },
          [
            Object.keys(parMap).length // if this thread has some replies
              ? m(
                  'td',
                  m('i.fas.fa-angle-right', {
                    class: 'fa-rotate-' + (v.attrs.threadStruct.showReplies ? '90' : '0'),
                    style: 'margin-top:12px',
                    onclick: () => {
                      v.attrs.threadStruct.showReplies = !v.attrs.threadStruct.showReplies;
                    },
                  })
                )
              : m('td', ''),

            m(
              'td',
              {
                style: {
                  position: 'relative',
                  '--replyDepth': v.attrs.replyDepth,
                  left: 'calc(30px*var(--replyDepth))', // shifts reply by 30 px
                },
                onclick: async () => {
                  v.attrs.changeThread(thread.mMeta.mOrigMsgId);
                  if (unread) {
                    const res = await rs.rsJsonApiRequest('/rsgxsforums/markRead', {
                      messageId: groupmessagepair,
                      read: true,
                    });
                    if (res.body.retval) {
                      updatedisplayforums(thread.mMeta.mGroupId);
                      m.redraw();
                    }
                  }
                },
                ondblclick: () =>
                  (v.attrs.threadStruct.showReplies = !v.attrs.threadStruct.showReplies),
              },
              [
                thread.mMeta.mMsgName,
                m('options', { style: 'display:block' }, [
                  m(
                    'button',
                    {
                      style: 'font-size:15px',
                      onclick: () =>
                        util.popupmessage(
                          m(AddThread, {
                            parent_thread: thread.mMeta.mMsgName,
                            forumId: thread.mMeta.mGroupId,
                            authorId: v.attrs.identity,
                            parentId: thread.mMeta.mMsgId,
                          })
                        ),
                    },
                    'Reply'
                  ),
                  editpermission &&
                    m(
                      'button',
                      {
                        style: 'font-size:15px',
                        onclick: () =>
                          util.popupmessage(
                            m(EditThread, {
                              current_thread: thread.mMeta.mMsgName,
                              forumId: thread.mMeta.mGroupId,
                              current_title: thread.mMeta.mMsgName,
                              current_body: thread.mMsg,
                              authorId: thread.mMeta.mAuthorId,
                              current_parent: thread.mMeta.mParentId,
                              current_msgid: thread.mMeta.mOrigMsgId,
                            })
                          ),
                      },
                      'Edit'
                    ),
                ]),
              ]
            ),
            m(
              'td',
              m(
                'button',
                {
                  style: { fontSize: '15px' },
                  onclick: async () => {
                    if (!unread) {
                      const res = await rs.rsJsonApiRequest('/rsgxsforums/markRead', {
                        messageId: groupmessagepair,
                        read: false,
                      });

                      if (res.body.retval) {
                        updatedisplayforums(thread.mMeta.mGroupId);
                        m.redraw();
                      }
                    }
                  },
                },
                'Mark Unread'
              )
            ),
            m('td', rs.userList.userMap[thread.mMeta.mAuthorId]),
            m(
              'td',
              typeof thread.mMeta.mPublishTs === 'object'
                ? new Date(thread.mMeta.mPublishTs.xint64 * 1000).toLocaleString()
                : 'undefined'
            ),
          ]
        ),
        v.attrs.threadStruct.showReplies &&
          Object.keys(parMap).map((key, index) =>
            m(displaythread, {
              // recursive call to all replies
              threadStruct: util.Data.Threads[parMap[key].mGroupId][parMap[key].mOrigMsgId],
              replyDepth: v.attrs.replyDepth + 1,
              identity: v.attrs.identity,
              changeThread: v.attrs.changeThread,
            })
          ),
      ];
    },
  };
}

const ThreadView = () => {
  let thread = {};
  let ownId;
  return {
    showThread: '',
    oninit: async (v) => {
      if (
        util.Data.ParentThreads[v.attrs.forumId] &&
        util.Data.ParentThreads[v.attrs.forumId][v.attrs.msgId]
      ) {
        thread = util.Data.ParentThreads[v.attrs.forumId][v.attrs.msgId];
      }
      peopleUtil.ownIds((data) => {
        ownId = data;
        for (let i = 0; i < ownId.length; i++) {
          if (Number(ownId[i]) === 0) {
            ownId.splice(i, 1);
          }
        }
      });
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
        m('hr'),
        m(
          util.ThreadsReplyTable,
          m(
            'tbody',
            util.Data.Threads[v.attrs.forumId] &&
              util.Data.Threads[v.attrs.forumId][v.attrs.msgId] &&
              m(displaythread, {
                threadStruct: util.Data.Threads[v.attrs.forumId][v.attrs.msgId],
                replyDepth: 0,
                identity: ownId,
                changeThread(newThread) {
                  v.state.showThread = newThread; 
                  // For displaying the messages of the threads. We pass this into the recursive function displaythreads()
                },
              })
          )
        ),
        m('hr'),
        v.state.showThread && [
          m('h4', 'Messages'),
          util.Data.Threads[v.attrs.forumId] &&
            util.Data.Threads[v.attrs.forumId][v.state.showThread] &&
            m('p', m.trust(util.Data.Threads[v.attrs.forumId][v.state.showThread].thread.mMsg)),
            // m.trust is to render html content directly.
        ],
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
  let ownId = '';
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
      peopleUtil.ownIds((data) => {
        ownId = data;
        for (let i = 0; i < ownId.length; i++) {
          if (Number(ownId[i]) === 0) {
            ownId.splice(i, 1);
          }
        }
      });
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
            m(
              'button',
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
              ['New Thread', m('i.fas.fa-pencil-alt')]
            ),
            m('hr'),
            m(
              util.ThreadsTable,
              m(
                'tbody',
                Object.keys(topThreads).map((key, index) =>
                  m(
                    'tr',
                    {
                      style:
                        topThreads[key].mMsgStatus === util.THREAD_UNREAD
                          ? { fontWeight: 'bold' }
                          : '',
                      onclick: () => {
                        m.route.set('/forums/:tab/:mGroupId/:mMsgId', {
                          tab: m.route.param().tab,
                          mGroupId: v.attrs.id,
                          mMsgId: topThreads[key].mOrigMsgId,
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
  createforum,
};
