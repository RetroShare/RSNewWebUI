const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const futil = require('files/files_util');
const cutil = require('config/config_util');

const shareManagerInfo = `
    This is a list of shared folders. You can add and remove folders using the buttons at the bottom.
    When you add a new folder, initially all files in that folder are shared. You can separately
    share flags for each shared directory.
  `;

const SharedDirectoryForm = () => {
  let newDirPath = '';

  function handleSubmit(e) {
    e.preventDefault();
    rs.rsJsonApiRequest('/rsFiles/addSharedDirectory', {
      dir: {
        filename: newDirPath,
        virtualname: '',
        shareflags: futil.DIR_FLAGS_ANONYMOUS_SEARCH | futil.DIR_FLAGS_ANONYMOUS_DOWNLOAD,
        parent_groups: [],
      },
    }).then((res) => console.log(res));
    console.log(newDirPath);
  }

  return {
    view: () =>
      m('.widget', [
        m('.widget__heading', m('h3', 'Add New Directory')),
        m('form.widget__body.share-manager__form', { onsubmit: handleSubmit }, [
          m('.share-manager__form_input', [
            m('label', 'Enter absolute directory path :'),
            m('input[type=text]', {
              value: newDirPath,
              oninput: (e) => (newDirPath = e.target.value),
            }),
          ]),
          m('button[type=submit]', 'Add Directory'),
        ]),
      ]),
  };
};

const ShareManager = () => {
  let sharedDirArr = [];
  let isEditDisabled = true;
  return {
    oninit: () => {
      rs.rsJsonApiRequest('/rsFiles/getSharedDirectories').then(
        (res) => (sharedDirArr = res.body.dirs)
      );
    },
    view: () => {
      return m('.widget', [
        m('.widget__heading', m('h3', 'ShareManager')),
        m('.widget__body.share-manager', [
          m('blockquote.info', shareManagerInfo),
          m('table.share-manager__table', [
            m(
              'thead.share-manager__table_heading',
              m('tr', [
                m('td', 'Shared Directories'),
                m('td', 'Visible Name'),
                m(
                  'td',
                  'Access',
                  cutil.tooltip(`Manage Control Access for Directories, The three options
                    are for the following purpose. 1. Directory can be searched anonymously, 2.
                    Directory can be accessed anonymously, 3. Directory can be browsed anonymously
                    `)
                ),
                m('td', 'Visibility'),
              ])
            ),
            m(
              'tbody.share-manager__table_body',
              sharedDirArr &&
                sharedDirArr.map((sharedDirItem) => {
                  const sharedFlags = futil.calcShareFlags(sharedDirItem.shareflags);
                  return m('tr', [
                    m(
                      'td',
                      m('input[type=text]', {
                        value: sharedDirItem.filename,
                        disabled: isEditDisabled,
                      })
                    ),
                    m(
                      'td',
                      m('input[type=text]', {
                        value: sharedDirItem.virtualname,
                        disabled: isEditDisabled,
                      })
                    ),
                    m(
                      'td',
                      Object.keys(sharedFlags).map((flag) => {
                        return m('input[type=checkbox]', {
                          checked: sharedFlags[flag],
                          disabled: isEditDisabled,
                        });
                      })
                    ),
                    m(
                      'td',
                      sharedDirItem.parent_groups.length === 0
                        ? m('td', 'All Friend nodes')
                        : m(
                            'td',
                            sharedDirItem.parent_groups.map(
                              (group) => `${futil.RsNodeGroupId[group]},`
                            )
                          )
                    ),
                  ]);
                })
            ),
          ]),
          m(
            '.share-manager__actions',
            m(
              '.share-manager__actions-add',
              m('button', { onclick: () => widget.popupMessage(m(SharedDirectoryForm)) }, 'Add New')
            ),
            m('.share-manager__actions-edit', [
              isEditDisabled && m('button', { onclick: () => (isEditDisabled = false) }, 'Edit'),
              !isEditDisabled &&
                m('button', { onclick: () => (isEditDisabled = true) }, 'Apply and Close'),
            ])
          ),
        ]),
      ]);
    },
  };
};

module.exports = ShareManager;
