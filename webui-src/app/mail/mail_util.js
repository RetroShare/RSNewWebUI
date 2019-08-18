const m = require('mithril');
const rs = require('rswebui');
const people = require('people_util');


const MessageSummary = () => {
  let details = {};
  let files = [];
  let isStarred = undefined;
  return {
    oninit: (v) => rs.rsJsonApiRequest('/rsMsgs/getMessage', {
      msgId: v.attrs.details.msgId,
    }, (data) => {
      details = data.msg;
      files = details.files;
      v.state.isStarred = (details.msgflags & 0xf00) === 0x200;

    }),
    view: (v) => m('tr.msgbody', {
      key: details.msgId,
      class: (details.msgflags & 0xf0) === 0x40 ? 'unread' : 'read',
      onclick: () => m.route.set('/mail/:tab/:msgId', {
        tab: v.attrs.category,
        msgId: details.msgId,
      }),
    }, [
      m('td',
        m('input.star-check[type=checkbox][id=msg-' + details.msgId +
          ']', {
            checked: v.state.isStarred
          }),
        // Use label with  [for] to manipulate hidden checkbox
        m('label.star-check[for=msg-' + details.msgId + ']', {
          onclick: (e) => {
            v.state.isStarred = !v.state.isStarred;
            rs.rsJsonApiRequest('/rsMsgs/MessageStar', {
              msgId: details.msgId,
              mark: v.state.isStarred,
            });
            // Stop event bubbling, both functions for supporting IE & FF
            e.stopImmediatePropagation();
            e.preventDefault();
          },
          class: (details.msgflags & 0xf00) === 0x200 ? 'starred' : 'unstarred'
        }, m('i.fas.fa-star'))),
      m('td', files.length),
      m('td', details.title),
      //m('td', details.rspeerid_srcId == 0 ?
      //  '[Notification]' :
      //  people.getInfo(details.rspeerid_srcId)),
      m('td', new Date(details.ts * 1000).toLocaleString()),
    ]),
  };
};

const MessageView = () => {
  let details = {};
  let message = '';
  return {
    oninit: (v) => rs.rsJsonApiRequest('/rsMsgs/getMessage', {
      msgId: v.attrs.id,
    }, (data) => {
      details = data.msg;
      // regex to detect html tags
      // better regex?  /<[a-z][\s\S]*>/gi
      if(/<\/*[a-z][^>]+?>/gi.test(details.msg)) {
        message = details.msg;
      } else {
        message = '<p style="white-space: pre">' + details.msg + '</p>';
      }
    }),
    view: (v) => m('.widget.msgview', {
      key: details.msgId,
    }, [
      m('a[title=Back]', {
        onclick: () => m.route.set('/mail/:tab', {
          tab: m.route.param().tab,
        }),
      }, m('i.fas.fa-arrow-left')),
      m('h3', details.title),
      m('hr'),
      m('iframe[title=message].msg', {
        srcdoc: message,
      }, message),
    ]),
  };
};

const Table = () => {
  return {
    oninit: (v) => {},
    view: (v) => m('table.mails', [
      m('tr', [
        m('th[title=starred]', m('i.fas.fa-star')),
        m('th[title=attachments]', m('i.fas.fa-paperclip')),
        m('th', 'Subject'),
        //m('th', 'From'),
        m('th', 'Date'),
      ]),
      v.children,
    ]),
  };
};

module.exports = {
  MessageSummary,
  MessageView,
  Table,
};

