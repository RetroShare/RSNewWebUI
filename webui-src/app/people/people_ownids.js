let m = require("mithril");
let rs = require("rswebui");
let widget = require("widgets");
let people_util = require("people/people_util");

function checksudo(data) {
  if (data === "0000000000000000") return true;
  return false;
}

const CreateIdentity = () => {
  // TODO: set user avatar
  let name = "",
    id = "",
    pgpPassword = "",
    pseudonimous = false;
  return {
    view: (v) => [
      m("i.fas.fa-user-plus"),
      m("h3", "Create new Identity"),
      m("hr"),
      m("input[type=text][placeholder=Name]", {
        value: name,
        oninput: (e) => (name = e.target.value),
      }),
      m(
        "div",
        {
          style: "display:inline; margin-left:5px;",
        },
        [
          "Type:",
          m(
            "select",
            {
              value: pseudonimous,
              style: "border:1px solid black",
              oninput: (e) => {
                if (e.target.value == "false") pseudonimous = false;
                else pseudonimous = true;
              },
            },
            [
              m("option[value=false]", "Linked to your Profile"),
              m("option[value=true]", "Pseudonymous"),
            ]
          ),
        ]
      ),
      m("br"),
      m("input[type=password][placeholder=Retroshare Passphrase]", {
        value: pgpPassword,
        oninput: (e) => (pgpPassword = e.target.value),
      }),
      m(
        "p",
        "You can have one or more identities. " +
          "They are used when you chat in lobbies, " +
          "forums and channel comments. " +
          "They act as the destination for distant chat and " +
          "the Retroshare distant mail system."
      ),
      m(
        "button",
        {
          onclick: () => {
            if (pseudonimous == false) {
              let paraphase = "";
              widget.popupMessage([
                m("i.fas.fa-user-edit"),
                m("h3", "Enter your passpharse"),
                m("hr"),

                m("input[type=password][placeholder=Passpharse]", {
                  style: "margin-top:50px;width:80%",
                  oninput: (e) => {
                    paraphase = e.target.value;
                  },
                }),
                m(
                  "button",
                  {
                    style: "margin-top:160px;",
                    onclick: () => {
                      rs.rsJsonApiRequest(
                        "/rsIdentity/getOwnSignedIds",
                        {},
                        (owns) => {
                          if (owns.ids.length > 0) {
                            console.log(owns.ids);
                            id = owns.ids[0];
                            console.log(id);
                          }
                          rs.rsJsonApiRequest(
                            "/rsIdentity/createIdentity",
                            {
                              id: id,
                              name: name,
                              //avatar: v.attrs.details.mAvatar.mData.base64,
                              pseudonimous: pseudonimous,
                              pgpPassword: paraphase,
                            },
                            (data) => {
                              const message = data.retval
                                ? "Successfully created identity."
                                : "An error occured while creating identity.";
                              widget.popupMessage([
                                m("h3", "Create new Identity"),
                                m("hr"),
                                message,
                              ]);
                            }
                          );
                        }
                      );
                    },
                  },
                  "Enter"
                ),
              ]);
            } else
              rs.rsJsonApiRequest(
                "/rsIdentity/createIdentity",
                {
                  name,
                  pseudonimous,
                  pgpPassword,
                },
                (data) => {
                  const message = data.retval
                    ? "Successfully created identity."
                    : "An error occured while creating identity.";
                  widget.popupMessage([
                    m("h3", "Create new Identity"),
                    m("hr"),
                    message,
                  ]);
                }
              );
          },
        },
        "Create"
      ),
    ],
  };
};

