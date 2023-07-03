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
  const modalContainer = document.getElementById('modal-container');
  msgTagObj.tagId = typeof tagId === 'number' ? tagId : util.getRandomId(tagArr);
  let tagNameAlreadyExists = false;
  tagArr.forEach((item) => {
    if (item.value.first === msgTagObj.tagName) tagNameAlreadyExists = true;
  });
  if (tagNameAlreadyExists) {
    alert('Tag Name Already Exists');
  } else {
    rs.rsJsonApiRequest('/rsMsgs/setMessageTagType', {
      tagId: msgTagObj.tagId,
      text: msgTagObj.tagName,
      rgb_color: parseInt(msgTagObj.tagColor.substring(1), 16),
    });
    modalContainer.style.display = 'none';
    rs.rsJsonApiRequest('/rsMsgs/getMessageTagTypes').then((res) => (tagArr = res.body.tags.types));
  }
}

const MessageTagForm = () => {
  return {
    view: (v) => {
      const isCreateForm = v.attrs.tagItem === undefined;
      return m(
        'form.mail-tags-form',
        {
          onsubmit: isCreateForm ? handleSubmit : () => handleSubmit(v.attrs.tagItem.key),
        },
        [
          m('h3', isCreateForm ? 'Create New Tag Type' : 'Edit Tag Type'),
          m('hr'),
          m('.input-field', [
            m('label[for=tagName]', 'Enter Tag Name'),
            m('input[type=text][id=tagName][placeholder="enter tag name"]', {
              value: msgTagObj.tagName,
              oninput: (e) => (msgTagObj.tagName = e.target.value),
            }),
          ]),
          m('.input-field', [
            m('label[for=tagColor]', 'Choose Tag Color'),
            m('input[type=color][id=tagColor]', {
              value: msgTagObj.tagColor,
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
  let distantMessagingPermissionFlag = 0;
  return {
    oninit: () => {
      rs.rsJsonApiRequest('/rsMsgs/getMessageTagTypes').then(
        (res) => (tagArr = res.body.tags.types)
      );
      rs.rsJsonApiRequest('/rsMsgs/getDistantMessagingPermissionFlags').then(
        (res) => (distantMessagingPermissionFlag = res.body.retval)
      );
    },
    view: () =>
      m('.widget.mail', [
        m('.widget__heading', m('h3', 'Mail Configuration')),
        m('.widget__body', [
          m('.permission-flag', [
            m('p', 'Accept encrypted distant messages from: '),
            m(
              'select',
              {
                value: distantMessagingPermissionFlag,
                oninput: (e) => (distantMessagingPermissionFlag = e.target.value),
                onchange: () => {
                  rs.rsJsonApiRequest('/rsMsgs/setDistantMessagingPermissionFlags', {
                    flags: parseInt(distantMessagingPermissionFlag),
                  });
                },
              },
              [
                m(
                  'option',
                  {
                    value: util.RS_DISTANT_MESSAGING_PERMISSION_FLAG_FILTER_NONE,
                  },
                  'Everybody'
                ),
                m(
                  'option',
                  {
                    value: util.RS_DISTANT_MESSAGING_PERMISSION_FLAG_FILTER_NON_CONTACTS,
                  },
                  'Contacts'
                ),
                m(
                  'option',
                  {
                    value: util.RS_DISTANT_MESSAGING_PERMISSION_FLAG_FILTER_EVERYBODY,
                  },
                  'Nobody'
                ),
              ]
            ),
          ]),
          m('.widget__heading', [
            m('h3', 'Mail Tags'),
            m(
              'button',
              {
                onclick: () => {
                  // set form fields to default values
                  msgTagObj.tagName = '';
                  msgTagObj.tagColor = '';
                  widget.popupMessage(m(MessageTagForm));
                },
              },
              'Create New Tag'
            ),
          ]),
          m(
            '.mail-tags',
            tagArr.length === 0
              ? m('h4', 'No Message Tags')
              : m(
                  '.mail-tags__container',
                  tagArr.map((tag) =>
                    m('.tag-item', { key: tag.key }, [
                      m('.tag-item__color', {
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
                              msgTagObj.tagName = tag.value.first;
                              msgTagObj.tagColor = `#${tag.value.second
                                .toString(16)
                                .padStart(6, '0')}`;
                              widget.popupMessage(m(MessageTagForm, { tagItem: tag }));
                            },
                          },
                          m('i.fas.fa-pen')
                        ),
                        m(
                          'button.red',
                          {
                            onclick: () => {
                              rs.rsJsonApiRequest('/rsMsgs/removeMessageTagType', {
                                tagId: tag.key,
                              }).then((res) => {
                                if (res.body.retval)
                                  tagArr = tagArr.filter((item) => item.key !== tag.key);
                              });
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
      ]),
  };
};

module.exports = Mail;
