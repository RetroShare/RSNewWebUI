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

### Compile Retroshare with JSON API
Go to the `Preferences` tab, if there is a section called `JSON API` then you can skip this step. Otherwise, you need to compile Retroshare with the JSON API.
To do so, use the `qmake` flag `rs_jsonapi`:
```bash
qmake CONFIG+="rs_jsonapi"
make
```
See the [Retroshare repo](https://github.com/Retroshare/Retroshare) for more detailed instructions.

### Enable JSON API
You need to enable the JSON API, through which the web interface communicates with the client:

1. Open Retroshare, go to `Preferences > JSON API`.
2. Check the `Enable Retroshare JSON API Server` box.
3. In the `Token` field, add a new token in the format: `login:password` and click Add.
4. Click Restart.

Next, you need to download and install the web interface itself:

### Install WebUI
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

##### On Linux/MacOS:
```bash
cd webui-src/make-src
sh build.sh
```

##### On Windows:
Execute the `build.bat` file in `webui-src\make-src\`.

Usage
-----
Go to `RsNewWebUI/webui/` and open the `index.html` file in your browser.

References
----------
* [mithril](https://mithril.js.org/hyperscript.html)
* list files with @jsonapi in libretroshare/src/retroshare of [retroshare](https://github.com/RetroShare/RetroShare): `grep -c "@jsonapi" *.h|grep -v ":0"`

Contributing
------------
### Bug Reports & Feature requests
Please create an [issue](https://github.com/Retroshare/RsNewWebUI/issues) concisely describing the bug you faced, or the feature you would like to see implemented.

### Development
Whether you are a JavaScript developer or a web designer, you can help make the web interface better. Get in touch with us on the Developer forums in Retroshare.
