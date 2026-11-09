const m = require('mithril');
const icon = require('icon');
const motion = require('motion');
const { TableBranch } = require('table_branch');

const FileTreeRow = {
  view: ({ attrs, children }) => m(attrs.ontoggle ? 'button.file-tree__row[type=button]' : '.file-tree__row', {
    onclick: attrs.ontoggle,
    'aria-label': attrs.ontoggle ? attrs.label : undefined,
    disabled: attrs.ontoggle ? attrs.loading : undefined,
    'aria-expanded': attrs.ontoggle ? String(attrs.expanded) : undefined,
    'aria-busy': attrs.loading ? 'true' : undefined,
  }, [
    attrs.ontoggle
      ? icon(attrs.loading ? 'spinner' : 'angle-right', {
        class: attrs.loading ? 'file-tree__loading' : 'file-tree__twist',
        spin: attrs.loading,
      })
      : m('span.file-tree__twist.is-empty'),
    children,
  ]),
};

const FileTreeBranch = {
  onbeforeremove: motion.exit,
  view: ({ attrs, children }) => m(TableBranch, {
    class: 'file-tree__branch',
    gridClass: 'file-tree__branch-grid',
    tableClass: attrs.remote ? 'friendsfiles' : 'myfiles',
    columns: attrs.remote ? ['', 'file-tree__size-column', 'file-tree__action-column'] : ['', 'file-tree__size-column'],
  }, children),
};

module.exports = { FileTreeRow, FileTreeBranch };
