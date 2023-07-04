const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');

const Layout = () => {
  const data = {
    subject: '',
    mailBody: '',
    identity: null,
    recipients: {
      to: {
        inputVal: '',
        inputList: [],
        sendList: [],
      },
      cc: {
        inputVal: '',
        inputList: [],
        sendList: [],
      },
      bcc: {
        inputVal: '',
        inputList: [],
        sendList: [],
      },
    },
  };
  return {
    oninit: ({ attrs: { ownId, allUsers } }) => {
      data.identity = ownId[0];
      Object.keys(data.recipients).forEach((item) => {
        data.recipients[item].inputList = allUsers;
      });
    },
    view: ({ attrs: { ownId, allUsers } }) => {
      // get recipientType from the function call to handle events for all recipient types
      function handleInput(e, recipientType) {
        data.recipients[recipientType].inputVal = e.target.value;
        data.recipients[recipientType].inputList = allUsers.filter((item) =>
          item.mGroupName.toLowerCase().includes(e.target.value.toLowerCase())
        );
        m.redraw();
      }
      function handleClick(item, recipientType) {
        data.recipients[recipientType].sendList.push(item);
        // reset values
        data.recipients[recipientType].inputVal = '';
        data.recipients[recipientType].inputList = allUsers;
        m.redraw();
      }
      function removeSelectedItem(recipient, recipientType) {
        data.recipients[recipientType].sendList = data.recipients[recipientType].sendList.filter(
          (item) => item.mGroupId !== recipient.mGroupId
        );
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
                value: data.identity,
                onchange: (e) => (data.identity = ownId[e.target.selectedIndex]),
              },
              ownId &&
                ownId.map((id) =>
                  m(
                    'option',
                    { value: id },
                    rs.userList.userMap[id]
                      ? rs.userList.userMap[id].toLocaleString() + ' (' + id.slice(0, 12) + '...)'
                      : 'No Signature'
                  )
                )
            ),
          ]),
          m('.compose-mail__recipients', [
            Object.keys(data.recipients).map((recipientType) =>
              m('.compose-mail__recipients__container', [
                m('label.bold', `${recipientType}: `),
                m('.recipients', [
                  data.recipients[recipientType].sendList.length > 0 &&
                    data.recipients[recipientType].sendList.map((recipient) =>
                      m('.recipients__selected', [
                        m('span', recipient.mGroupName),
                        m('i.fas.fa-times', {
                          onclick: () => removeSelectedItem(recipient, recipientType),
                        }),
                      ])
                    ),
                  m('.recipients__input', [
                    m('input[type=text].recipients__input-field', {
                      value: data.recipients[recipientType].inputVal,
                      oninput: (e) => handleInput(e, recipientType),
                    }),
                    m('ul.recipients__input-list[autocomplete=off]', [
                      data.recipients[recipientType].inputList.length > 0
                        ? data.recipients[recipientType].inputList.map((item) =>
                            m(
                              'li',
                              { onclick: () => handleClick(item, recipientType) },
                              item.mGroupName
                            )
                          )
                        : m('li', 'No Item'),
                    ]),
                  ]),
                ]),
              ])
            ),
          ]),
          m('input.compose-mail__subject[type=text][placeholder=Subject]', {
            value: data.subject,
            oninput: (e) => (data.subject = e.target.value),
          }),
          m('textarea.compose-mail__message[placeholder=Message]', {
            value: data.mailBody,
            oninput: (e) => (data.mailBody = e.target.value),
          }),
          allUsers &&
            m(
              'button.compose-mail__send-btn',
              {
                onclick: () => {
                  const to = data.recipients.to.sendList.map((toItem) => toItem.mGroupId);
                  const cc = data.recipients.cc.sendList.map((ccItem) => ccItem.mGroupId);
                  const bcc = data.recipients.bcc.sendList.map((bccItem) => bccItem.mGroupId);
                  const { identity, subject, mailBody } = data;
                  rs.rsJsonApiRequest('/rsMsgs/sendMail', {
                    from: identity,
                    subject,
                    mailBody,
                    to,
                    cc,
                    bcc,
                  }).then((res) => {
                    if (res.body.retval) {
                      Object.keys(data.recipients).forEach((item) => {
                        data.recipients[item].sendList = [];
                      });
                      data.subject = '';
                      data.mailBody = '';
                      m.redraw();
                    }
                    res.body.retval < 1
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
