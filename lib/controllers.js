/* ================================================================
 * macaca-android by xdf(xudafeng[at]126.com)
 *
 * first created at : Sat Dec 26 2015 14:53:57 GMT+0800 (CST)
 *
 * ================================================================
 * Copyright  xdf
 *
 * Licensed under the MIT License
 * You may not use this file except in compliance with the License.
 *
 * ================================================================ */

'use strict';

const fs = require('fs');
const temp = require('temp');
const _ = require('./helper');
const pkg = require('../package.json');
const errors = require('webdriver-dfn-error-code').errors;

const WEBVIEW = 'WEBVIEW';
const NATIVE = 'NATIVE_APP';

var contollers = {};

contollers.getContext = function *() {
  return this.contexts[this.contexts.length - 1];
};

contollers.getContexts = function *() {
  var contexts = [NATIVE].concat(yield this.getWebviews());
  return contexts;
};

contollers.setContext = function *(name) {
  if (!!~name.indexOf(WEBVIEW)) {
    if (!this.chromedriver) {
      yield this.initChromeDriver();
      this.proxy = this.chromedriver;
    }
  } else {
    this.proxy = null;
    this.contexts.pop();
  }
  return null;
};

contollers.click = function *(elementId) {
  return yield this.send({
    cmd: 'click',
    args: {
      elementId: elementId
    }
  });
};

contollers.setValue = function *(elementId, value) {
  var args = {
    elementId: elementId,
    text: value.join('')
  };
  return yield this.send({
    cmd: 'setText',
    args: args
  });
};

contollers.getText = function *(elementId) {
  var args = {
    elementId: elementId
  };
  return yield this.send({
    cmd: 'getText',
    args: args
  });
};

contollers.findElement = function *(strategy, selector, elementId) {
  var args = {
    strategy: strategy,
    selector: selector,
    multiple: false
  };
  return yield this.send({
    cmd: 'find',
    args: args
  });
};

contollers.findElements = function *(strategy, selector, elementId) {
  var args = {
    strategy: strategy,
    selector: selector,
    multiple: true
  };
  return yield this.send({
    cmd: 'find',
    args: args
  });
};

contollers.getScreenshot = function *() {
  const swapFile = temp.openSync({
    prefix: `${pkg.name}-screenshot`,
    suffix: '.png'
  });
  const swapFilePath = swapFile.path;
  const remoteFile = `${this.adb.getTmpDir()}/screenshot.png`;
  const cmd = `/system/bin/rm ${remoteFile}; /system/bin/screencap -p ${remoteFile}`;
  yield this.adb.shell(cmd);

  _.rimraf(swapFilePath);

  yield this.adb.pull(remoteFile, swapFilePath);

  var base64 = null;

  try {
    let data = fs.readFileSync(swapFilePath);
    base64 = new Buffer(data).toString('base64');
  } catch (e) {
    throw errors.NoSuchWindow();
  }

  _.rimraf(swapFilePath);
  return base64;
};

module.exports = contollers;
