const m = require('mithril');
const rs = require('rswebui');
const util = require('mail/mail_util');

const Layout = () => {
  const files = [];
  let changeView = false;

  return {
    oninit: (v) => {
      v.attrs.list.forEach(async (element) => {
        const res = await rs.rsJsonApiRequest('/rsMsgs/getMessage', {
          msgId: element.msgId,
        });
        if (res.body.retval) {
          files.push(...res.body.msg.files);
        }
      });
    },
    view: (v) => [
      m('.widget', [
        m('div.msg-attachment-container', [
          m('h3', 'Attachment'),
          m('.view', [
            m(
              '.mail-view',
              {
                onclick: () => (changeView = false),
                style: { backgroundColor: changeView ? '#fff' : '#019DFF' },
              },
              m('i.fas.fa-mail-bulk')
            ),
            m(
              '.attachment-view',
              {
                onclick: () => (changeView = true),
                style: { backgroundColor: changeView ? '#019DFF' : '#fff' },
              },
              m('i.fas.fa-file')
            ),
          ]),
        ]),
        m('hr'),
        changeView
          ? m(util.AttachmentSection, {
              files,
            })
          : m(
              util.Table,
              m(
                'tbody',
                v.attrs.list.map((msg) =>
                  m(util.MessageSummary, {
                    details: msg,
                    category: 'attachment',
                  })
                )
              )
            ),
      ]),
    ],
  };
};

module.exports = Layout;
