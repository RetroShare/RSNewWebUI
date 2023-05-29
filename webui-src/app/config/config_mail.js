const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const util = require('config/config_util');

const msgTagObj = {
  tagId: 100,
  tagName: '',
  tagColor: '',
};
let tagArr = [];

async function handleSubmit(tagId) {
  msgTagObj.tagId = tagId === undefined ? util.getRandomId(tagArr) : tagId;
  await rs.rsJsonApiRequest('/rsMsgs/setMessageTagType', {
    tagId: msgTagObj.tagId,
    text: msgTagObj.tagName,
    rgb_color: parseInt(msgTagObj.tagColor.substring(1), 16),
  });
  await rs
    .rsJsonApiRequest('/rsMsgs/getMessageTagTypes')
    .then((res) => (tagArr = res.body.tags.types));
  // reset to default values
  msgTagObj.tagId = 100;
  msgTagObj.tagName = '';
  msgTagObj.tagColor = '';
}

const MessageTagForm = () => {
  return {
    view: (v) => {
      const isCreateForm = v.attrs.tagItem === undefined;
      return m(
        'form.message-tags-form',
        {
          onsubmit: isCreateForm ? handleSubmit : () => handleSubmit(v.attrs.tagItem.key),
        },
        [
          m('h3', isCreateForm ? 'Create New Tag Type' : 'Edit Tag Type'),
          m('hr'),
          m('.input-field', [
            m('label[for=tagName]', 'Enter Tag Name'),
            m('input[type=text][id=tagName][placeholder="enter tag name"]', {
              value: isCreateForm ? msgTagObj.tagName : v.attrs.tagItem.value.first,
              oninput: (e) => (msgTagObj.tagName = e.target.value),
            }),
          ]),
          m('.input-field', [
            m('label[for=tagColor]', 'Choose Tag Color'),
            m('input[type=color][id=tagColor]', {
              value: isCreateForm
                ? msgTagObj.tagColor
                : `#${v.attrs.tagItem.value.second.toString(16).padStart(6, '0')}`,
              oninput: (e) => (msgTagObj.tagColor = e.target.value),
            }),
          ]),
          // v.attrs.tagItem !== undefined && m('p', v.attrs.tagItem.value.first),
          m('button[type=submit]', 'Submit'),
        ]
      );
    },
  };
};

const Mail = () => {
  return {
    oninit: async () => {
      await rs
        .rsJsonApiRequest('/rsMsgs/getMessageTagTypes')
        .then((res) => (tagArr = res.body.tags.types));
    },
    view: () =>
      m('.widget.widget-half', [
        m('.message-tags-heading', [
          m('h3', 'Message Tags'),
          m(
            'button',
            {
              onclick: () => {
                widget.popupMessage(m(MessageTagForm));
              },
            },
            'Create New Tag'
          ),
        ]),
        m('hr'),
        m(
          'div.message-tags',
          tagArr.length === 0
            ? m('h4', 'No Message Tags')
            : m(
                'div.message-tags__container',
                tagArr.map((tag) =>
                  m('.tag-item', { key: tag.key }, [
                    m('div.tag-item__color', {
                      style: {
                        backgroundColor: `#${tag.value.second.toString(16).padStart(6, '0')}`,
                      },
                    }),
                    m('p.tag-item__name', tag.value.first),
                    m('.tag-item__modify', [
                      m(
                        'button',
                        {
                          onclick: () => {
                            widget.popupMessage(m(MessageTagForm, { tagItem: tag }));
                          },
                        },
                        m('i.fas.fa-pen')
                      ),
                      m(
                        'button.red',
                        {
                          onclick: async () => {
                            const res = await rs.rsJsonApiRequest('/rsMsgs/removeMessageTagType', {
                              tagId: tag.key,
                            });
                            if (res.body.retval)
                              tagArr = tagArr.filter((item) => item.key !== tag.key);
                          },
                        },
                        m('i.fas.fa-trash')
                      ),
                    ]),
                  ])
                )
              )
        ),
      ]),
  };
};

module.exports = Mail;
