(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var ffmpeg;

function ExtractAudioFFMPEG(file, infoFunc) {
    const info = (msg) => {
        if (infoFunc !== undefined) {
            infoFunc(msg);
        }
    };
    return new Promise(function (done, failed) {
        var newFile;
        const { createFFmpeg, fetchFile } = FFmpeg;
        const transcode = async (file) => {
            if (ffmpeg === undefined) {
                const ffmpegTmp = createFFmpeg({ log: true });
                info('Loading ffmpeg-core.js');
                await ffmpegTmp.load();
                info('Loaded ffmpeg-core.js');
                ffmpeg = ffmpegTmp;
            }
            const { name } = file;
            ffmpeg.FS('writeFile', name, await fetchFile(file));
            info('Start copy audio');
            await ffmpeg.run('-i', name, '-map', '0:a', '-acodec', 'copy', 'output.mp4');
            info('Preparing file');
            const data = ffmpeg.FS('readFile', 'output.mp4');
            newFile = new Blob([data.buffer], { type: 'audio/mp4', name: "audio.mp4" })
            info('Done');
            done(newFile);
        }
        transcode(file);
    });
}

module.exports = ExtractAudioFFMPEG;
},{}],2:[function(require,module,exports){
const prettyBytes = require('./../node_modules/pretty-bytes/index.js');
const audioBufferToWav = require('./../node_modules/audiobuffer-to-wav/index.js');
const audioFFMPEG = require('./audio-ffmpeg.js');

var file;
var newFile;
var sampleRate = 16000;
var working = false;

function save(file) {
    if (file) {
        const a = document.createElement('a');
        const url = window.URL.createObjectURL(file);
        a.href = url;
        a.download = "olia";
        a.click();
        window.URL.revokeObjectURL(url);
    } else {
        console.log("no file");
    }
}

function setResultAudio(file) {
    var audio = document.getElementById('result');
    if (file !== undefined){
        audio.src = window.URL.createObjectURL(file);
    } else {
        audio.src = '';
    }

}

function getBuffer(resolve) {
    var reader = new FileReader();
    reader.onload = function () {
        var arrayBuffer = reader.result;
        resolve(arrayBuffer);
    }
    reader.readAsArrayBuffer(file);
}


function extractWAV() {
    working = true;
    updateControls();
    var audioContext = new (window.AudioContext || window.webkitAudioContext)(({ sampleRate: sampleRate }));
    var videoFileAsBuffer = new Promise(getBuffer);
    videoFileAsBuffer.then(function (data) {
        console.log(data)
        audioContext.decodeAudioData(data).then(function (decodedAudioData) {
            console.log(decodedAudioData)
            var wav = audioBufferToWav(decodedAudioData)
            console.log(wav)
            newFile = new Blob([wav], { type: "wav", name: "audio.wav" })
            console.log(newFile);
            setResultAudio(newFile);
            working = false;
            updateControls()
            console.log("Done");
        });
    });
}

function extractMP3() {
    working = true;
    updateControls();
    var audioContext = new (window.AudioContext || window.webkitAudioContext)(({ sampleRate: sampleRate }));
    var videoFileAsBuffer = new Promise(getBuffer);
    videoFileAsBuffer.then(function (data) {
        console.log(data)
        audioContext.decodeAudioData(data).then(function (decodedAudioData) {
            console.log("Decoded")
            console.log(decodedAudioData)
            var buffer = audioBufferToIntArray(decodedAudioData)
            console.log(buffer)
            buffer = new Int16Array(buffer)
            console.log(buffer)
            console.log("Starting to convert to mp3, buffer: ", buffer.length)

            var mp3encoder = new lamejs.Mp3Encoder(1, decodedAudioData.sampleRate, 48);
            const sampleBlockSize = 1152;
            var mp3Data = [];
            console.log(buffer.length)
            const pr = document.getElementById('progress')
            pr.innerHTML = "Starting"
            var lt = 0;

            var i = 0;
            function doChunk() {
                if (i < buffer.length) {
                    var sampleChunk = buffer.subarray(i, i + sampleBlockSize);
                    var mp3buf = mp3encoder.encodeBuffer(sampleChunk);
                    if (mp3buf.length > 0) {
                        mp3Data.push(mp3buf);
                    }
                    if (new Date() > lt) {
                        console.log("encoding ...")
                        pr.innerHTML = ((i / buffer.length) * 100).toFixed(0);
                        lt = new Date();
                        lt.setSeconds(lt.getSeconds() + 2);
                    }
                    i += sampleBlockSize
                    setTimeout(doChunk, 1);
                } else {
                    console.log("Done converting to mp3")
                    var mp3buf = mp3encoder.flush();

                    if (mp3buf.length > 0) {
                        mp3Data.push(mp3buf);
                    }
                    pr.innerHTML = "Done"
                    console.log("Done converting to mp3")
                    console.log(mp3Data.length)

                    newFile = new Blob(mp3Data, { type: "audio/mp3", name: "audio.mp3" })
                    console.log(newFile)
                    setResultAudio(newFile);
                    working = false;
                    updateControls();
                    console.log("Done")
                }
            }
            doChunk();
        });
    });
}

function audioBufferToIntArray(abuffer) {
    var numOfChan = abuffer.numberOfChannels,
        length = (abuffer.length / abuffer.numberOfChannels) * 2,
        buffer = new ArrayBuffer(length),
        view = new DataView(buffer),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

    // write interleaved data
    for (i = 0; i < abuffer.numberOfChannels; i++)
        channels.push(abuffer.getChannelData(i));
    console.log(channels)

    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {             // interleave channels
            sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
            view.setInt16(pos, sample, true);          // write 16-bit sample
            pos += 2;
        }
        offset++                                     // next source sample
    }
    return buffer
}

function loadFile() {
    var reader = new FileReader();
    if (input.files) {
        file = input.files[0]
        console.log(file)
        var reader = new FileReader();
        reader.onload = function (e) {
            var audio = document.getElementById('audio');
            audio.src = e.target.result;
        }
        reader.readAsDataURL(file);
    }
    updateControls();
}

function extractFFMPEG() {
    working = true;
    updateControls();
    const message = document.getElementById('progress');
    const info = async (msg) => {
        message.innerHTML = msg;
    }
    audioFFMPEG(file, info).then(
        (file) => {
            newFile = file;
            console.log(newFile);
            setResultAudio(newFile);
            working = false;
            updateControls()
            console.log("Done");
        }
    ).catch(err => {
        newFile = undefined;
        setResultAudio(newFile);
        working = false;
        updateControls()
        console.log("Done");
    });
}

function initEvent() {
    document.getElementById('btnWAV').onclick = extractWAV;
    document.getElementById('btnMP3').onclick = extractMP3;
    document.getElementById('btnSave').onclick = function () { save(newFile) }
    document.getElementById('input').onchange = loadFile;
    document.getElementById('btnFFMPEG').onclick = extractFFMPEG;
}

var working = false;

function updateControls() {
    document.getElementById('btnWAV').disabled = working || !(file && file.size > 0);
    document.getElementById('btnMP3').disabled = working || !(file && file.size > 0);
    document.getElementById('btnFFMPEG').disabled = working || !(file && file.size > 0);
    document.getElementById('btnSave').disabled = working || !(newFile && newFile.size > 0);
    document.getElementById('spanLen').innerHTML = ''
    if (file && file.size > 0) {
        document.getElementById('spanLen').innerHTML = prettyBytes(file.size)
    }
    document.getElementById('spanLenResult').innerHTML = ''
    if (newFile && newFile.size > 0) {
        document.getElementById('spanLenResult').innerHTML = prettyBytes(newFile.size)
    }
}

initEvent();
updateControls();
console.log("Loaded")

},{"./../node_modules/audiobuffer-to-wav/index.js":3,"./../node_modules/pretty-bytes/index.js":4,"./audio-ffmpeg.js":1}],3:[function(require,module,exports){
module.exports = audioBufferToWav
function audioBufferToWav (buffer, opt) {
  opt = opt || {}

  var numChannels = buffer.numberOfChannels
  var sampleRate = buffer.sampleRate
  var format = opt.float32 ? 3 : 1
  var bitDepth = format === 3 ? 32 : 16

  var result
  if (numChannels === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1))
  } else {
    result = buffer.getChannelData(0)
  }

  return encodeWAV(result, format, sampleRate, numChannels, bitDepth)
}

