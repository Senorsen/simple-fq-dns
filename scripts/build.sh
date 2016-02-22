#!/bin/sh

set -e

APP_PATH=$(dirname $0)
rm -rf $APP_PATH/../dist
babel -d $APP_PATH/../dist $APP_PATH/../src

