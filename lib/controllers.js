'use strict';

const fs = require('fs');
const temp = require('temp');
const ADB = require('macaca-adb');
const xml2map = require('xml2map');
const errors = require('webdriver-dfn-error-code').errors;

const _ = require('./helper');
const keyMap = require('./key-map');
const pkg = require('../package.json');

const NATIVE = 'NATIVE_APP';

var controllers = {};

controllers.isWebContext = function() {
  return this.context && this.context !== NATIVE;
};

controllers.getContext = function * () {
  return this.context;
};

controllers.getContexts = function * () {
  const contexts = [NATIVE].concat(yield this.getWebviews());
  this.contexts = contexts;
  return contexts;
};

controllers.setContext = function * (name) {
  if (name !== NATIVE) {
    yield this.getContexts();
    if (!~this.contexts.indexOf(name)) {
      throw new errors.NoSuchWindow();
    }
    const result = yield this.proxy.sendCommand('/wd/hub/session/:sessionId/window', 'POST', {
      name: name
    });
    _.parseWebDriverResult(result);
  } else {
    this.proxy = this.uiautomator;
  }
  this.context = name;
};

controllers.getScreenshot = function * () {
  const swapFilePath = temp.path({
    prefix: `${pkg.name}-screenshot`,
    suffix: '.png'
  });

  const remoteFile = `${ADB.ANDROID_TMP_DIR}/screenshot.png`;
  const cmd = `/system/bin/rm ${remoteFile}; /system/bin/screencap -p ${remoteFile}`;
  yield this.adb.shell(cmd);

  yield this.adb.pull(remoteFile, swapFilePath);

  var base64 = null;

  try {
    let data = fs.readFileSync(swapFilePath);
    base64 = new Buffer(data).toString('base64');
  } catch (e) {
    throw new errors.NoSuchWindow();
  }

  _.rimraf(swapFilePath);
  return base64;
};

controllers.get = function * (url) {
  const cmd = `am start -a android.intent.action.VIEW -d ${url}`;
  yield this.adb.shell(cmd);
  return null;
};

controllers.url = function * () {
  const result = yield this.proxyCommand('/wd/hub/session/:sessionId/url', 'get', null);
  return result.value;
};

controllers.back = function * () {
  yield this.adb.goBack();
  return null;
};

controllers.tap = function(action) {
  return this
    .proxyCommand('/wd/hub/session/:sessionId/touch/click', 'post', {
      element: action.element
    }).then(result => {
      return _.parseWebDriverResult(result);
    });
};

const isChinese = function (temp) {
  const re = /[\u4e00-\u9fa5]/g;
  return re.test(temp);
};

controllers.keys = function * (value) {
  value = value.join('');
  // chinese
  if (isChinese(value)) {
    var base64Value = Buffer.from(value).toString('base64');
    var content = `am broadcast -a ADB_INPUT_B64 --es msg ${base64Value}`;
    yield this.adb.shell(content);
  } else {
    var arrText = [];

    for (var i = 0; i < value.length; i++) {
      var key = value.charAt(i);

      const keyEvent = keyMap[key];

      if (keyEvent) {
        // update for situation like : xxdd\uE007
        // the enter will go before real content.
        if (arrText.length) {
          yield this.proxyCommand('/wd/hub/session/:sessionId/element/1/value', 'post', {
            value: [arrText.join('')]
          });
          arrText = [];
        }
        yield this.proxyCommand('/wd/hub/session/:sessionId/keys', 'post', {
          value: [keyEvent]
        });
      } else {
        arrText.push(key);
      }
    }
    if (arrText.length) {
      yield this.proxyCommand('/wd/hub/session/:sessionId/element/1/value', 'post', {
        value: [arrText.join('')]
      });
    }
  }


  return null;
};

controllers.getSource = function * () {

  if (!this.isWebContext()) {
    yield this.adb.shell(`touch ${ADB.ANDROID_TMP_DIR}/macaca-dump.xml`);
  }
  const result = yield this.proxyCommand('/wd/hub/session/:sessionId/source', 'get', null);
  var xml = result.value;

  if (this.isWebContext() || (!this.isWebContext() && this.chromedriver)) {
    return xml;
  }

  const hierarchy = xml2map.tojson(xml).hierarchy;

  // tojson: if 'node' has only one element, the property will become json object instead of JSONArray
  // for device under Android API 5.0, 'node' is always an single element, and hence need to be wrapped into array
  if (hierarchy.node && !_.isArray(hierarchy.node)) {
    hierarchy.node = [hierarchy.node];
  }

  var res = _.filter(hierarchy.node, i => i.package !== 'com.android.systemui');

  return JSON.stringify(res && res[0] || []);
};

controllers.title = function * () {

  if (!this.isWebContext()) {
    const focusedActivity = yield this.adb.getFocusedActivity();
    return focusedActivity;
  }
  const result = yield this.proxyCommand('/wd/hub/session/:sessionId/title', 'get', null);
  return result.value;
};

module.exports = controllers;
