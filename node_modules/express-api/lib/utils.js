'use strict';

var endsWith = exports.endsWith = function endsWith(S, suffix) {
  var l  = S.length - suffix.length;
  return l >= 0 && S.indexOf(suffix, l) === l;
};

exports.chompRight = function chompRight(S, suffix) {
  if (endsWith(S, suffix)) {
    S = S.slice(0, S.length - suffix.length);
  }
  return S;
};
