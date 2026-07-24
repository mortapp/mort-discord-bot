#!/usr/bin/env bash
set -e
pkg update
pkg install -y nodejs git
npm config set registry https://registry.npmjs.org/
npm install
npm run doctor
npm run register
npm start
