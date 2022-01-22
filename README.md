Web Interface for Retroshare
============================

A web-based frontend for [Retroshare](https://github.com/Retroshare/Retroshare). Communicates with the client through the JSON API.

Requirements
------------
* Retroshare v0.6.5+ with JSON API enabled(see instructions below)
* A modern JavaScript-enabled web browser
* [`qmake`](https://doc.qt.io/qt-5/qmake-manual.html)(optional)

Installation
------------
The web interface will be shipped by default in the next release of Retroshare once it gets merged. Until then, it needs to be installed separately.

### Install WebUI
First, you need to download and install the web interface 
javascript code itself:
1. Clone the repo:
You can clone using git, or download the zip file and extract it
```bash
git clone https://github.com/Retroshare/RSNewWebUI
cd RSNewWebUI
```

2. Build the files:
If you have `qmake` installed, you just need to run it in the base directory:
```bash
qmake .
```
If you do not have `qmake`, go to `webui-src/make-src/` and run the build script.
Note that qmake is enough to do the build.

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
If Retroshare needs to be compiled with non-default options as follows:

```bash
qmake CONFIG="debug rs_jsonapi rs_webui"
make
```
See the [Retroshare repo](https://github.com/Retroshare/Retroshare) for more detailed instructions.
You should afterwards see a tab 'JSON API' and
a tab 'Web Interface' in the Preferences. 

### Enable JSON API
You need to enable the JSON API, through which the web interface communicates with the client:

1. Open Retroshare, go to `Preferences > JSON API`.
2. Make sure the `Enable Retroshare JSON API Server` box is checked.

### Enable Web Interface

1. Go to `Preferences > Webinterface`.
2. Make sure the `Enable Retroshare WEB Interface` box is checked.
3. Enter a password to protect access to the web interface. 

If necessary, point the "Web interface directory" to the place where the webui files are 
compiled. This is usually RSNewWebUI/webui/

In any case, clock on "Apply settings" after editing this page.
If everything goes ok, you should see a new token "webui:[your password]" in the 
JSonAPI page.



Usage
-----
Open your browser to `localhost:9092/index.html`. Note that if you changed the port in the JSonAPI preferences pages, the port in this line needs to be changed accordingly.

The Web interface is only accessible from localhost (127.0.0.1). If you want to access the
web interface of a headless retroshare server, then you need to create a SSH tunnel as follows:
```
ssh login@server -L 9092:localhost:9092 -N
```

After that, the webinterface of the Retroshare running on 'server' is tunneled to your local machine and accessible through localhost:9092.

Running a headless retroshare server is one possibility. The webinterface howeverdoes not allow you to create new nodes. Therefore the steps are:

1. Create a node using the standard Qt UI. That can be done in another machine.
2. Copy the retroshare data directory (.retroshare/ on linux) on the server.
3. On the server, launch a headless retroshare using that node:
```
./retroshare-service/src/retroshare-service -U list -W
```
and follow instructions to launch your profile (you need to choose a webui passord and enter
the ID and login passord of your node).

References
----------
* [mithril](https://mithril.js.org/hyperscript.html)
* list files with @jsonapi in libretroshare/src/retroshare of [retroshare](https://github.com/RetroShare/RetroShare): `grep -c "@jsonapi" *.h|grep -v ":0"`

Contributing
------------
### Preparing code
Install `prettier` and `eslint` (required for linting & formatting code):
```sh
npm install -g prettier eslint
```
Next, run the following in the `webui-src` directory:

To run the linter: `eslint app`

To run the formatter: `prettier -c app`

Linting and formatting can also be done with editor/IDE plugins.

### Bug Reports & Feature requests
Please create an [issue](https://github.com/Retroshare/RsNewWebUI/issues) concisely describing the bug you faced, or the feature you would like to see implemented.

### Development
Whether you are a JavaScript developer or a web designer, you can help make the web interface better. Get in touch with us on the Developer forums in Retroshare.
