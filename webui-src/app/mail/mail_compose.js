const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const peopleUtil = require('people/people_util');

const UserAvatarsCache = {};

const Layout = () => {
  let showCc = false;
  let showBcc = false;
  let ownAvatars = {};
  const Data = {
    allUsers: [],
    ownId: [],
    subject: '',
    identity: null,
    bodyHtml: '',
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
  async function loadMailUserDetails(msgType, senderId, recipientList, isDirectMail, ccList) {
    Data.allUsers = await peopleUtil.sortUsers(rs.userList.users);

    // Wrap ownIds in a Promise
    const gxsIds = await new Promise((resolve) => {
      peopleUtil.ownIds((ids) => {
        resolve(ids || []);
      });
    });

    Data.ownId = gxsIds.filter((id) => id && id !== '0000000000000000' && Number(id) !== 0);

    Data.ownId.forEach((id) => {
      if (!ownAvatars[id]) {
        rs.rsJsonApiRequest(
          '/rsIdentity/getIdDetails',
          { id },
          (data) => {
            if (data?.details) {
              ownAvatars[id] = data.details.mAvatar;
            }
          }
        );
      }
    });

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

    const resolvedSenderId = await senderId;

    if (msgType === 'reply' || msgType === 'replyAll') {
      Data.allUsers.forEach((user) => {
        if (user.mGroupId === resolvedSenderId) {
          Data.recipients.to.sendList.push(user);
          if (!UserAvatarsCache[resolvedSenderId]) {
            rs.rsJsonApiRequest(
              '/rsIdentity/getIdDetails',
              { id: resolvedSenderId },
              (data) => {
                if (data?.details) {
                  UserAvatarsCache[resolvedSenderId] = data.details.mAvatar;
                }
              }
            );
          }
        }
      });
    }

    if (msgType === 'replyAll') {
      // Add other "To" recipients
      if (recipientList) {
        Object.keys(recipientList).forEach((recip) => {
          if (recip !== resolvedSenderId && !Data.ownId.includes(recip)) {
            const user = Data.allUsers.find((u) => u.mGroupId === recip);
            if (user && !Data.recipients.to.sendList.some((item) => item.mGroupId === recip)) {
              Data.recipients.to.sendList.push(user);
              if (!UserAvatarsCache[recip]) {
                rs.rsJsonApiRequest(
                  '/rsIdentity/getIdDetails',
                  { id: recip },
                  (data) => {
                    if (data?.details) {
                      UserAvatarsCache[recip] = data.details.mAvatar;
                    }
                  }
                );
              }
            }
          }
        });
      }
      // Add other "Cc" recipients
      if (ccList) {
        Object.keys(ccList).forEach((recip) => {
          if (recip !== resolvedSenderId && !Data.ownId.includes(recip)) {
            const user = Data.allUsers.find((u) => u.mGroupId === recip);
            if (user && !Data.recipients.cc.sendList.some((item) => item.mGroupId === recip)) {
              Data.recipients.cc.sendList.push(user);
              if (!UserAvatarsCache[recip]) {
                rs.rsJsonApiRequest(
                  '/rsIdentity/getIdDetails',
                  { id: recip },
                  (data) => {
                    if (data?.details) {
                      UserAvatarsCache[recip] = data.details.mAvatar;
                    }
                  }
                );
              }
            }
          }
        });
      }
    }

    if (msgType === 'reply' || msgType === 'replyAll') {
      Data.identity = Data.ownId.filter((id) =>
        Object.prototype.hasOwnProperty.call(recipientList, id)
      )[0];
    }
  }
  async function loadDetails(attrs) {
    const { msgType, senderId, recipientList, ccList, isDirectMail } = await attrs;
    await loadMailUserDetails(msgType, senderId, recipientList, isDirectMail, ccList);

    Object.keys(Data.recipients).forEach((item) => {
      Data.recipients[item].inputList = Data.allUsers;
    });

    if (Data.recipients.cc.sendList.length > 0) showCc = true;
    if (Data.recipients.bcc.sendList.length > 0) showBcc = true;

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

    if (msgType === 'reply' || msgType === 'replyAll' || msgType === 'forward') {
      const { subject, replyMessage, timeStamp } = await attrs;
      const tmb = document.querySelector('#composerMailBody');
      const time = timeStamp.toLocaleTimeString('UTC', { hour: '2-digit', minute: '2-digit' });
      const dateLong = timeStamp.toLocaleDateString('UTC', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const headerTitle = msgType === 'forward' ? 'Forwarded Message' : 'Original Message';
      const replyMessageHeader = `
        -----${headerTitle}-----
        <br>
        <b>From: </b>
        <a href="retroshare://message?id=${senderId}">${rs.userList.username(senderId)}</a>
        <br>
        <b>To: </b>
        ${recipientList ? Object.keys(recipientList).map(
          (recip) => `
          <a href="retroshare://message?id=${recip}">
             ${rs.userList.username(recipientList[recip]._addr_string) || 'Unknown'},
          </a>
        `
        ).join('') : ''}
        <br>
        <br>
        <b>Sent: </b>
        <span>${dateLong} ${time}</span>
        <br>
        <b>Subject: </b>
        <span>${subject}</span>
        <br>
        <br>
        ${msgType !== 'forward' ? `
        <span>
          On ${timeStamp.toLocaleDateString()} ${time},
           <a href="retroshare://message?id=${senderId}">${rs.userList.username(senderId)}</a>
          wrote:
        </span>
        ` : ''}
      `;
      const bodyHtml = `
        <br>
        <br>
        <div>
          ${replyMessageHeader}
          <div class="original-message" style="margin-left: 20px;">
            ${replyMessage}
          </div>
        </div>
      `;
      if (tmb) {
        tmb.innerHTML = bodyHtml;
      }
      Data.bodyHtml = bodyHtml;
      if (msgType === 'forward') {
        Data.subject = subject.substring(0, 5) === 'Fwd: ' ? subject : `Fwd: ${subject}`;
      } else {
        Data.subject = subject.substring(0, 4) === 'Re: ' ? subject : `Re: ${subject}`;
      }
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
        if (item.mGroupId && !UserAvatarsCache[item.mGroupId]) {
          rs.rsJsonApiRequest(
            '/rsIdentity/getIdDetails',
            { id: item.mGroupId },
            (data) => {
              if (data?.details) {
                UserAvatarsCache[item.mGroupId] = data.details.mAvatar;
              }
            }
          );
        }
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
            Data.identity && m(peopleUtil.UserAvatar, {
              avatar: ownAvatars[Data.identity],
              firstLetter: rs.userList.userMap[Data.identity] && typeof rs.userList.userMap[Data.identity] === 'string'
                ? rs.userList.userMap[Data.identity].slice(0, 1).toUpperCase()
                : (rs.userList.username(Data.identity) || '').slice(0, 1).toUpperCase(),
              identityId: Data.identity,
              size: 24,
            }),
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
                      m(peopleUtil.UserAvatar, {
                        avatar: UserAvatarsCache[recipient.mGroupId],
                        firstLetter: recipient.mGroupName ? recipient.mGroupName.slice(0, 1).toUpperCase() : '',
                        identityId: recipient.mGroupId,
                        size: 20,
                      }),
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
              m('.compose-mail__recipients__toggles', {
                style: {
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'center',
                  marginLeft: 'auto',
                  paddingRight: '0.5rem',
                  userSelect: 'none',
                }
              }, [
                m('span.bold', {
                  style: { cursor: 'pointer', color: showCc ? '#019DFF' : '#555' },
                  onclick: () => showCc = !showCc
                }, 'Cc'),
                m('span.bold', {
                  style: { cursor: 'pointer', color: showBcc ? '#019DFF' : '#555' },
                  onclick: () => showBcc = !showBcc
                }, 'Bcc')
              ])
            ]),
            ['cc', 'bcc'].map((recipientType) => {
              const isVisible = recipientType === 'cc' ? showCc : showBcc;
              return isVisible && m('.compose-mail__recipients__container', [
                m('label.bold', `${recipientType}: `),
                m('.recipients', [
                  Data.recipients[recipientType].sendList.length > 0 &&
                    Data.recipients[recipientType].sendList.map((recipient) =>
                      m('.recipients__selected', [
                        m(peopleUtil.UserAvatar, {
                          avatar: UserAvatarsCache[recipient.mGroupId],
                          firstLetter: recipient.mGroupName ? recipient.mGroupName.slice(0, 1).toUpperCase() : '',
                          identityId: recipient.mGroupId,
                          size: 20,
                        }),
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
              ]);
            }),
          ]),
          m('input.compose-mail__subject[type=text][placeholder=Subject]', {
            value: Data.subject,
            oninput: (e) => (Data.subject = e.target.value),
          }),
          m('.compose-mail__message', [
            m('.compose-mail__message-body[placeholder=Message][contenteditable]#composerMailBody', {
              oncreate: (vnode) => {
                if (Data.bodyHtml) {
                  vnode.dom.innerHTML = Data.bodyHtml;
                }
              }
            }),
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
