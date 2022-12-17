const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');

const util = require('mail/mail_util');

const Data = {
  Recepients: [],
  sendTypes: ['To', 'cc', 'Bcc'],
  // Recepients will have objects of type {type: (0 -> To, 1 -> CC, 2 -> BCC), receiverId: (id)}
};
const Layout = () => {
  let subject;
  let body;
  let identity;
  return {
    oninit: async (v) => {
      identity = v.attrs.ownId[0];
    },
    view: (v) =>
      m('.widget', [
        m('h3', 'Compose a mail'),
        m('hr'),
        m('input[type=text][placeholder=Subject]', {
          style: { float: 'left' },
          oninput: (e) => (subject = e.target.value),
        }),

        m(
          'div',
          {
            style: {
              display: 'block ruby',
              float: 'right',
            },
          },
          [
            m('label[for=idtags]', 'From: '),
            m(
              'select[id=idtags]',
              {
                value: identity,
                onchange: (e) => {
                  identity = v.attrs.ownId[e.target.selectedIndex];
                },
              },
              [
                v.attrs.ownId &&
                  v.attrs.ownId.map((o) =>
                    m(
                      'option',
                      { value: o },
                      rs.userList.userMap[o]
                        ? rs.userList.userMap[o].toLocaleString() + ' (' + o.slice(0, 8) + '...)'
                        : 'No Signature'
                    )
                  ),
              ]
            ),
          ]
        ),
        m(
          'button',
          {
            style: { float: 'left', display: 'block' },
            onclick: () => {
              Data.Recepients.push({ type: 0, receiverIndex: undefined, showRecepient: true });
              util.popupMessageCompose(
                m(Layout, { allUsers: v.attrs.allUsers, ownId: v.attrs.ownId })
              );
            },
          },
          'Add Recepient'
        ),
        Data.Recepients.map((rec, index) => [
          m(
            'rec',
            { style: { display: rec.showRecepient ? 'block ruby' : 'none', fontSize: '0.8em' } },
            [
              m(
                'select[id=typecc]',
                {
                  value: Data.sendTypes[Data.Recepients[index].type],
                  onchange: (e) => {
                    Data.Recepients[index].type = e.target.selectedIndex;
                    console.log(Data.Recepients[index]);
                  },
                },
                [Data.sendTypes && Data.sendTypes.map((o) => m('option', { value: o }, o))]
              ),
              v.attrs.allUsers &&
                m(
                  'select[id=id]',
                  {
                    value: v.attrs.allUsers[Data.Recepients[index].receiverIndex],
                    onchange: (e) => {
                      Data.Recepients[index].receiverIndex = e.target.selectedIndex;
                      console.log(Data.Recepients[index]);
                    },
                  },
                  [
                    v.attrs.allUsers.map((o) =>
                      m(
                        'option',
                        { value: o },
                        o.mGroupName + ' (' + o.mGroupId.slice(0, 8) + '...)'
                      )
                    ),
                  ]
                ),
              m(
                'button',
                {
                  style: { background: '#bd0909' },
                  onclick: () => {
                    Data.Recepients[index].showRecepient = false;
                    util.popupMessageCompose(
                      m(Layout, { allUsers: v.attrs.allUsers, ownId: v.attrs.ownId })
                    );
                  },
                },
                m('i.fas.fa-times')
              ),
            ]
          ),
        ]),
        m('textarea[rows=5][placeholder=Message]', {
          style: { width: '100%', display: 'block' },
          oninput: (e) => (body = e.target.value),
          value: body,
        }),

        v.attrs.allUsers &&
          m(
            'button',
            {
              onclick: async () => {
                const toList = [];
                const ccList = [];
                const bccList = [];

                for (let i = 0; i < Data.Recepients.length; i++) {
                  if (Data.Recepients[i].showRecepient && Data.Recepients[i].receiverIndex) {
                    if (Data.Recepients[i].type === 0) {
                      toList.push(v.attrs.allUsers[Data.Recepients[i].receiverIndex].mGroupId);
                    } else if (Data.Recepients[i].type === 1) {
                      ccList.push(v.attrs.allUsers[Data.Recepients[i].receiverIndex].mGroupId);
                    } else if (Data.Recepients[i].type === 2) {
                      bccList.push(v.attrs.allUsers[Data.Recepients[i].receiverIndex].mGroupId);
                    }
                  }
                }
                const res = await rs.rsJsonApiRequest('/rsMsgs/sendMail', {
                  from: identity,
                  subject,
                  mailBody: body,
                  to: toList,
                  cc: ccList,
                  bcc: bccList,
                });
                if (res.body.retval) {
                  Data.Recepients = [];
                  m.redraw();
                }
                res.body.retval !== 1
                  ? widget.popupMessage([m('h3', 'Error'), m('hr'), m('p', res.body.errorMessage)])
                  : widget.popupMessage([
                      m('h3', 'Success'),
                      m('hr'),
                      m('p', 'Mail Sent successfully'),
                    ]);
              },
            },
            'Send'
          ),
      ]),
  };
};

module.exports = Layout();