const EditIdentity = () => {
  let name = "";
  return {
    view: (v) => [
      m("i.fas.fa-user-edit"),
      m("h3", "Edit Identity"),
      m("hr"),
      m("input[type=text][placeholder=Name]", {
        value: name,
        oninput: (e) => {
          name = e.target.value;
        },
      }),
      m("canvas"),
      m(
        "button",
        {
          onclick: () => {
            if (!checksudo(v.attrs.details.mPgpId)) {
              console.log(v.attrs.details.mPgpId);
              let paraphase = "";
              widget.popupMessage([
                m("i.fas.fa-user-edit"),
                m("h3", "Enter your passpharse"),
                m("hr"),

                m("input[type=password][placeholder=Passpharse]", {
                  style: "margin-top:50px;width:80%",
                  oninput: (e) => {
                    paraphase = e.target.value;
                  },
                }),
                m(
                  "button",
                  {
                    style: "margin-top:160px;",
                    onclick: () =>
                      rs.rsJsonApiRequest(
                        "/rsIdentity/updateIdentity",
                        {
                          id: v.attrs.details.mId,
                          name: name,
                          //avatar: v.attrs.details.mAvatar.mData.base64,
                          pseudonimous: checksudo(v.attrs.details.mPgpId),
                          pgpPassword: paraphase,
                        },
                        (data) => {
                          const message = data.retval
                            ? "Successfully Updated identity."
                            : "An error occured while updating  identity.";
                          widget.popupMessage([
                            m("h3", "Create new Identity"),
                            m("hr"),
                            message,
                          ]);
                        }
                      ),
                  },
                  "Enter"
                ),
              ]);
            } else {
              rs.rsJsonApiRequest(
                "/rsIdentity/updateIdentity",
                {
                  id: v.attrs.details.mId,
                  name: name,
                  //avatar: v.attrs.details.mAvatar.mData.base64,
                  pseudonimous: checksudo(v.attrs.details.mPgpId),
                },
                (data) => {
                  const message = data.retval
                    ? "Successfully Updated identity."
                    : "An error occured while updating  identity.";
                  widget.popupMessage([
                    m("h3", "Update Identity"),
                    m("hr"),
                    message,
                  ]);
                  m.redraw();
                }
              );
            }
          },
        },
        "Save"
      ),
    ],
  };
};

const DeleteIdentity = () => {
  return {
    view: (v) => [
      m("i.fas.fa-user-times"),
      m("h3", "Delete Identity: " + v.attrs.name),
      m("hr"),
      m(
        "p",
        "Are you sure you want to delete this Identity? It cannot be restore"
      ),
      m(
        "button",
        {
          onclick: () =>
            rs.rsJsonApiRequest(
              "/rsIdentity/deleteIdentity",
              {
                id: v.attrs.id,
              },
              () =>
                widget.popupMessage([
                  m("i.fas.fa-user-edit"),
                  m("h3", "Delete Identity: " + v.attrs.name),
                  m("hr"),
                  m("p", "Identity Deleted successfuly."),
                ])
            ),
        },
        "Confirm"
      ),
    ],
  };
};

const Identity = () => {
  let details = {};

  let avatarURI = {
    view: () => [],
  };

  return {
    oninit: (v) =>
      rs.rsJsonApiRequest(
        "/rsIdentity/getIdDetails",
        {
          id: v.attrs.id,
        },
        (data) => {
          details = data.details;
          // Creating URI during fetch because `details` is uninitialized
          // during view run, due to request being async.
          avatarURI = people_util.createAvatarURI(data.details.mAvatar);
        }
      ),
    view: (v) =>
      m(
        ".identity",
        {
          key: details.mId,
        },
        [
          m("h4", details.mNickname),
          m(avatarURI),
          m(".details", [
            m("p", "ID:"),
            m("p", details.mId),
            m("p", "Type:"),
            m("p", details.mFlags === 14 ? "Signed ID" : "Anonymous ID"),
            m("p", "Owner node ID:"),
            m("p", details.mPgpId),
            m("p", "Created on:"),
            m(
              "p",
              typeof details.mPublishTS === "object"
                ? new Date(details.mPublishTS.xint64 * 1000).toLocaleString()
                : "undefiend"
            ),
            m("p", "Last used:"),
            m(
              "p",
              typeof details.mLastUsageTS === "object"
                ? new Date(
                    details.mLastUsageTS.xint64 * 1000
                  ).toLocaleDateString()
                : "undefiend"
            ),
          ]),
          m(
            "button",
            {
              onclick: () =>
                widget.popupMessage(
                  m(EditIdentity, {
                    details: details,
                  })
                ),
            },
            "Edit"
          ),
          m(
            "button.red",
            {
              onclick: () =>
                widget.popupMessage(
                  m(DeleteIdentity, {
                    id: details.mId,
                    name: details.mNickname,
                  })
                ),
            },
            "Delete"
          ),
        ]
      ),
  };
};

const Layout = () => {
  let ownIds = [];
  return {
    oninit: () => people_util.ownIds((data) => (ownIds = data)),
    view: () =>
      m(".widget", [
        m("h3", "Own Identities", m("span.counter", ownIds.length)),
        m("hr"),

        m(
          "button",
          {
            onclick: () => widget.popupMessage(m(CreateIdentity, {})),
          },
          "New Identity"
        ),
        ownIds.map((id) =>
          m(Identity, {
            id,
          })
        ),
      ]),
  };
};

module.exports = Layout;
