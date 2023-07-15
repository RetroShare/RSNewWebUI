const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');

const Layout = () => {
  const Data = {
    subject: '',
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
  // async function loadDetails(attrs) {}
  return {
    oninit: async (v) => {
      console.log('function loadDetails');
      const { ownId, allUsers, msgType } = await v.attrs;
      console.log(allUsers, ownId);
      console.log('attrs: ', await v.attrs);
      if (msgType === 'compose') {
        Data.identity = ownId[0];
        console.log(ownId);
        console.log('id: ', Data.identity);
      }
      Object.keys(Data.recipients).forEach((item) => {
        Data.recipients[item].inputList = allUsers;
      });
      console.log('Data before reply init: ', Data);
      if (msgType === 'reply') {
        const { sender, recipients, subject, replyMessage } = await v.attrs;
        console.log('id: ', sender);
        Data.identity = sender[0];
        // console.log('id: ', Data.identity);
        Data.recipients.to.sendList = recipients;
        const tmb = document.querySelector('#composerMailBody');
        tmb.innerHTML = `<br><br><p>-----Original Message-----</p>${replyMessage}`;
        Data.subject = subject.substring(0, 4) === 'Re: ' ? subject : `Re: ${subject}`;
        if (sender.length > 0) Data.identity = ownId.filter((id) => id === sender[0].mGroupId);
        console.log('Data after reply init: ', Data);
      }
    },
    view: ({ attrs: { ownId, allUsers } }) => {
      // get recipientType from the function call to handle events for all recipient types
      function handleInput(e, recipientType) {
        Data.recipients[recipientType].inputVal = e.target.value;
        Data.recipients[recipientType].inputList = allUsers.filter((item) =>
          item.mGroupName.toLowerCase().includes(e.target.value.toLowerCase())
        );
      }
      function handleClick(item, recipientType) {
        Data.recipients[recipientType].sendList.push(item);
        // reset current input values after a sender is selected
        Data.recipients[recipientType].inputVal = '';
        Data.recipients[recipientType].inputList = allUsers;
      }
      function removeSelectedItem(recipient, recipientType) {
        Data.recipients[recipientType].sendList = Data.recipients[recipientType].sendList.filter(
          (item) => item.mGroupId !== recipient.mGroupId
        );
      }
      function sendMail() {
        const to = Data.recipients.to.sendList.map((toItem) => toItem.mGroupId);
        const cc = Data.recipients.cc.sendList.map((ccItem) => ccItem.mGroupId);
        const bcc = Data.recipients.bcc.sendList.map((bccItem) => bccItem.mGroupId);
        console.log(to, cc, bcc);
        const { identity: from, subject } = Data;
        console.log(from, subject);
        const tmb = document.querySelector('#composerMailBody');
        console.log(tmb.innerHTML);
        // rs.rsJsonApiRequest('/rsMsgs/sendMail', { from, subject, mailBody, to, cc, bcc }).then(
        //   (res) => {
        //     if (res.body.retval) {
        //       Object.keys(Data.recipients).forEach((recipientType) => {
        //         Data.recipients[recipientType].sendList = [];
        //       });
        //       Data.subject = '';
        //       Data.mailBody = '';
        //       m.redraw();
        //     }
        //     const success = res.body.retval < 1;
        //     widget.popupMessage(
        //       m('.widget', [
        //         m('.widget__heading', m('h3', success ? 'Success' : 'Error')),
        //         m('.widget__body', m('p', success ? 'Mail sent successfully' : res.body.errorMsg)),
        //       ])
        //     );
        //   }
        // );
      }
      return m('.widget', [
        m('.widget__heading', m('h3', 'Compose a mail')),
        m('.widget__body.compose-mail', [
          m('.compose-mail__from', [
            m('label[for=idtags].bold', 'From: '),
            m(
              'select[id=idtags]',
              {
                value: Data.identity,
                onchange: (e) => {
                  Data.identity = ownId[e.target.selectedIndex];
                },
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
            m('.compose-mail__recipients__container', [
              m('label.bold', 'To: '),
              m('.recipients', [
                Data.recipients.to.sendList.length > 0 &&
                  Data.recipients.to.sendList.map((recipient) =>
                    m('.recipients__selected', [
                      m('span', recipient.mGroupName),
                      m('i.fas.fa-times', {
                        onclick: () => removeSelectedItem(recipient, 'to'),
                      }),
                    ])
                  ),
                m('.recipients__input', [
                  m('input[type=text].recipients__input-field', {
                    value: Data.recipients.to.inputVal,
                    oninput: (e) => handleInput(e, 'to'),
                  }),
                  m('ul.recipients__input-list[autocomplete=off]', [
                    Data.recipients.to.inputList.length > 0
                      ? Data.recipients.to.inputList.map((item) =>
                          m('li', { onclick: () => handleClick(item, 'to') }, item.mGroupName)
                        )
                      : m('li', 'No Item'),
                  ]),
                ]),
              ]),
            ]),
            ['cc', 'bcc'].map((recipientType) =>
              m('.compose-mail__recipients__container', [
                m('label.bold', `${recipientType}: `),
                m('.recipients', [
                  Data.recipients[recipientType].sendList.length > 0 &&
                    Data.recipients[recipientType].sendList.map((recipient) =>
                      m('.recipients__selected', [
                        m('span', recipient.mGroupName),
                        m('i.fas.fa-times', {
                          onclick: () => removeSelectedItem(recipient, recipientType),
                        }),
                      ])
                    ),
                  m('.recipients__input', [
                    m('input[type=text].recipients__input-field', {
                      value: Data.recipients[recipientType].inputVal,
                      oninput: (e) => handleInput(e, recipientType),
                    }),
                    m('ul.recipients__input-list[autocomplete=off]', [
                      Data.recipients[recipientType].inputList.length > 0
                        ? Data.recipients[recipientType].inputList.map((item) =>
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
            value: Data.subject,
            oninput: (e) => (Data.subject = e.target.value),
          }),
          m('.compose-mail__message', [
            m('.compose-mail__message-body[placeholder=Message][contenteditable]#composerMailBody'),
          ]),
          allUsers &&
            m('button.compose-mail__send-btn', { onclick: sendMail }, [
              m('span', 'Send Mail'),
              m('i.fas.fa-paper-plane'),
            ]),
        ]),
      ]);
    },
  };
};

module.exports = Layout;