function encodeWAV (samples, format, sampleRate, numChannels, bitDepth) {
  var bytesPerSample = bitDepth / 8
  var blockAlign = numChannels * bytesPerSample

  var buffer = new ArrayBuffer(44 + samples.length * bytesPerSample)
  var view = new DataView(buffer)

  /* RIFF identifier */
  writeString(view, 0, 'RIFF')
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * bytesPerSample, true)
  /* RIFF type */
  writeString(view, 8, 'WAVE')
  /* format chunk identifier */
  writeString(view, 12, 'fmt ')
  /* format chunk length */
  view.setUint32(16, 16, true)
  /* sample format (raw) */
  view.setUint16(20, format, true)
  /* channel count */
  view.setUint16(22, numChannels, true)
  /* sample rate */
  view.setUint32(24, sampleRate, true)
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true)
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true)
  /* bits per sample */
  view.setUint16(34, bitDepth, true)
  /* data chunk identifier */
  writeString(view, 36, 'data')
  /* data chunk length */
  view.setUint32(40, samples.length * bytesPerSample, true)
  if (format === 1) { // Raw PCM
    floatTo16BitPCM(view, 44, samples)
  } else {
    writeFloat32(view, 44, samples)
  }

  return buffer
}

function interleave (inputL, inputR) {
  var length = inputL.length + inputR.length
  var result = new Float32Array(length)

  var index = 0
  var inputIndex = 0

  while (index < length) {
    result[index++] = inputL[inputIndex]
    result[index++] = inputR[inputIndex]
    inputIndex++
  }
  return result
}

