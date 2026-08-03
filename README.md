# RetroShare Web Interface

This project is the browser interface for
[RetroShare](https://github.com/RetroShare/RetroShare). It talks to RetroShare
through its JSON API.

Recent RetroShare releases already include this interface. Follow this guide if
you want to build it yourself, change it, or contribute to it.

## What you need

- RetroShare 0.6.5 or newer, with the JSON API enabled
- A modern web browser

## Set up RetroShare

### Enable the JSON API

1. Open RetroShare.
2. Go to **Preferences > JSON API**.
3. Enable **RetroShare JSON API Server**.

### Enable the Web Interface

1. Go to **Preferences > Web Interface**.
2. Enable the Web Interface.
3. Choose a password.
4. Set **Web interface directory** to this repository's `webui/` directory if
   RetroShare does not find it automatically.
5. Click **Apply**.

The JSON API page should now show an authenticated token named
`webui:<your password>`.

## Open the interface

Open [https://localhost:9092/index.html](https://localhost:9092/index.html) in
your browser. If you changed the JSON API port, replace `9092` with that port.

### Connect to a remote or headless server

The Web Interface listens on localhost by default. To reach RetroShare on a
remote server, run this command on your local computer:

```sh
ssh -L 9092:localhost:9092 -N login@server
```

Keep that command running, then open
[https://localhost:9092/index.html](https://localhost:9092/index.html).

The Web Interface cannot create a new RetroShare node. Create the node with the
desktop interface first, then copy its RetroShare data directory to the server.
On Linux this directory is usually `.retroshare/`.

Start the service on the server with:

```sh
./retroshare-service/src/retroshare-service -U list -W
```

Follow the prompts to select the profile and enter its passwords.

## Contributing

To work on the source, you need:

- Node.js 24 or newer and npm
- `sh` on macOS or Linux; Windows uses the included batch file
- `qmake` only if you want to use RetroShare's qmake build integration

### First-time setup

Fork the repository, clone your fork, and install the locked dependencies:

```sh
git clone https://github.com/YOUR-USERNAME/RSNewWebUI.git
cd RSNewWebUI/webui-src
npm ci
```

### Where to make changes

- JavaScript source is in `webui-src/app/`.
- SCSS source is in `webui-src/app/scss/`.
- `webui-src/styles.css` is generated from `app/scss/main.scss`. Do not edit it
  by hand, but commit it with the SCSS changes that generated it.
- Everything in `webui/` is build output. Do not edit those files by hand.
- `webui-src/app/mithril.js` contains Mithril 2.3.8. Change it only when
  intentionally upgrading Mithril.

### Normal development commands

Run these commands from `webui-src/`:

```sh
npm run build
npm run lint
```

`npm run build` compiles the SCSS and creates the complete `webui/` directory.
It automatically uses `build.bat` on Windows and `build.sh` on macOS or Linux.

`npm run lint` checks the source files and does not require `webui/` to exist.

To rebuild CSS whenever an SCSS file changes, run:

```sh
npm run watch
```

Watch mode updates `webui-src/styles.css` only. Run `npm run build` when you
also need to update the files in `webui/`.

### Using qmake during development

Run qmake from the repository root:

```sh
qmake .
```

qmake copies the committed `webui-src/styles.css`; it does not compile SCSS.
After changing SCSS, run `npm run build` first. Rerun `qmake .` when you need
qmake to package newer WebUI files; `make` alone does not do that for this
project.

A standalone checkout may show a warning about a missing `../retroshare.pri`.
The WebUI files are still generated.

### Building without npm or qmake

These commands create `webui/` from the files already stored in the repository.
They do not compile SCSS.

From the repository root on macOS or Linux:

```sh
sh webui-src/make-src/build.sh
```

From the repository root on Windows:

```bat
webui-src\make-src\build.bat
```

### Optional focused builds

The normal `npm run build` command is the easiest choice. On macOS or Linux,
you can rebuild only one generated file from `webui-src/`:

```sh
# JavaScript only
sh make-src/build.sh "" app.js

# HTML only
sh make-src/build.sh "" index.html

# CSS only
./node_modules/.bin/sass --no-source-map --style=compressed app/scss/main.scss styles.css
sh make-src/build.sh "" styles.css
```

### Before opening a pull request

1. Run `npm run build`.
2. Run `npm run lint`.
3. Point RetroShare's **Web interface directory** to this repository's
   `webui/` directory.
4. Manually test the screens you changed.
5. If you changed SCSS, include the regenerated `webui-src/styles.css`.

There is no separate formatting command.

### Building older RetroShare versions

If you are testing with an older RetroShare version, you may need to build it
with the JSON API and WebUI enabled:

```sh
qmake CONFIG+="debug rs_jsonapi rs_webui"
make
```

See the [RetroShare repository](https://github.com/RetroShare/RetroShare) for
complete build instructions. After building, RetroShare preferences should
contain both **JSON API** and **Web Interface** pages.

### Useful references

- [Mithril documentation](https://mithril.js.org/)
- [RetroShare source](https://github.com/RetroShare/RetroShare)

To find RetroShare headers that expose JSON API methods, run this from
`libretroshare/src/retroshare/` in the RetroShare source tree:

```sh
grep -c "@jsonapi" *.h | grep -v ":0"
```

## Get help or report a problem

Open a [GitHub issue](https://github.com/RetroShare/RSNewWebUI/issues) and
briefly explain what happened, what you expected, and how someone can reproduce
it. You can also join the RetroShare developer forums to discuss development.
