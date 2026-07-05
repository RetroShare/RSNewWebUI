const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const peopleUtil = require('people/people_util');

const Layout = () => {
  const Data = {
    allUsers: [],
    ownId: [],
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
  async function loadMailUserDetails(msgType, senderId, recipientList, isDirectMail) {
    Data.allUsers = await peopleUtil.sortUsers(rs.userList.users);
    if (msgType === 'reply') {
      Data.allUsers.forEach(async (user) => {
        if (user.mGroupId === (await senderId)) Data.recipients.to.sendList.push(user);
      });
    }

    // Wrap ownIds in a Promise
    const gxsIds = await new Promise((resolve) => {
      peopleUtil.ownIds((ids) => {
        resolve(ids || []);
      });
    });

    Data.ownId = gxsIds.filter((id) => id && id !== '0000000000000000' && Number(id) !== 0);

    // Fetch own Node GPG ID
    const netStatus = await new Promise((resolve) => {
      rs.rsJsonApiRequest('/rsConfig/getConfigNetStatus', {}, (res) => {
        resolve(res || null);
      });
    });

    if (netStatus && netStatus.status) {
      const ownNodeId = netStatus.status.ownId;
      if (ownNodeId && !Data.ownId.includes(ownNodeId)) {
        rs.userList.userMap[ownNodeId] = {
          name: (netStatus.status.ownName || 'Node') + ' (Node GPG Key)',
          isContact: false,
        };
        Data.ownId.push(ownNodeId);
      }
      if (msgType === 'compose' && isDirectMail) {
        Data.identity = ownNodeId;
      }
    }

    if (msgType === 'reply') {
      Data.identity = Data.ownId.filter((id) =>
        Object.prototype.hasOwnProperty.call(recipientList, id)
      )[0];
    }
  }
  async function loadDetails(attrs) {
    const { msgType, senderId, recipientList, isDirectMail } = await attrs;
    await loadMailUserDetails(msgType, senderId, recipientList, isDirectMail);

    Object.keys(Data.recipients).forEach((item) => {
      Data.recipients[item].inputList = Data.allUsers;
    });

    if (msgType === 'compose') {
      if (!isDirectMail) {
        Data.identity = Data.ownId[0];
      }
      if (attrs.toId) {
        const matchingUser = Data.allUsers.find((user) => user.mGroupId === attrs.toId);
        if (matchingUser) {
          Data.recipients.to.sendList.push(matchingUser);
        } else {
          // If toId is a GPG ID (not in GXS list), add it manually as a GPG recipient
          const friendName = attrs.friendName || 'Unknown Friend';
          Data.recipients.to.sendList.push({
            mGroupId: attrs.toId,
            mGroupName: friendName + ' (Node GPG Key)',
          });
        }
      }
    }

    if (msgType === 'reply') {
      const { subject, replyMessage, timeStamp } = await attrs;
      const tmb = document.querySelector('#composerMailBody');
      const time = timeStamp.toLocaleTimeString('UTC', { hour: '2-digit', minute: '2-digit' });
      const dateLong = timeStamp.toLocaleDateString('UTC', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const replyMessageHeader = `
        -----Original Message-----
        <br>
        <b>From: </b>
        <a href="retroshare://message?id=${senderId}">${rs.userList.username(senderId)}</a>
        <br>
        <b>To: </b>
        ${Object.keys(recipientList).map(
          (recip) => `
          <a href="retroshare://message?id=${recip}">
             ${rs.userList.username(recipientList[recip]._addr_string) || 'Unknown'},
          </a>
        `
        )}
        <br>
        <br>
        <b>Sent: </b>
        <span>${dateLong} ${time}</span>
        <br>
        <b>Subject: </b>
        <span>${subject}</span>
        <br>
        <br>
        <span>
          On ${timeStamp.toLocaleDateString()} ${time},
           <a href="retroshare://message?id=${senderId}">${rs.userList.username(senderId)}</a>
          wrote:
        </span>
      `;
      tmb.innerHTML = `
        <br>
        <br>
        <div>
          ${replyMessageHeader}
          <div class="original-message" style="margin-left: 20px;">
            ${replyMessage}
          </div>
        </div>
      `;
      Data.subject = subject.substring(0, 4) === 'Re: ' ? subject : `Re: ${subject}`;
    }
  }
  return {
    oninit: async (v) => await loadDetails(v.attrs),
    view: (v) => {
      // get recipientType from the function call to handle events for all recipient types
      function handleInput(e, recipientType) {
        Data.recipients[recipientType].inputVal = e.target.value;
        Data.recipients[recipientType].inputList = Data.allUsers.filter((item) =>
          item.mGroupName.toLowerCase().includes(e.target.value.toLowerCase())
        );
      }
      function handleClick(item, recipientType) {
        Data.recipients[recipientType].sendList.push(item);
        // reset current input values after a sender is selected
        Data.recipients[recipientType].inputVal = '';
        Data.recipients[recipientType].inputList = Data.allUsers;
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
        const { identity: from, subject } = Data;
        const mailBodyElement = document.querySelector('#composerMailBody');
        const mailBody = `<div>${mailBodyElement.innerHTML}</div>`;
        rs.rsJsonApiRequest('/rsMail/sendMail', { from, subject, mailBody, to, cc, bcc }).then(
          (res) => {
            if (res.body.retval) {
              Object.keys(Data.recipients).forEach((recipientType) => {
                Data.recipients[recipientType].sendList = [];
              });
              Data.subject = '';
              mailBodyElement.innerHTML = '';
              v.attrs.setShowCompose(false);
            }
            const success = res.body.retval === 1;
            widget.popupMessage(
              m('.widget', [
                m('.widget__heading', m('h3', success ? 'Success' : 'Error')),
                m('.widget__body', m('p', success ? 'Mail sent successfully' : res.body.errorMsg)),
              ])
            );
          }
        );
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
                  Data.identity = Data.ownId[e.target.selectedIndex];
                },
              },
               Data.ownId &&
                Data.ownId.map((id) =>
                  m(
                    'option',
                    {
                      value: id,
                      selected: id === Data.identity,
                    },
                    rs.userList.userMap[id]
                      ? (rs.userList.userMap[id].name || id) + ' (' + id.slice(0, 12) + '...)'
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
