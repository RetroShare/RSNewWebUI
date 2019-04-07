var m = require("mithril");
var rs = require("rswebui");

function loginResponse(isSuccessful) {
        if (isSuccessful) {
                var dl = require("downloads");
                m.mount(document.body, dl);
        }
        else {
                m.render(document.getElementById("warning"), "Incorrent login/password");
        }
}

function startLogin() {
        var uname = document.getElementById("uname").value;
        var passwd = document.getElementById("passwd").value;
        rs.validateLogin(uname, passwd, loginResponse);
}

module.exports = {
        view: function() {
                return m("div[id=loginbox]",
                        [
                                m("input", {type: "text", placeholder: "Username", id: "uname"}),
                                m("input", {type: "password", placeholder: "Password", id: "passwd"}),
                                m("button", {onclick: startLogin, style: "width:5em;height:2em;"}, "Login"),
                                m("p", {id: "warning", style: "color:red"}),
                        ]
                )
        }
}

