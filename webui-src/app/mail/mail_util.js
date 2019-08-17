const m = require('mithril');
const rs = require('rswebui');
const people = require('people_util');


const MessageSummary = () => {
  let details = {};
  let files = [];
  return {
    oninit: (v) => rs.rsJsonApiRequest('/rsMsgs/getMessage', {
      msgId: v.attrs.details.msgId,
    }, (data) => {
      details = data.msg;
      files = details.files;
    }),
    view: (v) => m('tr.msgbody', {
      key: details.msgId,
      class: (details.msgflags & 0xf0) === 0x40 ? 'unread' : 'read',
      onclick: () => m.route.set('/mail/id=' + v.attrs.details.msgId),
    }, [
      // TODO: custom checkbox tag
      m('td', m('i.fas.fa-star', {
        class: (details.msgflags & 0xf00) === 0x200 ? 'starred' : 'unstarred'
      })),
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
  return {
    oninit: (v) => rs.rsJsonApiRequest('/rsMsgs/getMessage', {
      msgId: v.attrs.id,
    }, (data) => details = data.msg),
    view: (v) => m('.widget.msgview', {
      key: details.msgId,
    }, [
      m('h3', details.title),
      m('hr'),
      m('p', m('iframe[width=100%][height=100%].msg', {src: 'data:text/html;charset=utf-8,'+details.msg})),
    ]),
  };
};

const Table = () => {
  return {
    oninit: (v) => {},
    view: (v) => m('table.mails', [
      m('tr', [
        m('th', m('i.fas.fa-star')),
        m('th', m('i.fas.fa-paperclip')),
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

