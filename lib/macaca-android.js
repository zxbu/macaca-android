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

const path = require('path');
const _ = require('./helper');
const EOL = require('os').EOL;
const JAVA = require('java-util');
const ADB = require('macaca-adb');
const UnlockApk = require('unlock-apk');
const DriverBase = require('driver-base');
const controllers = require('./controllers');
const UIAutomator = require('uiautomator-client');
const ChromeDriver = require('macaca-chromedriver');

const WEBVIEW = 'WEBVIEW';

class Android extends DriverBase {
  constructor() {
    super();
    this.adb = null;
    this.apkInfo = null;
    this.args = null;
    this.chromedriver = null;
    this.chromeDriverPort = null;
    this.proxy = null;
    this.udid = null;
    this.uiautomator = null;
    this.webviews = [];
  }
}

Android.prototype.startDevice = function *(caps) {
  this.args = _.clone(caps);
  yield JAVA.getVersion();
  this.initAdb();
  yield this.initDevice();
  yield this.getApkInfo();
  yield this.initUiautomator();
  yield this.adb.install(UnlockApk.apkPath);
  yield this.unlock();
  yield this.launchApk();
  yield this.waitActivityReady();
};

Android.prototype.stopDevice = function *() {
};

Android.prototype.isProxy = function() {
  return !!this.proxy;
};

Android.prototype.whiteList = function(context) {
  var basename = path.basename(context.url);
  const whiteList = ['context', 'contexts', 'screenshot'];
  return !!~whiteList.indexOf(basename);
};

Android.prototype.waitActivityReady = function *() {

  yield this.adb.waitActivityReady(this.apkInfo.package, this.apkInfo.activity);

  yield _.sleep(3000);

  yield this.send({
    cmd: 'wake',
    args: {}
  });
  yield _.sleep(3000);
};

Android.prototype.initAdb = function() {
  this.adb = new ADB();
};

Android.prototype.initUiautomator = function *() {
  this.uiautomator = new UIAutomator();
  yield this.uiautomator.init(this.adb);
};

Android.prototype.initDevice = function *() {
  var devices = yield ADB.getDevices();

  if (devices.length) {
    var device = devices[0];
    this.adb.setDeviceId(device.udid);
    this.udid = device.udid;
  } else {
    console.log('no device');
  }
};

Android.prototype.getApkInfo = function *() {
  this.apkInfo = yield ADB.getApkMainifest(this.args.app);
};

Android.prototype.unlock = function *() {
  var isScreenLocked = yield this.adb.isScreenLocked();

  if (isScreenLocked) {
    yield this.adb.startApp(UnlockApk);
    yield _.sleep(5000);
    yield this.unlock();
  }
};

Android.prototype.launchApk = function *() {
  var isInstalled = yield this.adb.isInstalled(this.apkInfo.package);

  if (!isInstalled) {
    yield this.adb.install(this.args.app);
  }
  yield this.adb.startApp(this.apkInfo);
  yield _.sleep(5000);
};

Android.prototype.getWebviews = function *() {
  var webviews = [];
  var pids = [];
  const WEBVIEW_DEVTOOLS = 'webview_devtools_remote_';
  const dumpNet = yield this.adb.shell(`cat /proc/net/unix | grep ${WEBVIEW_DEVTOOLS}`);
  dumpNet.split(EOL).forEach(line => {
    pids.push(line.trim().split(WEBVIEW_DEVTOOLS)[1]);
  });

  pids = _.uniq(pids);

  if (pids.length) {
    const dumpProcess = yield this.adb.shell('ps');

    pids.forEach(pid => {
      dumpProcess.split(EOL).forEach(line => {
        let temp = line.trim().split(/\s+/);
        if (temp[1] === pid) {
          webviews.push(`${WEBVIEW}_${temp[temp.length - 1]}`);
        }
      });
    });
  }
  return webviews;
};

Android.prototype.initChromeDriver = function() {
  return new Promise((resolve, reject) => {
    this.chromedriver = new ChromeDriver();
    this.chromedriver.on(ChromeDriver.EVENT_READY, data => {
      console.log(`chromedriver ready with: ${JSON.stringify(data)}`);
      resolve('');
    });
    this.chromedriver.start({
      chromeOptions: {
        androidPackage: this.apkInfo.package,
        androidUseRunningApp: true,
        androidDeviceSerial: this.udid
      }
    });
  });
};

Android.prototype.send = function *(data) {
  return yield this.uiautomator.send(data);
};

_.extend(Android.prototype, controllers);

module.exports = Android;
