const m = require('mithril');

const Layout = () => {
    return{
        view: () => [            
            m('.widget',[m('h2', 'Popular Channels'),m('hr'),])
        ]
    };
};

module.exports = Layout();