# Web Interface for Retroshare

A web-based frontend for [Retroshare](https://github.com/Retroshare/Retroshare)
which communicates with the client through the JSON API.

## Requirements

- Retroshare v0.6.5+ with JSON API enabled(see instructions below)
- A modern JavaScript-enabled web browser
- [`qmake`](https://doc.qt.io/qt-5/qmake-manual.html)(optional)

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
   If you have `qmake` installed, you just need to run it in the base directory:

   ```bash
   qmake .
   ```

   If you do not have `qmake`, go to `webui-src/make-src/` and run the build
   script. Note that qmake is enough to do the build.

   ##### On Linux/MacOS:

   ```bash
   cd webui-src/make-src
   sh build.sh
   ```

   ##### On Windows:

   ```bash
   cd webui-src\make-src\
   ./build.bat
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

For contributing, It is recommended that you read this entire section to have a
better idea.

### Setup WebUI for contributing

Follow these steps to setup the project and make it ready for
contribution/customisation :

- Fork and Clone this repository to your local machine.
- `cd` into the cloned repo:
  ```
  cd RSNewWebUI
  ```
- Run this command to install the dependecies for the project.
  ```
  pnpm install
  ```

### Run the WebUI

- Run this command to watch for any changes in the `scss` files and compile them
  to css.

  ```
  pnpm watch
  ```

- You can now start to edit the source code. But you must run the below command
  to see the changes reflected in the browser everytime you edit the code for
  webui which is in the `webui-src/app/` directory.

  ```
  qmake .
  ```

### Linting and Formatting

Linting and formatting can be done with editor/IDE plugins.

Or to do it manually,

Install `prettier` and `eslint` (required for linting & formatting code):

```sh
npm install -g prettier eslint
```

Next, run the following in the `webui-src` directory:

To run the linter: `eslint app`

To run the formatter: `prettier -c app`

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
