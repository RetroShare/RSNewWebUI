const m = require('mithril');
const motion = require('motion');

const TableBranch = {
  onbeforeremove: motion.exit,
  view: ({ attrs, children }) => m('tr.table-branch', { class: attrs.class },
    m('td', { colspan: attrs.columns.length },
      m('.table-branch__grid', { class: attrs.gridClass }, m('div',
        m('table', { class: attrs.tableClass }, [
          m('colgroup', attrs.columns.map((className) => m('col', { class: className }))),
          m('tbody', children),
        ]))))),
};

function nestedRows(rows, renderRow, attrs) {
  let index = 0;
  const branch = (depth) => {
    const result = [];
    while (index < rows.length && rows[index].depth === depth) {
      const row = rows[index++];
      result.push(renderRow(row));
      if (index < rows.length && rows[index].depth > depth) {
        result.push(m(TableBranch, { ...attrs, key: `branch-${row.meta.mMsgId}` }, branch(depth + 1)));
      }
    }
    return result;
  };
  return branch(0);
}

module.exports = { TableBranch, nestedRows };
