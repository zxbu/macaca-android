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

const macacaUtils = require('macaca-utils');

var _ = macacaUtils.merge({}, macacaUtils);

_.sleep = function(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
};

module.exports = _;
