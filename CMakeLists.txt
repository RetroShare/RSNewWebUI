# RetroShare decentralized communication platform
#
# Copyright (C) 2022  Gioacchino Mazzurco <gio@retroshare.cc>
# Copyright (C) 2022  Asociación Civil Altermundi <info@altermundi.net>
#
# SPDX-License-Identifier: CC0-1.0

cmake_minimum_required (VERSION 3.18.0)
project(retroshare-webui)

set(
	RS_DATA_DIR
	"${CMAKE_INSTALL_PREFIX}/share/retroshare"
	CACHE PATH
	"Path where to install RetroShare system wide data" )

option(
	RS_DEVELOPMENT_BUILD
	"Enable verbose build log. Userful just for development purposes."
	ON )

if(RS_DEVELOPMENT_BUILD)
	set(CMAKE_VERBOSE_MAKEFILE ON)
	set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
endif(RS_DEVELOPMENT_BUILD)

set(WEBUI_SRC_DIR "${CMAKE_CURRENT_SOURCE_DIR}/webui-src")
set(WEBUI_BUILD_DIR "${CMAKE_CURRENT_SOURCE_DIR}/webui")

if(UNIX)
	add_custom_target(
		${PROJECT_NAME} ALL
		COMMAND ./build.sh
		WORKING_DIRECTORY "${WEBUI_SRC_DIR}/make-src"
		COMMENT "Compiling RetroShare WebUI"
		SOURCES "${WEBUI_SRC_DIR}" )

	install(DIRECTORY "${WEBUI_BUILD_DIR}" DESTINATION "${RS_DATA_DIR}")
endif(UNIX)

# TODO: Windows build/install
