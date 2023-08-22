#!/bin/bash

# create webfiles from sources at compile time (works without npm/node.js)

echo "### Starting WebUI build ###"

src=$(readlink -f $(dirname $0))/../../webui-src

if [ "$1" = "" ]; then
	publicdest=$(readlink -f $(dirname $0))/../../webui
else
	publicdest=$1/webui
fi

if [ "$2" = "" ]; then
	if [ -d "$publicdest" ]; then
		echo removing existing $publicdest
		rm $publicdest -R
	fi
fi

if [ ! -d  "$publicdest" ]; then
	echo creating $publicdest
	mkdir $publicdest
fi

# For using recursive directory search(requires bash v4+)
shopt -s globstar

if [ "$2" = "" ]||[ "$2" = "index.html" ]; then
	echo copying html file
    cp -r $src/index.html $publicdest/
fi

if [ "$2" = "" ]||[ "$2" = "styles.css" ]; then
	echo copying css file
	cp $src/styles.css $publicdest/
fi

if [ "$2" = "" ]||[ "$2" = "app.js" ]; then
	echo building app.js:
	echo - copying template.js ...
	cp $src/make-src/template.js $publicdest/app.js

        js_source=$src/app/
	for filename in $src/app/**/*.js; do
                fname="${filename#$js_source}"
		fname="${fname%.*}"
		echo - adding $fname ...
		echo require.register\(\"$fname\", function\(exports, require, module\) { >> $publicdest/app.js
		cat $filename >> $publicdest/app.js
		echo >> $publicdest/app.js
		echo }\)\; >> $publicdest/app.js
	done
fi

echo copying assets folder
cp -r $src/assets/* $publicdest/

if [ "$2" != "" ]&&[ "$3" != "" ]; then
	if [ ! -d "$3/webui" ]; then
		echo creating $3/webui
		mkdir $3/webui
	fi
	echo copying $2 nach $3/webui/$2
	cp $publicdest/$2 $3/webui/$2
fi
echo "### WebUI build complete ###"
