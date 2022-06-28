const m = require('mithril');

const Layout = () => {
    return{
        view: () => [
            m('.widget', [m('h2', 'Other Boards'), m('hr'), ])
        ]
    };
};

module.exports = Layout();
