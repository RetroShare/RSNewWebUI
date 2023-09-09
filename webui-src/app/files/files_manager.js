const m = require('mithril');
const rs = require('rswebui');
const widget = require('widgets');
const futil = require('files/files_util');
const cutil = require('config/config_util');

const shareManagerInfo = `
  This is a list of shared folders. You can add and remove folders using the buttons at the bottom.
  e.g- You can click on Edit button and then modify any field. When you add a new folder, initially
  all files in that folder are shared. You can separately share flags for each shared directory.
`;

const accessTooltipText = [
  'Manage Control Access for Directories, The three options are for the following purpose.',
  m('i.fas.fa-search'),
  ' Directory can be searched anonymously, ',
  m('i.fas.fa-download'),
  ' Directory can be accessed anonymously, ',
  m('i.fas.fa-eye'),
  ' Directory can be browsed by designated friends',
];

const addNewDirInfo = `For Security reasons, Browsers don't allow to read directories so Please
  copy and paste the absolute path of the directory which you want to share.
`;

let sharedDirArr = [];
let isEditDisabled = true;

function loadSharedDirectories() {
  rs.rsJsonApiRequest('/rsFiles/getSharedDirectories').then((res) => {
    if (res.body.retval) sharedDirArr = res.body.dirs;
  });
}

// Update Shared Directories when there is a corresponding event
rs.events[rs.RsEventsType.SHARED_DIRECTORIES] = {
  handler: (event) => {
    console.log('Shared Directories Event: ', event);
    loadSharedDirectories();
  },
};

const AddSharedDirForm = () => {
  let newDirPath = '';

  function addNewSharedDirectory() {
    // check if newDirPath already exists
    const sharedDirArrExists = sharedDirArr.find((item) => item.filename === newDirPath);
    if (sharedDirArrExists) {
      alert('The path you entered already exists.');
      return;
    }
    const newSharedDir = {
      dir: {
        filename: newDirPath,
        virtualname: '',
        shareflags: futil.DIR_FLAGS_ANONYMOUS_SEARCH | futil.DIR_FLAGS_ANONYMOUS_DOWNLOAD,
        parent_groups: [],
      },
    };
    rs.rsJsonApiRequest('/rsFiles/addSharedDirectory', { ...newSharedDir }).then((res) => {
      if (res.body.retval) {
        loadSharedDirectories();
      }
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
        m('form.widget__body.share-manager__form', { onsubmit: addNewSharedDirectory }, [
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

const ManageVisibility = () => {
  function handleSubmit() {
    m.redraw();
    const mContainer = document.getElementById('modal-container');
    mContainer.style.display = 'none';
  }
  return {
    view: (v) => {
      const { parentGroups } = v.attrs;
      return m('.widget', [
        m('.widget__heading', m('h3', 'Manage Visibility')),
        m('form.widget__body', { onsubmit: handleSubmit }, [
          Object.keys(futil.RsNodeGroupId).map((groupId) =>
            m('div.manage-visibility', [
              m(`label[for=${futil.RsNodeGroupId[groupId]}]`, futil.RsNodeGroupId[groupId]),
              m(`input[type=checkbox][id=${futil.RsNodeGroupId[groupId]}]`, {
                // if parentGroups is empty it means All friends nodes have Visibility
                checked: parentGroups.includes(groupId),
                onclick: () => {
                  if (parentGroups.includes(groupId)) {
                    const groupItemIndex = parentGroups.indexOf(groupId);
                    parentGroups.splice(groupItemIndex, 1);
                  } else {
                    parentGroups.push(groupId);
                  }
                },
              }),
            ])
          ),
          m('button[type=submit]', 'OK'),
        ]),
      ]);
    },
  };
};

const ShareDirTable = () => {
  return {
    oninit: futil.loadRsNodeGroupId,
    view: () => {
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
          sharedDirArr.length &&
            sharedDirArr.map((sharedDirItem, index) => {
              const {
                filename,
                virtualname,
                shareflags,
                parent_groups: parentGroups,
              } = sharedDirItem;
              const sharedFlags = futil.calcIndividualFlags(shareflags);
              return m('tr', [
                m(
                  'td',
                  m('input[type=text]', {
                    value: filename,
                    disabled: isEditDisabled,
                    oninput: (e) => {
                      sharedDirArr[index].filename = e.target.value;
                    },
                  })
                ),
                m(
                  'td',
                  m('input[type=text]', {
                    value: virtualname,
                    disabled: isEditDisabled,
                    oninput: (e) => {
                      sharedDirArr[index].virtualname = e.target.value;
                    },
                  })
                ),
                m(
                  'td.share-flags',
                  Object.keys(sharedFlags).map((flag) => {
                    return [
                      m(`input.share-flags-check[type=checkbox][id=${flag}]`, {
                        checked: sharedFlags[flag],
                        disabled: isEditDisabled,
                      }),
                      m(
                        `label.share-flags-label[for=${flag}]`,
                        {
                          onclick: () => {
                            if (isEditDisabled) return;
                            sharedFlags[flag] = !sharedFlags[flag];
                            sharedDirArr[index].shareflags = futil.calcShareFlagsValue(sharedFlags);
                          },
                          style: isEditDisabled && { color: '#7D7D7D' },
                        },
                        m(
                          // check the flag type then if its value is true then only render the icon
                          flag === 'isAnonymousSearch'
                            ? sharedFlags[flag]
                              ? 'i.fas.fa-search'
                              : 'span'
                            : flag === 'isAnonymousDownload'
                            ? sharedFlags[flag]
                              ? 'i.fas.fa-download'
                              : 'span'
                            : sharedFlags[flag]
                            ? 'i.fas.fa-eye'
                            : 'span'
                        )
                      ),
                    ];
                  })
                ),
                m(
                  'td',
                  {
                    // since this is not an input element, manually change color
                    style: { color: isEditDisabled ? '#6D6D6D' : 'black' },
                    onclick: () =>
                      !isEditDisabled && widget.popupMessage(m(ManageVisibility, { parentGroups })),
                  },
                  parentGroups.length === 0
                    ? 'All Friend nodes'
                    : parentGroups.map((groupFlag) => `${futil.RsNodeGroupId[groupFlag]},`)
                ),
              ]);
            })
        ),
      ]);
    },
  };
};

const ShareManager = () => {
  function setNewSharedDirectories() {
    rs.rsJsonApiRequest('/rsFiles/setSharedDirectories', {
      dirs: sharedDirArr,
    });
  }
  return {
    oninit: loadSharedDirectories,
    view: () => {
      return m('.widget', [
        m('.widget__heading', m('h3', 'ShareManager')),
        m('form.widget__body.share-manager', { onsubmit: setNewSharedDirectories }, [
          m('blockquote.info', shareManagerInfo),
          m(ShareDirTable),
          m('.share-manager__actions', [
            m('button', { onclick: () => widget.popupMessage(m(AddSharedDirForm)) }, 'Add New'),
            m(
              'button',
              { onclick: () => (isEditDisabled = !isEditDisabled) },
              isEditDisabled ? 'Edit' : 'Apply and Close'
            ),
          ]),
        ]),
      ]);
    },
  };
};

module.exports = ShareManager;
