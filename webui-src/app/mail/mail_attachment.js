const m = require('mithril');
const rs = require('rswebui');
const util = require('mail/mail_util');
const widget = require('widgets');

const Layout = () => {
  const files = [];
  let viewChanged = false;

  return {
    oninit: (v) => {
      v.attrs.list.forEach(async (element) => {
        const res = await rs.rsJsonApiRequest('/rsMail/getMessage', {
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
        m(widget.Segmented, {
          ariaLabel: 'Attachment view',
          value: viewChanged ? 'files' : 'mails',
          options: [
            { id: 'mails', icon: 'mail-bulk', title: 'Group by message' },
            { id: 'files', icon: 'file', title: 'List all files' },
          ],
          onSelect: (id) => (viewChanged = id === 'files'),
        }),
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
                    key: msg.msgId,
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
