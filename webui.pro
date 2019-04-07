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

TEMPLATE = lib
CONFIG -= qt

linux-* {

   webui_files.path = "$${DATA_DIR}/webui"
	  webui_files.files = webui/app.js webui/app.css webui/index.html
	  INSTALLS += webui_files

	  webui_img_files.path = "$${DATA_DIR}/webui/img"
	  webui_img_files.files = ../retroshare-gui/src/gui/images/logo/logo_splash.png

	  INSTALLS += webui_img_files

	  # create dummy files, we need it to include files on first try

	  system(webui-src/make-src/build.sh .)

	  WEBUI_SRC_SCRIPT = webui-src/make-src/build.sh

	  WEBUI_SRC_HTML   = $$WEBUI_SRC_SCRIPT
	  WEBUI_SRC_HTML  += webui-src/app/assets/index.html

	  WEBUI_SRC_JS  = $$WEBUI_SRC_SCRIPT
	  WEBUI_SRC_JS += webui-src/app/rswebui.js
	  WEBUI_SRC_JS += webui-src/app/mithril.js
	  WEBUI_SRC_JS += webui-src/app/downloads.js
	  WEBUI_SRC_JS += webui-src/app/login.js

#	  WEBUI_SRC_JS += webui-src/app/peers.js
#	  WEBUI_SRC_JS += webui-src/app/main.js
#	  WEBUI_SRC_JS += webui-src/app/menudef.js
#	  WEBUI_SRC_JS += webui-src/app/menu.js
#	  WEBUI_SRC_JS += webui-src/app/retroshare.js
#	  WEBUI_SRC_JS += webui-src/app/accountselect.js
#	  WEBUI_SRC_JS += webui-src/app/adddownloads.js
#	  WEBUI_SRC_JS += webui-src/app/addidentity.js
#	  WEBUI_SRC_JS += webui-src/app/addpeer.js
#	  WEBUI_SRC_JS += webui-src/app/chat.js
#	  WEBUI_SRC_JS += webui-src/app/createlogin.js
#	  WEBUI_SRC_JS += webui-src/app/forums.js
#	  WEBUI_SRC_JS += webui-src/app/home.js
#	  WEBUI_SRC_JS += webui-src/app/identities.js
#	  WEBUI_SRC_JS += webui-src/app/search.js
#	  WEBUI_SRC_JS += webui-src/app/searchresult.js
#	  WEBUI_SRC_JS += webui-src/app/servicecontrol.js
#	  WEBUI_SRC_JS += webui-src/app/settings.js
#	  WEBUI_SRC_JS += webui-src/app/waiting.js

	  WEBUI_SRC_CSS  = $$WEBUI_SRC_SCRIPT
	  WEBUI_SRC_CSS += webui-src/app/green-black.scss
	  WEBUI_SRC_CSS += webui-src/app/_reset.scss
	  WEBUI_SRC_CSS += webui-src/app/_chat.sass
	  WEBUI_SRC_CSS += webui-src/app/main.sass


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
}

