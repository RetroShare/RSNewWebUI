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
	if(CMAKE_VERSION VERSION_GREATER_EQUAL 3.20)
		cmake_path(IS_RELATIVE dst isrel)
		if(NOT isrel)
			message(SEND_ERROR "copy destination name must be relative: ${dst}")
		endif()
	endif()
	string(REPLACE / _ tgt WebUI_${dst})
	if(CMAKE_VERSION VERSION_GREATER_EQUAL 3.20)
		cmake_path(ABSOLUTE_PATH src
			BASE_DIRECTORY ${WEBUI_SRC_DIR}
			OUTPUT_VARIABLE src_source
		)
		cmake_path(ABSOLUTE_PATH dst
			BASE_DIRECTORY ${WEBUI_BUILD_DIR}
			OUTPUT_VARIABLE dst_build
		)
		cmake_path(ABSOLUTE_PATH dst
			BASE_DIRECTORY ${WEBUI_INSTALL_DIR}
			OUTPUT_VARIABLE dst_install
		)
		cmake_path(GET dst_install PARENT_PATH dst_install_dir)
	else()
		get_filename_component(src_source ${src} ABSOLUTE
			BASE_DIR ${WEBUI_SRC_DIR}
		)
		get_filename_component(dst_build ${dst} ABSOLUTE
			BASE_DIR ${WEBUI_BUILD_DIR}
		)
		get_filename_component(dst_install ${dst} ABSOLUTE
			BASE_DIR ${WEBUI_INSTALL_DIR}
		)
		get_filename_component(dst_install_dir ${dst_install} DIRECTORY)
	endif()
	if(CMAKE_VERSION VERSION_GREATER_EQUAL 4.2)
		set(_if_newer _if_newer)
	else()
		set(_if_newer)
	endif()
	if(IS_DIRECTORY ${src_source})
		set(cmd copy_directory${_if_newer})
		file(GLOB_RECURSE files
			CONFIGURE_DEPENDS
			FOLLOW_SYMLINKS
			RELATIVE ${src_source}
			${src_source}/*
		)
		list(TRANSFORM files PREPEND ${src_source}/ OUTPUT_VARIABLE depends)
		list(TRANSFORM files PREPEND ${dst_build}/ OUTPUT_VARIABLE output)
		set(install_type DIRECTORY)
	else()
		set(cmd copy${_if_newer})
		set(depends ${src_source})
		set(output ${dst_build})
		set(install_type FILES)
	endif()
	add_custom_command(
		OUTPUT ${output}
		COMMAND ${CMAKE_COMMAND} -E ${cmd} ${src_source} ${dst_build}
		DEPENDS ${depends}
		COMMENT "Generating ${dst}"
	)
	add_custom_target(${tgt} DEPENDS ${output})
	add_dependencies(${PROJECT_NAME} ${tgt})
	install(${install_type} ${dst_build}
		DESTINATION ${dst_install_dir}
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
