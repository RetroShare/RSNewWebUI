# ------------------------------------------------------------------------ *\
# CMakeLists.txt
# This file is part of RetroShare-WebUI
#
# Copyright (C) 2026      David Bears <dbear4q@gmail.com>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
# ------------------------------------------------------------------------ */

# 3.12: list(TRANSFORM)
cmake_minimum_required(VERSION 3.12...4.4)

project(retroshare-webui
	LANGUAGES NONE
)

set(WEBUI_SRC_DIR "${CMAKE_CURRENT_SOURCE_DIR}/webui-src" CACHE PATH
	"WebUI source directory"
)
set(WEBUI_BUILD_DIR "${CMAKE_CURRENT_BINARY_DIR}/webui" CACHE PATH
	"WebUI build directory"
)
set(WEBUI_INSTALL_DIR "share/retroshare/webui" CACHE PATH
	"WebUI install directory"
)

add_custom_target(${PROJECT_NAME} ALL)


# copy files verbatim from source to build
function(cp src dst)
	string(REPLACE / _ tgt WebUI_${dst})
	cmake_path(GET dst PARENT_PATH install_dst)
	set(dst_rel ${dst})
	set(src_rel ${src})
	cmake_path(ABSOLUTE_PATH src BASE_DIRECTORY ${WEBUI_SRC_DIR})
	cmake_path(ABSOLUTE_PATH dst BASE_DIRECTORY ${WEBUI_BUILD_DIR})
	if(CMAKE_VERSION VERSION_GREATER_EQUAL 4.2)
		set(_if_newer _if_newer)
	else()
		set(_if_newer)
	endif()
	if(IS_DIRECTORY ${src})
		set(cmd copy_directory${_if_newer})
		file(GLOB_RECURSE files CONFIGURE_DEPENDS FOLLOW_SYMLINKS RELATIVE ${src} ${src}/*)
		list(TRANSFORM files PREPEND ${src}/ OUTPUT_VARIABLE dep)
		list(TRANSFORM files PREPEND ${dst}/ OUTPUT_VARIABLE out)
		set(install_type DIRECTORY)
	else()
		set(cmd copy${_if_newer})
		set(dep ${src})
		set(out ${dst})
		set(install_type FILES)
	endif()
	add_custom_command(
		OUTPUT ${out}
		COMMAND ${CMAKE_COMMAND} -E ${cmd} ${src} ${dst}
		DEPENDS ${dep}
		COMMENT "Generating ${dst_rel}"
	)
	add_custom_target(${tgt} DEPENDS ${out})
	add_dependencies(${PROJECT_NAME} ${tgt})
	install(${install_type} ${dst}
		DESTINATION ${WEBUI_INSTALL_DIR}/${install_dst}
	)
endfunction()
cp(index.html index.html)
cp(styles.css styles.css)
cp(assets/images images)
cp(assets/webfonts webfonts)


# build app.js
file(GLOB_RECURSE app.js-sources ${WEBUI_SRC_DIR}/app/*.js)
add_custom_command(
	OUTPUT ${WEBUI_BUILD_DIR}/app.js
	COMMAND ${CMAKE_COMMAND}
		-DOUTPUT=${WEBUI_BUILD_DIR}/app.js
		-DTEMPLATE=${WEBUI_SRC_DIR}/make-src/template.js
		-DBASEDIR=${WEBUI_SRC_DIR}/app
		-P ${PROJECT_SOURCE_DIR}/mk/build-app.cmake
		--
		# $<TARGET_PROPERTY:app.js,SOURCES>
		${app.js-sources}
	DEPENDS
		${PROJECT_SOURCE_DIR}/mk/build-app.cmake
		${WEBUI_SRC_DIR}/make-src/template.js
		# $<TARGET_PROPERTY:app.js,SOURCES>
		${app.js-sources}
	COMMENT "Generating app.js"
)
add_custom_target(WebUI_app.js
	DEPENDS ${WEBUI_BUILD_DIR}/app.js
	SOURCES ${app.js-sources}
)
add_dependencies(${PROJECT_NAME} WebUI_app.js)
install(FILES ${WEBUI_BUILD_DIR}/app.js DESTINATION ${WEBUI_INSTALL_DIR})