function writeFloat32 (output, offset, input) {
  for (var i = 0; i < input.length; i++, offset += 4) {
    output.setFloat32(offset, input[i], true)
  }
}

function floatTo16BitPCM (output, offset, input) {
  for (var i = 0; i < input.length; i++, offset += 2) {
    var s = Math.max(-1, Math.min(1, input[i]))
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
  }
}

function writeString (view, offset, string) {
  for (var i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

},{}],4:[function(require,module,exports){
'use strict';

const BYTE_UNITS = [
	'B',
	'kB',
	'MB',
	'GB',
	'TB',
	'PB',
	'EB',
	'ZB',
	'YB'
];

const BIBYTE_UNITS = [
	'B',
	'kiB',
	'MiB',
	'GiB',
	'TiB',
	'PiB',
	'EiB',
	'ZiB',
	'YiB'
];

const BIT_UNITS = [
	'b',
	'kbit',
	'Mbit',
	'Gbit',
	'Tbit',
	'Pbit',
	'Ebit',
	'Zbit',
	'Ybit'
];

const BIBIT_UNITS = [
	'b',
	'kibit',
	'Mibit',
	'Gibit',
	'Tibit',
	'Pibit',
	'Eibit',
	'Zibit',
	'Yibit'
];

/*
Formats the given number using `Number#toLocaleString`.
- If locale is a string, the value is expected to be a locale-key (for example: `de`).
- If locale is true, the system default locale is used for translation.
- If no value for locale is specified, the number is returned unmodified.
*/
const toLocaleString = (number, locale, options) => {
	let result = number;
	if (typeof locale === 'string' || Array.isArray(locale)) {
		result = number.toLocaleString(locale, options);
	} else if (locale === true || options !== undefined) {
		result = number.toLocaleString(undefined, options);
	}

	return result;
};

module.exports = (number, options) => {
	if (!Number.isFinite(number)) {
		throw new TypeError(`Expected a finite number, got ${typeof number}: ${number}`);
	}

	options = Object.assign({bits: false, binary: false}, options);

	const UNITS = options.bits ?
		(options.binary ? BIBIT_UNITS : BIT_UNITS) :
		(options.binary ? BIBYTE_UNITS : BYTE_UNITS);

	if (options.signed && number === 0) {
		return ` 0 ${UNITS[0]}`;
	}

	const isNegative = number < 0;
	const prefix = isNegative ? '-' : (options.signed ? '+' : '');

	if (isNegative) {
		number = -number;
	}

	let localeOptions;

	if (options.minimumFractionDigits !== undefined) {
		localeOptions = {minimumFractionDigits: options.minimumFractionDigits};
	}

	if (options.maximumFractionDigits !== undefined) {
		localeOptions = Object.assign({maximumFractionDigits: options.maximumFractionDigits}, localeOptions);
	}

	if (number < 1) {
		const numberString = toLocaleString(number, options.locale, localeOptions);
		return prefix + numberString + ' ' + UNITS[0];
	}

	const exponent = Math.min(Math.floor(options.binary ? Math.log(number) / Math.log(1024) : Math.log10(number) / 3), UNITS.length - 1);
	// eslint-disable-next-line unicorn/prefer-exponentiation-operator
	number /= Math.pow(options.binary ? 1024 : 1000, exponent);

	if (!localeOptions) {
		number = number.toPrecision(3);
	}

	const numberString = toLocaleString(Number(number), options.locale, localeOptions);

	const unit = UNITS[exponent];

	return prefix + numberString + ' ' + unit;
};

},{}]},{},[2]);
