# Web Interface for Retroshare

A web-based frontend for [Retroshare](https://github.com/Retroshare/Retroshare)
which communicates with the client through the JSON API.

## Requirements

- Retroshare v0.6.5+ with JSON API enabled(see instructions below)
- A modern JavaScript-enabled web browser
- Node.js 24 LTS or newer and npm when building from SCSS sources
- A POSIX-compatible `sh` on Linux or macOS
- [`qmake`](https://doc.qt.io/qt-5/qmake-manual.html) (optional packaging integration)

## Installation

> **Note:** The Web Interface is shipped by default in the latest release of
> Retroshare. If you want to customise it or [contribute](#contributing) to it
> then proceed with the following steps.

### Install WebUI

First, you need to download and install the web interface javascript code
itself:

1. **Clone the repo**:
   You can clone using git, or download the zip file and extract it

   ```bash
   git clone https://github.com/Retroshare/RSNewWebUI
   cd RSNewWebUI
   ```

2. **Build the files**:
   If you have `qmake` installed, you need to run this command from the repository root to build it:

   ```bash
   qmake .
   ```

   `qmake` packages the committed generated `webui-src/styles.css`. Without `qmake`, run the shell build script instead:

   ```bash
   sh webui-src/make-src/build.sh
   ```

   On Windows, use the batch script to bundle the checked-in generated files:

   ```bash
   webui-src\make-src\build.bat
   ```

### Compile Retroshare with JSON API

If you are on older versions of Retroshare then it needs to be compiled with
non-default options as follows:

```bash
qmake CONFIG+="debug rs_jsonapi rs_webui"
make
```

See the [RetroShare repo](https://github.com/Retroshare/Retroshare) for more
detailed instructions on compiling RetroShare. You should afterwards see a tab
'JSON API' and a tab 'Web Interface' in the **Preferences**.

### Enable JSON API

You need to enable the JSON API, through which the web interface communicates
with the client:

1. Open Retroshare, go to `Preferences > JSON API`.
2. Make sure the **Enable Retroshare JSON API Server** box is checked.

### Enable Web Interface

1. Go to `Preferences > Webinterface`.
2. Make sure the **Enable Retroshare WEB Interface** box is checked.
3. Enter a password to protect access to the web interface.

If necessary, point the **Web interface directory** to the place where the webui
files are compiled. This is usually `RSNewWebUI/webui/`.

In any case, click on "Apply settings" after making the changes. If everything
goes ok, you should see a new token `webui:[your password]` under the
**Authenticated Tokens** section in the **JSON API** preferences page.

## Usage

### Basic Usage

This is the default link to access the WebInterface.
<br>
Open this link your browser ->
[https://localhost:9092/index.html](https://localhost:9092/index.html).

> Note: If you changed the port in the JSON API preferences pages, the port
> in the above line needs to be changed accordingly.

### Advanced Usage

The Web interface is only accessible from localhost (127.0.0.1). If you want to
access the web interface of a headless retroshare server, then you need to
create a SSH tunnel as follows:

```
ssh login@server -L 9092:localhost:9092 -N
```

After that, the Web interface of the Retroshare running on 'server' is tunneled
to your local machine and accessible through localhost:9092.

Running a headless retroshare server is one possibility. The Webinterface
however does not allow you to create new nodes. Therefore the steps are:

1. Create a node using the standard Qt UI. That can be done in another machine.
2. Copy the retroshare data directory (.retroshare/ on linux) on the server.
3. On the server, launch a headless retroshare using that node:
   ```
    ./retroshare-service/src/retroshare-service -U list -W
   ```

After that follow instructions to launch your profile (you need to choose a
webui password and enter the ID and login password of your node).

## Contributing

### Setup

Development requires Node.js 24 or newer, npm, `sh` on macOS or Linux, and a
RetroShare instance with the JSON API and Web Interface enabled for manual
testing.

Fork and clone the repository, then install the locked dependencies:

```bash
cd RSNewWebUI/webui-src
npm ci
```

### Source and generated files

Edit files under `webui-src/app/`, including SCSS under
`webui-src/app/scss/`. Do not edit these generated files by hand:

- `webui-src/styles.css` is generated from `webui-src/app/scss/main.scss`.
- `webui/app.js`, `webui/styles.css`, and `webui/index.html` are build output.

`webui-src/app/mithril.js` is the vendored Mithril 2.3.8 runtime. Replace it
only during an intentional Mithril upgrade.

### Build and test

From `webui-src/`, compile SCSS and create the deployable `webui/` directory:

```bash
npm run build
npm run lint
```

These npm commands use `build.bat` on native Windows and `build.sh` on other
platforms.

Commit SCSS changes together with the regenerated `webui-src/styles.css`.
`qmake .` packages that committed CSS but does not compile SCSS. Running
`make` alone does not rebuild this `TEMPLATE = subdirs` project; rerun
`qmake .` from the repository root when using qmake.

The shell bundler works without Node.js, but only copies the existing CSS. Run
it from `webui-src/` with `sh`:

```bash
sh make-src/build.sh
```

For focused rebuilds, run these commands from `webui-src/`:

```bash
# JavaScript only
sh make-src/build.sh "" app.js

# HTML only
sh make-src/build.sh "" index.html

# Compile and copy CSS only
./node_modules/.bin/sass --no-source-map --style=compressed app/scss/main.scss styles.css
sh make-src/build.sh "" styles.css
```

`npm run watch` recompiles SCSS into `webui-src/styles.css`; it does not copy
the CSS into `webui/` or rebuild JavaScript. Use the CSS-only command above
when testing watched changes through RetroShare.

Before submitting, run the full build and lint commands, then point
RetroShare's **Web interface directory** at `webui/` and manually test the
affected screens. ESLint, generated JavaScript syntax, the build dispatcher,
and shell syntax on non-Windows systems are checked by `npm run lint`; no
formatting script is defined.

### References

Now, While contributing you can checkout these resources as you might need to
look up for these often.

- [mithril](https://mithril.js.org/hyperscript.html)
- You can list files with @jsonapi in libretroshare/src/retroshare of
  [retroshare](https://github.com/RetroShare/RetroShare):

  ```
  grep -c "@jsonapi" *.h|grep -v ":0"
  ```

<hr>

And, that's it. You are more than welcome to contribute to this project. If you
have any questions/difficulties in setting up or running the project, you can
raise an issue and we will be more than willing to help you out.

### Bug Reports & Feature requests

Please create an [issue](https://github.com/Retroshare/RsNewWebUI/issues)
concisely describing the bug you faced, or the feature you would like to see
implemented.

### Development

Whether you are a JavaScript developer or a Web designer, you can help make the
web interface better. Get in touch with us on the Developer forums in
Retroshare.
