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
    oninit: (v) => (identity = v.attrs.ownId[0]),
    view: (v) => {
      function handleInput(e) {
        inputTo = e.target.value;
        console.log(inputTo);
        inputList = v.attrs.allUsers.filter((item) =>
          item.mGroupName.toLowerCase().includes(e.target.value.toLowerCase())
        );
        console.log(inputList);
        m.redraw();
      }
      function handleClick(e, item) {
        console.log(e.target.value, item);
        recipients.to.push(item);
        m.redraw();
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
            m('.compose-mail__recipients-to', [
              recipients.to.length > 0 &&
                m(
                  'ul.selected',
                  recipients.to && [recipients.to.map((to) => m('li', to.mGroupName))]
                ),
              m('.recipient-input', [
                m('input[type=text][list=to-list]', {
                  value: inputTo,
                  oninput: handleInput,
                }),
                m('ul#to-list[autocomplete=off]', [
                  inputList && inputList.length > 0
                    ? inputList.map((item) =>
                        m('li', { onclick: (e) => handleClick(e, item) }, item.mGroupName)
                      )
                    : m('li', 'No Item'),
                ]),
              ]),
            ]),
          ]),
          m('input[type=text][placeholder=Subject].compose-mail__subject', {
            oninput: (e) => (subject = e.target.value),
          }),
          m('textarea[placeholder=Message].compose-mail__message', {
            oninput: (e) => (mailBody = e.target.value),
            value: mailBody,
          }),
          v.attrs.allUsers &&
            m(
              'button',
              {
                onclick: () => {
                  rs.rsJsonApiRequest('/rsMsgs/sendMail', {
                    from: identity,
                    subject,
                    mailBody,
                    to: recipients.to,
                    cc: recipients.cc,
                    bcc: recipients.bcc,
                  }).then((res) => {
                    if (res.body.retval) {
                      recipients.to = [];
                      recipients.cc = [];
                      recipients.bcc = [];
                      m.redraw();
                    }
                    res.body.retval !== 1
                      ? widget.popupMessage([
                          m('h3', 'Error'),
                          m('hr'),
                          m('p', res.body.errorMessage),
                        ])
                      : widget.popupMessage([
                          m('h3', 'Success'),
                          m('hr'),
                          m('p', 'Mail Sent successfully'),
                        ]);
                  });
                },
              },
              'Send'
            ),
        ]),
      ]);
    },
  };
};

module.exports = Layout();
