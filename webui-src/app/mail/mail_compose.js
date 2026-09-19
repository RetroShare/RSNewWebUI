const m = require('mithril');
const rs = require('rswebui');
const peopleUtil = require('people/people_util');
const chatEmoji = require('chat/chat_emoji');
const renderIdentityTooltip = require('mail/mail_identity_tooltip');
const icon = require('icon');
const toast = require('toast');
const widget = require('widgets');
const mailApi = require('mail/mail_api');

const UserAvatarsCache = {};
const RecipientDetailsCache = {};
const MAX_RECIPIENTS = 20;
const RecipientResult = require('mail/mail_recipient_result');

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

//  Set by the open composer so the popup's close button can ask it whether
//  there is a draft worth keeping. One composer is open at a time.
let requestComposerClose = null;

const Layout = () => {
  let showCc = false;
  let showBcc = false;
  const ownAvatars = {};
  let attachments = [];
  let showEmojiPicker = false;
  let hoveredRecipient = null;

  function showRecipientTooltip(item, element) {
    hoveredRecipient = {
      id: item.mGroupId,
      name: item.mGroupName,
      rect: (element.querySelector('.mail-recipient-result__id') || element).getBoundingClientRect(),
    };

    if (!RecipientDetailsCache[item.mGroupId]) {
      rs.rsJsonApiRequest('/rsIdentity/getIdDetails', { id: item.mGroupId }, (data) => {
        if (data && data.details) {
          RecipientDetailsCache[item.mGroupId] = data.details;
          UserAvatarsCache[item.mGroupId] = data.details.mAvatar;
          m.redraw();
        }
      });
    }
  }

  function renderRecipientTooltip() {
    if (!hoveredRecipient) return null;
    const details = RecipientDetailsCache[hoveredRecipient.id];
    if (!details) return null;

    return renderIdentityTooltip({
      details,
      gxsId: hoveredRecipient.id,
      name: hoveredRecipient.name,
      rect: hoveredRecipient.rect,
      belowAnchor: true,
    });
  }

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

    if (msgType === 'draft' || msgType === 'replyAll') {
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

    //  A draft was written BY you, so the identity is its sender, not one of
    //  its recipients.
    if (msgType === 'draft') {
      Data.identity = Data.ownId.includes(resolvedSenderId) ? resolvedSenderId : Data.ownId[0];
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

    if (msgType === 'draft') {
      const { subject, replyMessage } = await attrs;
      const tmb = document.querySelector('#composerMailBody');
      Data.bodyHtml = replyMessage || '';
      if (tmb) tmb.innerHTML = Data.bodyHtml;
      Data.subject = subject || '';
      return;
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
      function matchUsers(query) {
        const q = (query || '').trim().toLowerCase();
        if (!q) return Data.allUsers.slice(0, 200);
        return Data.allUsers.filter((item) =>
          (item.mGroupName || '').toLowerCase().includes(q)
        );
      }
      function handleInput(e, recipientType) {
        Data.recipients[recipientType].inputVal = e.target.value;
        Data.recipients[recipientType].inputList = matchUsers(e.target.value);
      }
      //  Focusing the field lists everyone; typing narrows it. The list used
      //  to stay empty until a keystroke, so an empty field showed "No Item"
      //  and there was no way to browse.
      function handleFocus(recipientType) {
        Data.recipients[recipientType].inputList = matchUsers(Data.recipients[recipientType].inputVal);
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
      //  Words that promise a file. Whole words only -- "detached" and
      //  "attaching a note" should not both trip it, and \b on each side keeps
      //  it out of the middle of longer ones.
      const ATTACH_WORDS = /\b(attach|attached|attaching|attachment|attachments)\b/i;

      //  What YOU wrote, with the quoted original taken out. A reply to a mail
      //  that mentioned an attachment would otherwise trip the reminder on
      //  every send, which is the fastest way to teach someone to click
      //  through a warning without reading it.
      //
      //  Two shapes of quote: a <blockquote>, which is what a rich reply
      //  produces, and the "-----Original Message-----" separator RetroShare
      //  itself writes into a plain-text reply.
      function composedText() {
        const body = document.querySelector('#composerMailBody');
        if (!body) return Data.subject || '';

        const copy = body.cloneNode(true);
        copy.querySelectorAll('blockquote, .mail-quote').forEach((q) => q.remove());

        let text = copy.innerText || '';
        const separator = text.search(/-{2,}\s*Original Message\s*-{2,}/i);
        if (separator !== -1) text = text.slice(0, separator);

        //  A plain-text reply quotes with a leading ">" per line.
        text = text.split('\n').filter((line) => !line.trimStart().startsWith('>')).join('\n');

        return `${Data.subject || ''} ${text}`;
      }

      function promisesAnAttachment() {
        return ATTACH_WORDS.test(composedText());
      }

      //  MsgAddress modes, as the core defines them (Rs::Mail::MsgAddress).
      const ADDRESS_TYPE_GXSID = 0x02;
      const ADDRESS_MODE = { to: 0x01, cc: 0x02, bcc: 0x03 };

      function hasContent() {
        const body = document.querySelector('#composerMailBody');
        const text = body ? (body.innerText || '').trim() : '';
        return Boolean(
          (Data.subject || '').trim() ||
          text ||
          attachments.length ||
          Data.recipients.to.sendList.length ||
          Data.recipients.cc.sendList.length ||
          Data.recipients.bcc.sendList.length
        );
      }

      //  Everything the composer holds, in the shape MessageInfo serialises.
      function draftInfo() {
        const body = document.querySelector('#composerMailBody');
        const destinations = [];
        ['to', 'cc', 'bcc'].forEach((kind) => {
          Data.recipients[kind].sendList.forEach((item) => {
            destinations.push({
              _type: ADDRESS_TYPE_GXSID,
              _mode: ADDRESS_MODE[kind],
              _addr_string: item.mGroupId,
            });
          });
        });
        return {
          msgId: '',
          from: { _type: ADDRESS_TYPE_GXSID, _mode: 0, _addr_string: Data.identity || '' },
          to: destinations[0] || { _type: 0, _mode: 0, _addr_string: '' },
          destinations,
          msgflags: 0,
          title: Data.subject || '',
          msg: body ? body.innerHTML : '',
          attach_title: '',
          attach_comment: '',
          files: [],
          size: 0,
          count: 0,
          ts: Math.floor(Date.now() / 1000),
        };
      }

      //  MessageToDraft always mints a NEW message id -- it ignores the one
      //  you hand it (p3msgservice.cc: getNewUniqueMsgId). So re-saving a
      //  draft you opened means deleting the one it came from, or the box
      //  fills with copies of the same unfinished mail. A failed save keeps
      //  the composer open: closing it would discard the text the toast just
      //  said could not be kept.
      function saveDraft(onDone) {
        if (!hasContent()) {
          if (onDone) onDone();
          return;
        }
        const previousId = v.attrs.draftMsgId;
        rs.rsJsonApiRequest('/rsMail/MessageToDraft',
          { info: draftInfo(), msgParentId: '' },
          (data, success) => {
            const ok = Boolean(success && data && data.retval);
            if (ok && previousId) mailApi.deleteMessage(previousId);
            toast.result(ok, 'Saved to drafts', 'Could not save the draft');
            if (ok && onDone) onDone();
            m.redraw();
          });
      }

      //  Closing a composer with something in it. Three answers, because
      //  silently discarding and silently saving are both wrong: one loses
      //  work, the other fills the drafts box with things nobody wanted.
      function requestClose() {
        if (!hasContent()) {
          v.attrs.setShowCompose(false);
          return;
        }
        widget.confirmMessage({
          title: 'Save this message as a draft?',
          message: 'You can finish it later from the Drafts folder.',
          cancelLabel: 'Discard',
          confirmLabel: 'Save draft',
          onConfirm: () => saveDraft(() => v.attrs.setShowCompose(false)),
          onCancel: () => v.attrs.setShowCompose(false),
        });
      }

      requestComposerClose = requestClose;

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

        let from = Data.identity;
        if (!from && Data.ownId && Data.ownId.length > 0) {
          from = Data.ownId[0];
          Data.identity = from;
        }

        if (to.length === 0) {
          toast.warning('Select at least one recipient', {
            description: 'Add someone in the "To" field before sending.',
          });
          return;
        }

        if (!from) {
          toast.warning('Choose an identity to send from');
          return;
        }

        //  Last guard before delivery: the message says it carries a file and
        //  nothing is attached. Asking is cheap; a mail that has already gone
        //  cannot be recalled.
        if (attachments.length === 0 && promisesAnAttachment()) {
          widget.confirmMessage({
            title: 'No file is attached',
            message: 'This message mentions an attachment, but nothing is attached to it.',
            description: 'Attach the file, or send the message as it is.',
            cancelLabel: 'Go back',
            confirmLabel: 'Send anyway',
            onConfirm: deliverMail,
          });
          return;
        }

        deliverMail();
      }

      function deliverMail() {
        const to = Data.recipients.to.sendList.map((toItem) => toItem.mGroupId);
        const cc = Data.recipients.cc.sendList.map((ccItem) => ccItem.mGroupId);
        const bcc = Data.recipients.bcc.sendList.map((bccItem) => bccItem.mGroupId);
        const from = Data.identity;

        const subject = Data.subject || '(No Subject)';
        const mailBodyElement = document.querySelector('#composerMailBody');
        let fullMailBody = mailBodyElement ? mailBodyElement.innerHTML : '';

        if (attachments.length > 0) {
          //  This HTML is the message itself, so every value has to be a
          //  literal: the recipient's client has none of our custom
          //  properties, and `font-weight: var(--w-label)` silently resolved
          //  to normal weight in whatever opened the mail.
          const attHtml = `
            <br/><hr style="border:none;border-top:1px solid #e2e8f0;margin:1rem 0;"/><div style="margin-top:10px;font-weight:500;color:#475569;font-size:0.9rem;">Attachments (${attachments.length}):</div>
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
            //  The draft has become a sent mail; leaving it in the box would
            //  show the same message twice.
            if (v.attrs.draftMsgId) mailApi.deleteMessage(v.attrs.draftMsgId);
            Object.keys(Data.recipients).forEach((recipientType) => {
              Data.recipients[recipientType].sendList = [];
            });
            Data.subject = '';
            if (mailBodyElement) mailBodyElement.innerHTML = '';
            attachments = [];
            v.attrs.setShowCompose(false);
          }
          toast.result(isOk, 'Mail sent',
            data?.errorMsg || data?.errorMessage || 'Failed to send mail');
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
                      icon('times', {
                        onclick: () => removeSelectedItem(recipient, 'to'),
                      }),
                    ])
                  ),
                m('.recipients__input', [
                  m('input[type=text].recipients__input-field', {
                    value: Data.recipients.to.inputVal,
                    oninput: (e) => handleInput(e, 'to'),
                    onfocus: () => handleFocus('to'),
                    placeholder: totalRecipients() >= MAX_RECIPIENTS
                      ? 'Max recipients reached'
                      : Data.recipients.to.sendList.length === 0
                        ? 'Recipients'
                        : '',
                    disabled: totalRecipients() >= MAX_RECIPIENTS,
                  }),
                  m('ul.recipients__input-list[autocomplete=off]', [
                    Data.recipients.to.inputList.length > 0
                      ? Data.recipients.to.inputList.map((item) =>
                          //  The key sits on the li: a key on a child of an
                          //  unkeyed parent does nothing, so every keystroke
                          //  that reordered the list rebuilt each row --
                          //  IntersectionObserver and all.
                          m('li', {
                            key: item.mGroupId,
                            onclick: () => handleClick(item, 'to'),
                            onmouseenter: (event) => showRecipientTooltip(item, event.currentTarget),
                            onmouseleave: () => (hoveredRecipient = null),
                          }, m(RecipientResult, { item }))
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
                m('button.compose-mail__field-toggle[type=button]', {
                  class: showCc ? 'is-on' : '',
                  'aria-pressed': String(showCc),
                  onclick: () => showCc = !showCc
                }, 'Cc'),
                m('button.compose-mail__field-toggle[type=button]', {
                  class: showBcc ? 'is-on' : '',
                  'aria-pressed': String(showBcc),
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
                        icon('times', {
                          onclick: () => removeSelectedItem(recipient, recipientType),
                        }),
                      ])
                    ),
                  m('.recipients__input', [
                    m('input[type=text].recipients__input-field', {
                      value: Data.recipients[recipientType].inputVal,
                      oninput: (e) => handleInput(e, recipientType),
                      onfocus: () => handleFocus(recipientType),
                      placeholder: totalRecipients() >= MAX_RECIPIENTS ? 'Max recipients reached' : '',
                      disabled: totalRecipients() >= MAX_RECIPIENTS,
                    }),
                    m('ul.recipients__input-list[autocomplete=off]', [
                      Data.recipients[recipientType].inputList.length > 0
                        ? Data.recipients[recipientType].inputList.map((item) =>
                            m(
                              'li',
                              {
                                key: item.mGroupId,
                                onclick: () => handleClick(item, recipientType),
                                onmouseenter: (event) => showRecipientTooltip(item, event.currentTarget),
                                onmouseleave: () => (hoveredRecipient = null),
                              },
                              m(RecipientResult, { item })
                            )
                          )
                        : m('li', 'No Item'),
                    ]),
                  ]),
                ]),
              ]);
            }),
            totalRecipients() >= MAX_RECIPIENTS && m('.compose-mail__recipient-limit',
              `Maximum of ${MAX_RECIPIENTS} recipients reached. Remove a recipient to add more.`),
            renderRecipientTooltip(),
          ]),
          m('input.compose-mail__subject[type=text][placeholder=Subject]', {
            value: Data.subject,
            oninput: (e) => (Data.subject = e.target.value),
          }),

          // Hidden File Inputs
          m('input#mail-file-attach[type=file]', {
            hidden: true,
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
            hidden: true,
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
            m('.mail-attachments-bar', [
              m('span.mail-attachments-bar__label', [
                icon('paperclip'),
                `Attachments (${attachments.length})`
              ]),
              attachments.map((att, index) =>
                m('.mail-attachment-chip', [
                  icon('file-alt'),
                  m('span.mail-attachment-chip__name', att.name),
                  m('span.mail-attachment-chip__size', `(${att.size})`),
                  m('button.mail-attachment-chip__remove[type=button]', {
                    'aria-label': `Remove ${att.name}`,
                    onclick: () => attachments.splice(index, 1),
                  }, icon('times')),
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
          ]),

          //  Attach, image, emoji -- the same order as the chat composer.
          m('.mail-compose-toolbar', [
            m('.toolbar-left', [
              m('button.mail-tool-btn[type=button]', {
                title: 'Attach files',
                onclick: () => {
                  const input = document.getElementById('mail-file-attach');
                  if (input) input.click();
                },
              }, icon('paperclip')),
              m('button.mail-tool-btn[type=button]', {
                title: 'Insert image',
                onclick: () => {
                  const input = document.getElementById('mail-image-attach');
                  if (input) input.click();
                },
              }, icon('image')),
              m('.mail-tool-btn__anchor', [
                m('button.mail-tool-btn[type=button]', {
                  title: 'Insert emoji',
                  class: showEmojiPicker ? 'active' : '',
                  'aria-pressed': String(showEmojiPicker),
                  onclick: (e) => {
                    e.stopPropagation();
                    showEmojiPicker = !showEmojiPicker;
                  },
                }, icon('smile')),
                showEmojiPicker && m('.emoji-picker__anchor',
                  m(chatEmoji.EmojiPicker, {
                    onSelect: insertEmoji,
                    onClose: () => { showEmojiPicker = false; },
                  })),
              ]),
            ]),

            m('button.mail-compose-send-btn.is-primary[type=button]', {
              onclick: sendMail,
            }, [icon('paper-plane'), m('span', 'Send')]),
          ]),
        ]),
      ]);
    },
  };
};

//  Called by whatever renders the popup's close button. Falls back to closing
//  when no composer has registered a guard.
Layout.requestClose = (fallback) => {
  if (requestComposerClose) requestComposerClose();
  else if (fallback) fallback();
};

module.exports = Layout;
