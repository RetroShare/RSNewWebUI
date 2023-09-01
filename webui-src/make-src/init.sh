#!/usr/bin/env sh

# create dummy webfiles at qmake run

if [ "$1" = "" ];then
	publicdest=../../webui
else
	publicdest=$1/webui
fi

if [ -d "$publicdest" ]; then
	echo removing $publicdest
	rm $publicdest -R
fi

echo creating $publicdest
mkdir $publicdest

echo creating $publicdest/app.js, $publicdest/styles.css, $publicdest/index.html
touch $publicdest/app.js -d 1970-01-01
touch $publicdest/styles.css -d 1970-01-01
touch $publicdest/index.html -d 1970-01-01
