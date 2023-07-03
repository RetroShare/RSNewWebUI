const m = require('mithril');
const rs = require('rswebui');
const util = require('mail/mail_util');

const Layout = () => {
  const files = [];
  let viewChanged = false;

  return {
    oninit: (v) => {
      v.attrs.list.forEach(async (element) => {
        const res = await rs.rsJsonApiRequest('/rsMsgs/getMessage', {
          msgId: element.msgId,
        });
        if (res.body.retval) {
          res.body.msg.files.forEach((element) => {
            files.push({ ...element, from: res.body.msg.from, ts: res.body.msg.ts });
          });
        }
      });
    },
    view: (v) => [
      m('.widget__heading', [
        m('h3', 'Attachments'),
        m('.view-toggle', [
          m(
            '.mail-view',
            {
              onclick: () => (viewChanged = false),
              style: { backgroundColor: viewChanged ? '#fff' : '#019DFF' },
            },
            m('i.fas.fa-mail-bulk')
          ),
          m(
            '.attachment-view',
            {
              onclick: () => (viewChanged = true),
              style: { backgroundColor: viewChanged ? '#019DFF' : '#fff' },
            },
            m('i.fas.fa-file')
          ),
        ]),
      ]),
      m('.widget__body', [
        viewChanged
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
