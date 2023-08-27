const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const futil = require('files/files_util');
const cutil = require('config/config_util');

const shareManagerInfo = `
  This is a list of shared folders. You can add and remove folders using the buttons at the bottom.
  When you add a new folder, initially all files in that folder are shared. You can separately share
  flags for each shared directory.
`;

const accessTooltipText = `Manage Control Access for Directories, The three options are for the
  following purpose. 1. Directory can be searched anonymously, 2. Directory can be accessed
  anonymously, 3. Directory can be browsed anonymously
`;

const addNewDirInfo = `For Security reasons, Browsers don't allow to read directories so Please
  copy and paste the absolute path of the directory which you want to share.
`;

let sharedDirArr = [];

const AddSharedDirForm = () => {
  let newDirPath = '';

  function handleSubmit(e) {
    e.preventDefault();
    // check if newDirPath already exists
    const sharedDirArrExists = sharedDirArr.find((item) => item.filename === newDirPath);
    if (sharedDirArrExists) {
      alert('The path you entered already exists.');
      return;
    }
    rs.rsJsonApiRequest('/rsFiles/addSharedDirectory', {
      dir: {
        filename: newDirPath,
        virtualname: '',
        shareflags: futil.DIR_FLAGS_ANONYMOUS_SEARCH | futil.DIR_FLAGS_ANONYMOUS_DOWNLOAD,
        parent_groups: [],
      },
    }).then((res) => {
      widget.popupMessage(
        m('.widget', [
          m('.widget__heading', m('h3', 'Add Shared Directory')),
          m(
            '.widget__body',
            m(
              'p',
              res.body.retval
                ? 'Successfully Added Directory to Shared List'
                : 'Error in Adding Directory to Shared List'
            )
          ),
        ])
      );
    });
  }

  return {
    view: () =>
      m('.widget', [
        m('.widget__heading', m('h3', 'Add New Directory')),
        m('form.widget__body.share-manager__form', { onsubmit: handleSubmit }, [
          m('blockquote.info', addNewDirInfo),
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

const ShareDirTable = () => {
  return {
    view: (v) => {
      const { isEditDisabled } = v.attrs;
      return m('table.share-manager__table', [
        m(
          'thead.share-manager__table_heading',
          m('tr', [
            m('td', 'Shared Directories'),
            m('td', 'Visible Name'),
            m('td', 'Access', cutil.tooltip(accessTooltipText)),
            m('td', 'Visibility'),
          ])
        ),
        m(
          'tbody.share-manager__table_body',
          sharedDirArr.length !== 0 &&
            sharedDirArr.map((sharedDirItem) => {
              const {
                filename,
                virtualname,
                shareflags,
                parent_groups: parentGroups,
              } = sharedDirItem;
              const sharedFlags = futil.calcShareFlags(shareflags);
              return m('tr', [
                m(
                  'td',
                  m('input[type=text]', {
                    value: filename,
                    disabled: isEditDisabled,
                  })
                ),
                m(
                  'td',
                  m('input[type=text]', {
                    value: virtualname,
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
                  parentGroups.length === 0
                    ? m('td', 'All Friend nodes')
                    : m(
                        'td',
                        sharedDirItem.parent_groups.map((group) => `${futil.RsNodeGroupId[group]},`)
                      )
                ),
              ]);
            })
        ),
      ]);
    },
  };
};

const ShareManager = () => {
  let isEditDisabled = true;
  return {
    oninit: () => {
      rs.rsJsonApiRequest('/rsFiles/getSharedDirectories').then((res) => {
        if (res.body.retval) sharedDirArr = res.body.dirs;
      });
    },
    view: () => {
      return m('.widget', [
        m('.widget__heading', m('h3', 'ShareManager')),
        m('.widget__body.share-manager', [
          m('blockquote.info', shareManagerInfo),
          sharedDirArr.length !== 0 && m(ShareDirTable, { isEditDisabled }),
          m(
            '.share-manager__actions',
            m(
              '.share-manager__actions-add',
              m('button', { onclick: () => widget.popupMessage(m(AddSharedDirForm)) }, 'Add New')
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
