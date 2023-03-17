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

TEMPLATE = app
CONFIG -= qt

# create dummy files, we need it to include files on first try

system(webui-src/make-src/build.sh .)

WEBUI_SRC_SCRIPT = webui-src/make-src/build.sh

WEBUI_SRC_HTML   = $$WEBUI_SRC_SCRIPT
WEBUI_SRC_HTML  += webui-src/assets/index.html

WEBUI_SRC_JS  = $$WEBUI_SRC_SCRIPT
WEBUI_SRC_JS += webui-src/app/rswebui.js
WEBUI_SRC_JS += webui-src/app/mithril.js
WEBUI_SRC_JS += webui-src/app/login.js
WEBUI_SRC_JS += webui-src/app/main.js
WEBUI_SRC_JS += webui-src/app/home.js

WEBUI_SRC_CSS  = $$WEBUI_SRC_SCRIPT
WEBUI_SRC_CSS += webui-src/app/green-black.scss
WEBUI_SRC_CSS += webui-src/app/_reset.scss
WEBUI_SRC_CSS += webui-src/app/_chat.sass
WEBUI_SRC_CSS += webui-src/app/main.sass

WEBUI_SRC_DATA += data/retroshare.svg

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

create_webfiles_css.output = webui/app.css
create_webfiles_css.input = WEBUI_SRC_CSS
create_webfiles_css.commands = sh $$_PRO_FILE_PWD_/webui-src/make-src/build.sh $$_PRO_FILE_PWD_ app.css .
create_webfiles_css.variable_out = JUNK
create_webfiles_css.CONFIG = combine no_link

QMAKE_EXTRA_COMPILERS += create_webfiles_html create_webfiles_js create_webfiles_css 

system(cp -r data webui/)

webui_css_files.path  = "$${RS_DATA_DIR}/webui/css/"
webui_css_files.files = webui/css/fontawesome.css \
                        webui/css/solid.css
                  
webui_base_files.path  = "$${RS_DATA_DIR}/webui/"
webui_base_files.files = webui/app.css \
                         webui/app.js \
                         webui/index.html 

webui_data_files.path  = "$${RS_DATA_DIR}/webui/data/"
webui_data_files.files = webui/data/retroshare.svg \
                         webui/data/streaming.png 

webui_font_files.path  = "$${RS_DATA_DIR}/webui/webfonts/"
webui_font_files.files = webui/webfonts/fa-solid-900.eot \
                         webui/webfonts/fa-solid-900.svg \
                         webui/webfonts/fa-solid-900.ttf \
                         webui/webfonts/fa-solid-900.woff \
                         webui/webfonts/fa-solid-900.woff2 

INSTALLS += webui_base_files webui_css_files webui_font_files webui_data_files 


