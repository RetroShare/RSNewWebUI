const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');

const Layout = () => {
  let subject;
  let mailBody;
  let identity;
  let inputTo;
  let inputList;
  const recipients = {
    to: [],
    cc: [],
    bcc: [],
  };
  return {
    oninit: (v) => {
      identity = v.attrs.ownId[0];
      inputList = v.attrs.allUsers;
    },
    view: (v) => {
      function handleInput(e) {
        inputTo = e.target.value;
        inputList = v.attrs.allUsers.filter((item) =>
          item.mGroupName.toLowerCase().includes(e.target.value.toLowerCase())
        );
      }
      function handleClick(item) {
        recipients.to.push(item);
        // reset values
        inputTo = '';
        inputList = v.attrs.allUsers;
      }
      return m('.widget', [
        m('.widget__heading', m('h3', 'Compose a mail')),
        m('.widget__body.compose-mail', [
          m('.compose-mail__from', [
            m('label[for=idtags].bold', 'From: '),
            m(
              'select[id=idtags]',
              {
                value: identity,
                onchange: (e) => (identity = v.attrs.ownId[e.target.selectedIndex]),
              },
              v.attrs.ownId &&
                v.attrs.ownId.map((id) =>
                  m(
                    'option',
                    { value: id },
                    rs.userList.userMap[id]
                      ? rs.userList.userMap[id].toLocaleString() + ' (' + id.slice(0, 8) + '...)'
                      : 'No Signature'
                  )
                )
            ),
          ]),
          m('.compose-mail__recipients', [
            m('label.bold', 'To: '),
            m('.recipients__to', [
              recipients.to &&
                recipients.to.length > 0 &&
                recipients.to.map((recipient) =>
                  m('.recipients__to__selected', [
                    m('span', recipient.mGroupName),
                    m('i.fas.fa-times', {
                      onclick: () => {
                        recipients.to = recipients.to.filter(
                          (item) => item.mGroupId !== recipient.mGroupId
                        );
                        m.redraw();
                      },
                    }),
                  ])
                ),
              m('.recipients__to__input', [
                m('input[type=text].recipients__to__input-field', {
                  value: inputTo,
                  oninput: handleInput,
                }),
                m('ul.recipients__to__input-list[autocomplete=off]', [
                  inputList && inputList.length > 0
                    ? inputList.map((item) =>
                        m('li', { onclick: () => handleClick(item) }, item.mGroupName)
                      )
                    : m('li', 'No Item'),
                ]),
              ]),
            ]),
          ]),
          m('input.compose-mail__subject[type=text][placeholder=Subject]', {
            oninput: (e) => (subject = e.target.value),
          }),
          m('textarea.compose-mail__message[placeholder=Message]', {
            oninput: (e) => (mailBody = e.target.value),
            value: mailBody,
          }),
          v.attrs.allUsers &&
            m(
              'button.compose-mail__send-btn',
              {
                onclick: () => {
                  const to = recipients.to.map((toItem) => toItem.mGroupId);
                  const cc = recipients.cc.map((toItem) => toItem.mGroupId);
                  const bcc = recipients.bcc.map((toItem) => toItem.mGroupId);
                  rs.rsJsonApiRequest('/rsMsgs/sendMail', {
                    from: identity,
                    subject,
                    mailBody,
                    to,
                    cc,
                    bcc,
                  }).then((res) => {
                    if (res.body.retval) {
                      recipients.to = [];
                      recipients.cc = [];
                      recipients.bcc = [];
                      subject = '';
                      mailBody = '';
                      m.redraw();
                    }
                    res.body.retval !== 1
                      ? widget.popupMessage([m('h3', 'Error'), m('hr'), m('p', res.body.errorMsg)])
                      : widget.popupMessage([
                          m('h3', 'Success'),
                          m('hr'),
                          m('p', 'Mail Sent successfully'),
                        ]);
                  });
                },
              },
              [m('span', 'Send Mail'), m('i.fas.fa-paper-plane')]
            ),
        ]),
      ]);
    },
  };
};

module.exports = Layout();
