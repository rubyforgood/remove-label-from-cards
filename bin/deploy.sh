#!/bin/bash

if [ "$#" != "1" ]
then
	echo "USAGE: $0 <commit-message>"
	exit
fi

git add -A
git commit -m "$@"
git push origin main
git tag -d v1
git tag -a -m "Release version" v1
git push --delete origin v1
git push origin v1

