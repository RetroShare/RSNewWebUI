const m = require('mithril');
const rs = require('rswebui');
const util = require('files/files_util');

function displayfiles() {
  const children_list = [];
  return {
    oninit: (v) => {
      v.attrs.par_directory.children.map(async (child) => {
        console.log(child);
        const res = await rs.rsJsonApiRequest('/rsfiles/requestDirDetails', {
          handle: child.handle.xint64,
        });
        children_list.push(res.body.details);
      });
    },
    view: (v) => [
      m('tr', [
        m('td', v.attrs.par_directory.name),
        m('td', util.formatbytes(v.attrs.par_directory.size.xint64)),
      ]),
      children_list.map((child) =>
        m(displayfiles, {
          par_directory: child,
        })
      ),
    ],
  };
}

const Layout = () => {
  // let root_handle;
  let parent;
  return {
    oninit: async () => {
      const res = await rs.rsJsonApiRequest('/rsfiles/requestDirDetails', {});
      parent = res;
    },
    view: (v) => [
      m('.widget', [
        m(
          util.MyFilesTable,
          m(
            'tbody',
            parent &&
              m(displayfiles, {
                par_directory: parent.body.details,
                replyDepth: 0,
              })
          )
        ),
      ]),
    ],
  };
};

module.exports = Layout;
