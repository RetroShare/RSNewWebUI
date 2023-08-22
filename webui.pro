################################################################################
# Copyright (C) 2018, Retroshare team <retroshare.team@gmailcom>               #
#                                                                              #
# This program is free software: you can redistribute it and/or modify         #
# it under the terms of the GNU Affero General Public License as               #
# published by the Free Software Foundation, either version 3 of the           #
# License, or (at your option) any later version.                              #
#                                                                              #
# This program is distributed in the hope that it will be useful,              #
# but WITHOUT ANY WARRANTY; without even the implied warranty of               #
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the                #
# GNU Affero General Public License for more details.                          #
#                                                                              #
# You should have received a copy of the GNU Affero General Public License     #
# along with this program.  If not, see <https://www.gnu.org/licenses/>.       #
################################################################################

!include("../retroshare.pri"): warning("Could not include file retroshare.pri")

TEMPLATE = subdirs
SUBDIRS= # don't build anything
CONFIG -= qt

WEBUI_SRC_HTML  += $$PWD/webui-src/index.html

WEBUI_SRC_JS = $$PWD/webui-src/app/rswebui.js
WEBUI_SRC_JS += $$PWD/webui-src/app/mithril.js
WEBUI_SRC_JS += $$PWD/webui-src/app/login.js
WEBUI_SRC_JS += $$PWD/webui-src/app/main.js
WEBUI_SRC_JS += $$PWD/webui-src/app/home.js

WEBUI_SRC_CSS += $$PWD/webui-src/styles.css

WEBUI_SRC_DATA += $$PWD/data/retroshare.svg

win32-g++ {
    isEmpty(QMAKE_SH) {
        # Windows native build
        WEBUI_SRC_SCRIPT = $$PWD/webui-src/make-src/build.bat
    } else {
        # MSYS2 build
        WEBUI_SRC_SCRIPT = $$PWD/webui-src/make-src/build.sh
    }

    OUTPUT_DIR = $$shadowed($$PWD)
    OUTPUT_WEBUI_DIR = $${OUTPUT_DIR}/webui

    WEBUI_SRC_HTML += $$WEBUI_SRC_SCRIPT

    # Use all input files as depends
    create_webfiles.depends = $$WEBUI_SRC_HTML $$WEBUI_SRC_JS $$WEBUI_SRC_CSS
    # Use one generated output file as target
    create_webfiles.target = $${OUTPUT_WEBUI_DIR}/app.js
    # The batch file creates all output files at once
    create_webfiles.commands = $$shell_path($$WEBUI_SRC_SCRIPT) $$shell_path($$OUTPUT_DIR)

    QMAKE_EXTRA_TARGETS += create_webfiles
    ALL_DEPS += $${create_webfiles.target}

    # Clean output folder
    clean_webfiles.target = clean_webfiles
    isEmpty(QMAKE_SH) {
        # Windows native build
        clean_webfiles.commands = if exist $$system_path($$OUTPUT_WEBUI_DIR) $(DEL_DIR) /S /Q $$system_path($$OUTPUT_WEBUI_DIR)
    } else {
        # MSYS2 build
        clean_webfiles.commands = rm -rf $$system_path($${OUTPUT_WEBUI_DIR})
    }

    QMAKE_EXTRA_TARGETS += clean_webfiles
    CLEAN_DEPS += clean_webfiles
} else {
    # create dummy files, we need it to include files on first try

    system(webui-src/make-src/build.sh .)

    WEBUI_SRC_SCRIPT = webui-src/make-src/build.sh

    WEBUI_SRC_HTML += $$WEBUI_SRC_SCRIPT

    create_webfiles_html.output = webui/index.html
    create_webfiles_html.input = WEBUI_SRC_HTML
    create_webfiles_html.commands = sh $$_PRO_FILE_PWD_/webui-src/make-src/build.sh $$_PRO_FILE_PWD_ index.html .
    create_webfiles_html.variable_out = JUNK
    create_webfiles_html.CONFIG = combine no_link

    create_webfiles_js.output = webui/app.js
    create_webfiles_js.input = WEBUI_SRC_JS
    create_webfiles_js.commands = sh $$_PRO_FILE_PWD_/webui-src/make-src/build.sh $$_PRO_FILE_PWD_ app.js .
    create_webfiles_js.variable_out = JUNK
    create_webfiles_js.CONFIG = combine no_link

    create_webfiles_css.output = webui/styles.css
    create_webfiles_css.input = WEBUI_SRC_CSS
    create_webfiles_css.commands = sh $$_PRO_FILE_PWD_/webui-src/make-src/build.sh $$_PRO_FILE_PWD_ styles.css .
    create_webfiles_css.variable_out = JUNK
    create_webfiles_css.CONFIG = combine no_link

    QMAKE_EXTRA_COMPILERS += create_webfiles_html create_webfiles_js create_webfiles_css

    webui_base_files.path  = "$${RS_DATA_DIR}/webui/"
    webui_base_files.files = webui/index.html \
                             webui/styles.css \
                             webui/app.js

    webui_data_files.path  = "$${RS_DATA_DIR}/webui/data/"
    webui_data_files.files = webui/data/retroshare.svg \
                             webui/data/streaming.png

    webui_font_files.path  = "$${RS_DATA_DIR}/webui/webfonts/"
    webui_font_files.files = webui/webfonts/fa-solid-900.eot \
                             webui/webfonts/fa-solid-900.svg \
                             webui/webfonts/fa-solid-900.ttf \
                             webui/webfonts/fa-solid-900.woff \
                             webui/webfonts/fa-solid-900.woff2

    INSTALLS += webui_base_files webui_font_files webui_data_files
}
