const TextEncoding = require('text-encoding');

// Wrapper for nodejs/browser compat
(function (window, exports) {

// Public API
exports.unserialize = unserialize;
exports.unserializeSession = unserializeSession;


/**
 * Unserialize data taken from PHP's serialize() output
 *
 * Taken from https://github.com/kvz/phpjs/blob/master/functions/var/unserialize.js
 * Fixed window reference to make it nodejs-compatible
 *
 * @param string serialized data
 * @return unserialized data
 * @throws
 */
function unserialize (data) {
  // http://kevin.vanzonneveld.net
  // +     original by: Arpad Ray (mailto:arpad@php.net)
  // +     improved by: Pedro Tainha (http://www.pedrotainha.com)
  // +     bugfixed by: dptr1988
  // +      revised by: d3x
  // +     improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // +        input by: Brett Zamir (http://brett-zamir.me)
  // +     improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // +     improved by: Chris
  // +     improved by: James
  // +        input by: Martin (http://www.erlenwiese.de/)
  // +     bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  // +     improved by: Le Torbi
  // +     input by: kilops
  // +     bugfixed by: Brett Zamir (http://brett-zamir.me)
  // +      input by: Jaroslaw Czarniak
  // %            note: We feel the main purpose of this function should be to ease the transport of data between php & js
  // %            note: Aiming for PHP-compatibility, we have to translate objects to arrays
  // *       example 1: unserialize('a:3:{i:0;s:5:"Kevin";i:1;s:3:"van";i:2;s:9:"Zonneveld";}');
  // *       returns 1: ['Kevin', 'van', 'Zonneveld']
  // *       example 2: unserialize('a:3:{s:9:"firstName";s:5:"Kevin";s:7:"midName";s:3:"van";s:7:"surName";s:9:"Zonneveld";}');
  // *       returns 2: {firstName: 'Kevin', midName: 'van', surName: 'Zonneveld'}
  // *       returns 3: {'ü': 'ü', '四': '四', '𠜎': '𠜎'}
  var that = this, encoder, decoder, arrData,
    error = function (type, msg, filename, line) {
      throw new window[type](msg, filename, line);
    },
    read_until = function (offset, stopchr) {
      var i = 2, buf = [], chr = read_chrs(offset, 1)[1];

      while (chr != stopchr) {
        if ((i + offset) > arrData.length) {
          error('Error', 'Invalid');
        }
        buf.push(chr);
        chr = read_chrs(offset + (i - 1), 1)[1];
        i += 1;
      }
      return [buf.length, buf.join('')];
    },
    read_chrs = function (offset, length) {
      let buf = arrData.slice(offset-1,offset+length-1);
      return [buf.length, decoder.decode(buf)];
    },
    
    _unserialize = function (offset) {
      var dtype, dataoffset, keyandchrs, keys,
        readdata, readData, ccount, stringlength,
        i, key, kprops, kchrs, vprops, vchrs, value,
        chrs = 0,
        typeconvert = function (x) {
          return x;
        };

      if (!offset) {
        offset = 1;
      }
      dtype = (read_chrs(offset, 1)[1]).toLowerCase();

      dataoffset = offset + 2;

      switch (dtype) {
        case 'i':
          typeconvert = function (x) {
            return parseInt(x, 10);
          };
          readData = read_until(dataoffset, ';');
          chrs = readData[0];
          readdata = readData[1];
          dataoffset += chrs + 1;
          break;
        case 'b':
          typeconvert = function (x) {
            return parseInt(x, 10) !== 0;
          };
          readData = read_until(dataoffset, ';');
          chrs = readData[0];
          readdata = readData[1];
          dataoffset += chrs + 1;
          break;
        case 'd':
          typeconvert = function (x) {
            return parseFloat(x);
          };
          readData = read_until(dataoffset, ';');
          chrs = readData[0];
          readdata = readData[1];
          dataoffset += chrs + 1;
          break;
        case 'c':
          var res = getClass(dataoffset);
          dataoffset = res[0];
          readdata = res[1];
          break;
        case 'o':
          var res = getObject(dataoffset);
          dataoffset = res[0];
          readdata = res[1];
          break;
        case 'n':
          readdata = null;
          break;
        case 's':
          var res = getString(dataoffset);
          dataoffset = res[0];
          readdata = res[1];
          break;
        case 'a':
          var res = getArray(dataoffset);
          dataoffset = res[0];
          readdata = res[1];
          break;
        default:
          error('SyntaxError', 'Unknown / Unhandled data type(s)');
          break;
      }
      return [dtype, dataoffset - offset, typeconvert(readdata)];
    }
  ;

function getArray(offset) {
  var readdata
    , chrs
    , keys
    , dataoffset = offset
    , kprops
    , kchrs
    , key
    , vprops
    , vchrs
    , keyandchrs
    , i
    , value;
  readdata = {};

  keyandchrs = read_until(dataoffset, ':');
  chrs = keyandchrs[0];
  keys = keyandchrs[1];
  dataoffset += chrs + 2;

  for (i = 0; i < parseInt(keys, 10); i ++) {
    kprops = _unserialize(dataoffset);
    kchrs = kprops[1];
    key = kprops[2];
    dataoffset += kchrs;

    vprops = _unserialize(dataoffset);
    vchrs = vprops[1];
    value = vprops[2];
    dataoffset += vchrs;

    readdata[key] = value;
  }

  dataoffset += 1;
  return [dataoffset, readdata];
}

function getCount(offset) {
  var ccount
    , count
    , chrs
    , stringlength
    , readData
    , readdata;
  ccount = read_until(offset, ':');
  chrs = ccount[0];
  count = ccount[1];
  offset += chrs + 2;
  return [offset, count];
};

function getObject(offset) {
  var res = getString(offset)
    , body
    , classname = res[1];

  offset = res[0];
  res = getArray(offset);
  offset = res[0];
  return [offset, {name: classname, body: res[1]}];
};

function getClass(offset) {
  var res = getString(offset)
    , body
    , classname = res[1];

  offset = res[0];
  res = getCount(offset);
  offset = res[0];
  body = read_chrs(offset - 1, parseInt(res[1]))[1];
  if (body[0] !== '{' || body[body.length - 1] !== '}') {
    throw new Error('invalid body defn');
  }
  body = body.slice(1, -1);
  try {
    body = _unserialize(body, 0)[2];
  } catch (e) {
  }
  return [offset + parseInt(res[1]) + 1, {name: classname, body: body}];
};

function getString(offset) {
  var ccount
    , chrs
    , stringlength
    , readData
    , readdata;
  ccount = read_until(offset, ':');
  chrs = ccount[0];
  stringlength = ccount[1];
  offset += chrs + 2;

  readData = read_chrs(offset, parseInt(stringlength, 10));
  chrs = readData[0];
  readdata = readData[1];
  offset += chrs + 2;
  if (chrs != parseInt(stringlength, 10)/* && chrs != readdata.length*/) {
    error('SyntaxError', 'String length mismatch');
  }
  return [offset, readdata];
};
  encoder = new TextEncoding.TextEncoder();
  decoder = new TextEncoding.TextDecoder();
  //encoder = new TextEncoder();
  //decoder = new TextDecoder();
  arrData = encoder.encode(data);
  return _unserialize(0)[2];
}
/**
 * Parse PHP-serialized session data
 *
 * @param string serialized session
 * @return unserialized data
 * @throws
 */
function unserializeSession (input) {
  return input.split(/\|/).reduce(function (output, part, index, parts) {
    // First part = $key
    if (index === 0) {
      output._currKey = part;
    }
    // Last part = $someSerializedStuff
    else if (index === parts.length - 1) {
      output[output._currKey] = unserialize(part);
      delete output._currKey;
    }
    // Other output = $someSerializedStuff$key
    else {
      var match = part.match(/^((?:[\s\S]*?[;\}])+)([^;\}]+?)$/);
      if (match) {
        output[output._currKey] = unserialize(match[1]);
        output._currKey = match[2];
      } else {
        throw new Error('Parse error on part "' + part + '"');
      }
    }
    return output;
  }, {});
}

// /Wrapper
})((typeof window === 'undefined') ? global : window, (typeof window === 'undefined') ? exports : (window.PHPUnserialize = {}));
