const m = require('mithril');
const rs = require('rswebui');

const shareManagerInfo = `
    This is a list of shared folders. You can add and remove folders using the buttons at the bottom.
    When you add a new folder, initially all files in that folder are shared. You can separately
    share flags for each shared directory.
  `;

const ShareManager = () => {
  return {
    oninit: () => console.log('share manager'),
    view: () => {
      return m('.widget', [
        m('.widget__heading', m('h3', 'ShareManager')),
        m('.widget__body', m('blockquote.info', shareManagerInfo)),
      ]);
    },
  };
};

module.exports = ShareManager;
