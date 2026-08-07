const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const peopleUtil = require('people/people_util');
const chatEmoji = require('chat/chat_emoji');

const UserAvatarsCache = {};
const MAX_RECIPIENTS = 20;

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const Layout = () => {
  let showCc = false;
  let showBcc = false;
  const ownAvatars = {};
  let attachments = [];
  let showEmojiPicker = false;
  let emojiSearch = '';
  let emojiCategory = 'Smileys';

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

  function insertContentIntoMailBody(content) {
    const mailBody = document.querySelector('#composerMailBody');
    if (!mailBody) return;
    mailBody.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (mailBody.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        if (typeof content === 'string') {
          const temp = document.createElement('div');
          temp.innerHTML = content;
          const frag = document.createDocumentFragment();
          let node, lastNode;
          while ((node = temp.firstChild)) {
            lastNode = frag.appendChild(node);
          }
          range.insertNode(frag);
          if (lastNode) {
            range.setStartAfter(lastNode);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        } else if (content instanceof Node) {
          range.insertNode(content);
          range.setStartAfter(content);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        return;
      }
    }
    if (typeof content === 'string') {
      mailBody.innerHTML += content;
    } else if (content instanceof Node) {
      mailBody.appendChild(content);
    }
  }

  function insertEmoji(emoji) {
    insertContentIntoMailBody(document.createTextNode(emoji));
  }
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

    if (msgType === 'reply' || msgType === 'replyAll' || msgType === 'forward') {
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
      function totalRecipients() {
        return Data.recipients.to.sendList.length +
               Data.recipients.cc.sendList.length +
               Data.recipients.bcc.sendList.length;
      }
      function handleClick(item, recipientType) {
        if (totalRecipients() >= MAX_RECIPIENTS) return;
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
        // Auto-add inputVal if user typed recipient but didn't click dropdown item
        ['to', 'cc', 'bcc'].forEach((type) => {
          const val = Data.recipients[type].inputVal ? Data.recipients[type].inputVal.trim() : '';
          if (val) {
            const match = Data.allUsers.find((u) => u.mGroupName && (u.mGroupName.toLowerCase() === val.toLowerCase() || u.mGroupId === val));
            if (match && !Data.recipients[type].sendList.some((item) => item.mGroupId === match.mGroupId)) {
              Data.recipients[type].sendList.push(match);
            } else if (!match && val.length > 5) {
              Data.recipients[type].sendList.push({ mGroupId: val, mGroupName: val });
            }
            Data.recipients[type].inputVal = '';
          }
        });

        const to = Data.recipients.to.sendList.map((toItem) => toItem.mGroupId);
        const cc = Data.recipients.cc.sendList.map((ccItem) => ccItem.mGroupId);
        const bcc = Data.recipients.bcc.sendList.map((bccItem) => bccItem.mGroupId);

        let from = Data.identity;
        if (!from && Data.ownId && Data.ownId.length > 0) {
          from = Data.ownId[0];
          Data.identity = from;
        }

        if (to.length === 0) {
          widget.popupMessage(
            m('.widget', [
              m('.widget__heading', m('h3', 'Missing Recipient')),
              m('.widget__body', m('p', 'Please select at least one recipient in the "To" field.')),
            ])
          );
          return;
        }

        if (!from) {
          widget.popupMessage(
            m('.widget', [
              m('.widget__heading', m('h3', 'Missing Identity')),
              m('.widget__body', m('p', 'Please select a "From" identity.')),
            ])
          );
          return;
        }

        const subject = Data.subject || '(No Subject)';
        const mailBodyElement = document.querySelector('#composerMailBody');
        let fullMailBody = mailBodyElement ? mailBodyElement.innerHTML : '';

        if (attachments.length > 0) {
          const attHtml = `
            <br/><hr style="border:none;border-top:1px solid #e2e8f0;margin:1rem 0;"/><div style="margin-top:10px;font-weight:bold;color:#475569;font-size:0.9rem;">Attachments (${attachments.length}):</div>
            <ul style="list-style:none;padding:0;margin:6px 0;">
              ${attachments.map((att) => `<li style="padding:4px 0;color:#1e293b;font-size:0.875rem;">📎 <b>${att.name}</b> <span style="color:#94a3b8;font-size:0.8em;">(${att.size})</span></li>`).join('')}
            </ul>
          `;
          fullMailBody += attHtml;
        }

        const mailBody = `<div>${fullMailBody}</div>`;

        rs.rsJsonApiRequest('/rsMail/sendMail', { from, subject, mailBody, to, cc, bcc }, (data, success) => {
          const isOk = success && data && (
            data.retval > 0 ||
            data.retval === true ||
            (Array.isArray(data.trackingIds) && data.trackingIds.length > 0)
          );
          if (isOk) {
            Object.keys(Data.recipients).forEach((recipientType) => {
              Data.recipients[recipientType].sendList = [];
            });
            Data.subject = '';
            if (mailBodyElement) mailBodyElement.innerHTML = '';
            attachments = [];
            v.attrs.setShowCompose(false);
          }
          widget.popupMessage(
            m('.widget', [
              m('.widget__heading', m('h3', isOk ? 'Success' : 'Error')),
              m('.widget__body', m('p', isOk ? 'Mail sent successfully' : (data?.errorMsg || data?.errorMessage || 'Failed to send mail'))),
            ])
          );
          m.redraw();
        });
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
                    placeholder: totalRecipients() >= MAX_RECIPIENTS ? 'Max recipients reached' : '',
                    disabled: totalRecipients() >= MAX_RECIPIENTS,
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
                      placeholder: totalRecipients() >= MAX_RECIPIENTS ? 'Max recipients reached' : '',
                      disabled: totalRecipients() >= MAX_RECIPIENTS,
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
            totalRecipients() >= MAX_RECIPIENTS && m('.compose-mail__recipient-limit', {
              style: { color: '#e67e22', fontSize: '0.85rem', padding: '0.25rem 0' }
            }, `Maximum of ${MAX_RECIPIENTS} recipients reached. Remove a recipient to add more.`),
          ]),
          m('input.compose-mail__subject[type=text][placeholder=Subject]', {
            value: Data.subject,
            oninput: (e) => (Data.subject = e.target.value),
          }),

          // Hidden File Inputs
          m('input#mail-file-attach[type=file]', {
            style: 'display: none;',
            multiple: true,
            onchange: (e) => {
              const files = Array.from(e.target.files || []);
              files.forEach((file) => {
                attachments.push({
                  name: file.name,
                  size: formatFileSize(file.size),
                  type: file.type,
                  rawFile: file,
                });
              });
              e.target.value = '';
              m.redraw();
            },
          }),
          m('input#mail-image-attach[type=file]', {
            style: 'display: none;',
            accept: 'image/*',
            onchange: (e) => {
              const file = e.target.files && e.target.files[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  const src = event.target.result;
                  insertContentIntoMailBody(`<img src="${src}" style="max-width: 100%; max-height: 400px; border-radius: 0.375rem; margin: 0.5rem 0;" />`);
                };
                reader.readAsDataURL(file);
              }
              e.target.value = '';
              m.redraw();
            },
          }),

          // File Attachments Bar
          attachments.length > 0 &&
            m('.mail-attachments-bar', {
              style: 'margin: 0.5rem 0; padding: 0.5rem 0.75rem; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 0.375rem; display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;'
            }, [
              m('span', { style: 'font-weight: 600; font-size: 0.85rem; color: #475569; display: flex; align-items: center; gap: 0.35rem; margin-right: 0.25rem;' }, [
                m('i.fas.fa-paperclip', { style: 'color: #019DFF;' }),
                `Attachments (${attachments.length}):`
              ]),
              attachments.map((att, index) =>
                m('.mail-attachment-chip', {
                  style: 'display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0.65rem; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 1rem; font-size: 0.825rem; font-weight: 500; color: #1e293b; box-shadow: 0 1px 2px rgba(0,0,0,0.05);'
                }, [
                  m('i.fas.fa-file-alt', { style: 'color: #3b82f6;' }),
                  m('span', att.name),
                  m('span', { style: 'color: #94a3b8; font-size: 0.75rem;' }, `(${att.size})`),
                  m('i.fas.fa-times', {
                    style: 'cursor: pointer; color: #ef4444; margin-left: 0.2rem; font-size: 0.8rem;',
                    onclick: () => attachments.splice(index, 1),
                  })
                ])
              )
            ]),

          m('.compose-mail__message', [
            m('.compose-mail__message-body[placeholder=Message][contenteditable]#composerMailBody', {
              oncreate: (vnode) => {
                if (Data.bodyHtml) {
                  vnode.dom.innerHTML = Data.bodyHtml;
                }
              }
            }),

            // Modern Mail Composer Bottom Toolbar
            m('.mail-compose-toolbar', {
              style: 'display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; background: #ffffff; border: 1px solid #cbd5e1; border-top: 1px solid #e2e8f0; border-radius: 0 0 0.375rem 0.375rem; position: relative;'
            }, [
              m('.toolbar-left', { style: 'display: flex; align-items: center; gap: 0.5rem;' }, [
                m('button.mail-compose-send-btn', {
                  style: 'display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem 1.25rem; background: #019DFF; color: #ffffff; border: none; border-radius: 1.5rem; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: background 0.15s ease; box-shadow: 0 2px 4px rgba(1,157,255,0.25);',
                  onclick: sendMail,
                }, [
                  m('span', 'Send'),
                  m('i.fas.fa-paper-plane', { style: 'font-size: 0.85rem;' }),
                ]),
                m('.toolbar-divider', { style: 'width: 1px; height: 22px; background: #cbd5e1; margin: 0 0.25rem;' }),
                m('button.mail-tool-btn', {
                  type: 'button',
                  title: 'Attach files',
                  style: 'width: 34px; height: 34px; border-radius: 50%; border: none; background: transparent; color: #475569; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.15s ease;',
                  onmouseenter: (e) => (e.currentTarget.style.background = '#f1f5f9'),
                  onmouseleave: (e) => (e.currentTarget.style.background = 'transparent'),
                  onclick: () => {
                    const input = document.getElementById('mail-file-attach');
                    if (input) input.click();
                  },
                }, m('i.fas.fa-paperclip', { style: 'font-size: 1.05rem;' })),
                m('button.mail-tool-btn', {
                  type: 'button',
                  title: 'Insert image',
                  style: 'width: 34px; height: 34px; border-radius: 50%; border: none; background: transparent; color: #475569; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.15s ease;',
                  onmouseenter: (e) => (e.currentTarget.style.background = '#f1f5f9'),
                  onmouseleave: (e) => (e.currentTarget.style.background = 'transparent'),
                  onclick: () => {
                    const input = document.getElementById('mail-image-attach');
                    if (input) input.click();
                  },
                }, m('i.fas.fa-image', { style: 'font-size: 1.05rem;' })),
                m('button.mail-tool-btn', {
                  type: 'button',
                  title: 'Insert emoji',
                  style: `width: 34px; height: 34px; border-radius: 50%; border: none; background: ${showEmojiPicker ? '#e0f2fe' : 'transparent'}; color: ${showEmojiPicker ? '#0284c7' : '#475569'}; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.15s ease;`,
                  onclick: () => (showEmojiPicker = !showEmojiPicker),
                }, m('i.fas.fa-smile', { style: 'font-size: 1.05rem;' })),
              ]),

              // Floating Emoji Picker Popover
              showEmojiPicker && m('.mail-emoji-picker-popover', {
                style: 'position: absolute; bottom: 50px; left: 130px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 0.5rem; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1); width: 320px; max-height: 340px; z-index: 2000; display: flex; flex-direction: column; overflow: hidden;',
                onclick: (e) => e.stopPropagation(),
              }, [
                m('.emoji-search-bar', { style: 'padding: 0.5rem; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 0.5rem;' }, [
                  m('i.fas.fa-search', { style: 'color: #94a3b8; font-size: 0.85rem;' }),
                  m('input[type=text][placeholder=Search emoji...]', {
                    style: 'border: none; outline: none; width: 100%; font-size: 0.85rem;',
                    value: emojiSearch,
                    oninput: (e) => (emojiSearch = e.target.value),
                  }),
                  emojiSearch && m('i.fas.fa-times', {
                    style: 'cursor: pointer; color: #94a3b8; font-size: 0.85rem;',
                    onclick: () => (emojiSearch = ''),
                  }),
                ]),
                !emojiSearch && m('.emoji-cat-bar', { style: 'display: flex; background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 0.25rem; overflow-x: auto;' },
                  chatEmoji.EMOJI_CATEGORIES.map((c) =>
                    m('button', {
                      style: `border: none; background: ${c === emojiCategory ? '#ffffff' : 'transparent'}; border-radius: 0.25rem; padding: 0.3rem 0.4rem; cursor: pointer; font-size: 1rem; box-shadow: ${c === emojiCategory ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'};`,
                      title: c,
                      onclick: () => (emojiCategory = c),
                    }, chatEmoji.EMOJI_ICONS[c])
                  )
                ),
                m('.emoji-grid-body', { style: 'padding: 0.5rem; display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.25rem; max-height: 230px; overflow-y: auto;' },
                  (emojiSearch
                    ? Object.values(chatEmoji.EMOJI_DATA).flat().filter((e) => e.includes(emojiSearch))
                    : (chatEmoji.EMOJI_DATA[emojiCategory] || [])
                  ).map((e) =>
                    m('button', {
                      style: 'border: none; background: transparent; font-size: 1.25rem; cursor: pointer; padding: 0.25rem; border-radius: 0.25rem; transition: background 0.15s ease;',
                      onmouseenter: (ev) => (ev.currentTarget.style.background = '#f1f5f9'),
                      onmouseleave: (ev) => (ev.currentTarget.style.background = 'transparent'),
                      onclick: () => {
                        insertEmoji(e);
                        showEmojiPicker = false;
                      },
                    }, e)
                  )
                ),
              ])
            ]),
          ]),
        ]),
      ]);
    },
  };
};

module.exports = Layout;
