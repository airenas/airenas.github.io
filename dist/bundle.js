(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var file;
var at;
var previousTime;
var playPauseButton;
var playing;

function setMusicXML(file) {
    const reader = new FileReader();
    reader.onload = function (data) {
        at.load(data.target.result, [0]);
    };
    reader.readAsArrayBuffer(file);
}

function setupControl() {
    const atDiv = document.getElementById('alphaTabS');
    const viewPort = document.getElementById('at-viewport');
    console.log("viewPort", viewPort);
    at = new alphaTab.AlphaTabApi(atDiv, {
        file: "dist/la-cucaracha.xml",
        player: {
            scrollOffsetx: -10,
            enablePlayer: true,
            soundFont: "dist/soundfont/sonivox.sf2",
            scrollElement: viewPort
        }
    });
    at.error.on(function (e) {
        console.error('alphaTab error', e);
    });

    const trackItems = [];
    at.renderStarted.on(function (isResize) {
        if (!isResize) {
            console.log('loading');
        }
        const tracks = new Map();
        at.tracks.forEach(function (t) {
            tracks.set(t.index, t);
        });

        trackItems.forEach(function (trackItem) {
            if (tracks.has(trackItem.track.index)) {
                trackItem.classList.add('active');
            } else {
                trackItem.classList.remove('active');
            }
        });
    });

    at.soundFontLoad.on(function (args) {
    });
    at.soundFontLoaded.on(function () {
    });
    at.renderFinished.on(function () {
        console.log("render finish");
        updateControls();
    });
    at.scoreLoaded.on(function (score) {
        console.log("score loaded");
        updateControls();
    });

    at.playerPositionChanged.on(function (args) {
        const currentSeconds = (args.currentTime / 1000) | 0;
        if (currentSeconds == previousTime) {
            return;
        }
        previousTime = currentSeconds;
    });

    playPauseButton = document.getElementById('play');
    at.playerReady.on(function () {
        console.log("player ready")
        updateControls();
    });

    at.playerStateChanged.on(e => {
        console.log("stopped", e.stopped)
        playing = !e.stopped;
        if (e.stopped) {
            console.log("Stopped")
        } else {
            console.log("Playing")
        }
        updateControls();
    });

    playPauseButton.onclick = function (e) {
        e.stopPropagation();
        at.playPause();
    };

    document.getElementById('stop').onclick = function (e) {
        e.stopPropagation();
        at.stop();
    };
    return at;
}

function loadFile() {
    if (input.files) {
        file = input.files[0]
        setMusicXML(file)
        console.log(file)
    }
    updateControls();
}

function initEvent() {
    document.getElementById('input').onchange = loadFile;
}

function updateControls() {
    console.log("updateControls", at.isReadyForPlayback)
    document.getElementById('play').innerHTML = (!playing ? "Play" : "Pause");
    document.getElementById('play').disabled = !(at && at.isReadyForPlayback);
    document.getElementById('stop').disabled = !playing;
}

initEvent();
setupControl();
updateControls();
console.log("Loaded")

},{}]},{},[1]);
