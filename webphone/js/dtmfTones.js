// polyfill
var AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext;

function Tone(context, freq1, freq2) {
    this.context = context;
    this.status = 0;
    this.freq1 = freq1;
    this.freq2 = freq2;
}

Tone.prototype.setup = function () {
    this.osc1 = context.createOscillator();
    this.osc2 = context.createOscillator();
    this.osc1.frequency.value = this.freq1;
    this.osc2.frequency.value = this.freq2;

    this.gainNode = this.context.createGain();
    this.gainNode.gain.value = 0.25;

    this.filter = this.context.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency = 8000;

    this.osc1.connect(this.gainNode);
    this.osc2.connect(this.gainNode);

    this.gainNode.connect(this.filter);
    this.filter.connect(context.destination);
}

Tone.prototype.start = function () {
    this.setup();
    this.osc1.start(0);
    this.osc2.start(0);
    this.status = 1;
}

Tone.prototype.stop = function () {
    this.osc1.stop(0);
    this.osc2.stop(0);
    this.status = 0;
}

var dtmfFrequencies = {
    "1": {
        f1: 697,
        f2: 1209
    },
    "2": {
        f1: 697,
        f2: 1336
    },
    "3": {
        f1: 697,
        f2: 1477
    },
    "4": {
        f1: 770,
        f2: 1209
    },
    "5": {
        f1: 770,
        f2: 1336
    },
    "6": {
        f1: 770,
        f2: 1477
    },
    "7": {
        f1: 852,
        f2: 1209
    },
    "8": {
        f1: 852,
        f2: 1336
    },
    "9": {
        f1: 852,
        f2: 1477
    },
    "*": {
        f1: 941,
        f2: 1209
    },
    "0": {
        f1: 941,
        f2: 1336
    },
    "#": {
        f1: 941,
        f2: 1477
    }
}

var context = new AudioContext();

// Create a new Tone instace. (Initialised it with 
// frequencies of 350 and 440 but it doesn't matter
// what we choose because we will be changing them at the end)
var dtmf = new Tone(context, 350, 440);

$(".dtmf-interface .btn-group .numpad-button").on("mousedown touchstart", function (e) {
    e.preventDefault();

    var keyPressedHtml = $(this).html(); // this gets the number/character that was pressed
    var keyNumberPressed = keyPressedHtml.match(/\d|\#|\*/g);

    var frequencyPair = dtmfFrequencies[keyNumberPressed]; // this looks up which frequency pair we need

    // this sets the freq1 and freq2 properties
    dtmf.freq1 = frequencyPair.f1;
    dtmf.freq2 = frequencyPair.f2;

    if (dtmf.status == 0) {
        dtmf.start();
    }
});

// detect the mouseup event on the window tag otherwise if we release the mouse when not over a button,
// the tone will remain playing
$(window).on("mouseup touchend", function () {
    if (typeof dtmf !== "undefined" && dtmf.status) {
        setTimeout(function () {
            dtmf.stop();
        }, 100);
    }
});