#!/usr/bin/env bash
set -e
npm config set registry https://registry.npmjs.org/
npm install
npm run doctor
npm run register
npm install -g pm2
pm2 start src/index.js --name mort
pm2 save
pm2 status
