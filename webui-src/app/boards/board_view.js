const m = require('mithril');
const rs = require('rswebui');
const util = require('boards/boards_util');
const Data = util.Data;
const peopleUtil = require('people/people_util');

const messageGroups = ['Public', 'Restricted Circle', 'Restricted Node Group'];
const messageGroupsCode = [util.PUBLIC, util.EXTERNAL, util.NODES_GROUP]; //rsgxscirles.h:50

function createboard() {
  let title;
  let body;
  let identity;
  let thumbnail;
  let selectedGroup = messageGroups[0];
  let selectedGroupCode = messageGroupsCode[0];
  let selectedCircle;
  let circles;
  return {
    oninit: async (vnode) => {
      if (vnode.attrs.authorId) {
        identity = vnode.attrs.authorId[0];
      }

      const res = await rs.rsJsonApiRequest('/rsgxscircles/getCirclesSummaries');
      if (res.body.retval) {
        circles = res.body.circles;
        selectedCircle = circles[0].mGroupName;
      }
    },
    view: (vnode) =>
      m('.widget', [
        m('h3', 'Create Board'),
        m('hr'),
        m('input[type=text][placeholder=Title]', {
          style: { float: 'left' },
          oninput: (e) => (title = e.target.value),
        }),
        m('div', { style: { float: 'right', marginTop: '10px', marginBottom: '10px' } }, [
          m('label[for=thumbnail]', 'Thumbnail: '),
          m('input[type=file][name=files][id=thumbnail][accept=image/*]', {
            onchange: async (e) => {
              let reader = new FileReader();
              reader.onloadend = function () {
                thumbnail = reader.result.substring(reader.result.indexOf(',') + 1);
              };
              reader.readAsDataURL(e.target.files[0]);
            },
          }),
        ]),

        m('div', { style: { float: 'right', marginTop: '10px', marginBottom: '10px' } }, [
          m('label[for=idtags]', 'Select identity: '),
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
                    rs.userList.userMap[o]
                      ? rs.userList.userMap[o].toLocaleString()
                      : 'No Signature'
                  )
                ),
            ]
          ),
        ]),
        m('div', { style: { float: 'left', marginTop: '10px', marginBottom: '10px' } }, [
          m('label[for=mtags]', 'Message Distribution: '),
          m(
            'select[id=mtags]',
            {
              value: selectedGroup,
              onchange: (e) => {
                selectedGroup = messageGroups[e.target.selectedIndex];
                selectedGroupCode = messageGroupsCode[e.target.selectedIndex];
                util.popupmessage(m(createboard, { authorId: vnode.attrs.authorId }));
              },
            },
            [messageGroups.map((group) => m('option', { value: group }, group))]
          ),
        ]),
        circles &&
          m(
            'div',
            {
              style: {
                float: 'left',
                marginTop: '10px',
                marginBottom: '10px',
                display: selectedGroupCode === util.EXTERNAL ? 'block' : 'none',
              },
            },
            [
              m('label[for=circlestag]', 'Circles: '),
              m(
                'select[id=circlestag]',
                {
                  value: selectedCircle,
                  onchange: (e) => {
                    selectedCircle = circles[e.target.selectedIndex];
                    console.log(selectedCircle);
                    // selectedGroupCode = messageGroupsCode[e.target.selectedIndex];
                  },
                },
                [
                  circles.map((circle) =>
                    m('option', { value: circle.mGroupName }, circle.mGroupName)
                  ),
                ]
              ),
            ]
          ),
        m('textarea[rows=5][placeholder=Description]', {
          style: { width: '100%', display: 'block' },
          oninput: (e) => (body = e.target.value),
          value: body,
        }),
        m(
          'button',
          {
            onclick: async () => {
              const res = await rs.rsJsonApiRequest('/rsposted/createBoardV2', {
                name: title,
                description: body,
                thumbnail: { mData: { base64: thumbnail } },
                ...(Number(identity) !== 0 && { authorId: identity }),
                circleType: selectedGroupCode,
                ...(selectedGroupCode === util.EXTERNAL &&
                  selectedCircle && { circleId: selectedCircle.mGroupId }),
              });
              if (res.body.retval) {
                util.updatedisplayboards(res.body.boardId);
                m.redraw();
              }
              res.body.retval === false
                ? util.popupmessage([m('h3', 'Error'), m('hr'), m('p', res.body.errorMessage)])
                : util.popupmessage([
                    m('h3', 'Success'),
                    m('hr'),
                    m('p', 'Board created successfully'),
                  ]);
            },
          },
          'Create'
        ),
      ]),
  };
}


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
        createDate = Data.DisplayBoards[v.attrs.id].created;
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

          m(
            'button',
            {
              onclick: async () => {
                const res = await rs.rsJsonApiRequest('/rsposted/subscribeToBoard', {
                  boardId: v.attrs.id,
                  subscribe: !bsubscribed,
                });
                if (res.body.retval) {
                  bsubscribed = !bsubscribed;
                  Data.DisplayBoards[v.attrs.id].isSubscribed = bsubscribed;
                }
              },
            },
            bsubscribed ? 'Subscribed' : 'Subscribe'
          ),
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
              style: 'display:' + (bsubscribed ? 'block' : 'none'),
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
  createboard,
};
