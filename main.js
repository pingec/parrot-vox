var fs = require('fs'),
    restify = require('restify'),
    socketio = require('socket.io');

var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var mkdirp = require('mkdirp');

mkdirp('/tmp/media', function(err) {
    debugger;
    if (err) {
        console.error(err)
    } else {
        console.log('/tmp/media should exist now!');
    }
});

var globals = {};
globals.config = loadJsonSync('./config.json') || {};
globals.rec = null;

var state = {
    idle: "idle",
    recording: "recording",
    recordingLoop: "recording-loop",
    playingLoop: "playing-loop",
    playing: "playing"
};

globals.state = state.idle;

var server = restify.createServer();

setupServer();
globals.io = setupSocketIO();
setInterval(stateCheck, 100);

setInterval(function() {
    messageClient("ping from server");

}, 60000);


var tmpState;

function stateCheck() {

    if (globals.state !== tmpState) {
        tmpState = globals.state;
        globals.io.sockets.emit('state', globals.state);
    }
}

function setupServer() {

    server.get('/hello/:name', function(req, res, next) {
        //http://192.168.7.128:8080/hello/matej
        res.send('hello ' + req.params.name);
    });

    server.get(/recording\.wav/, restify.serveStatic({
        'directory': '/tmp/media',
        'default': 'recording.wav',
        'maxAge': 0
    }));


    server.get(/.*/, restify.serveStatic({
        //http://192.168.7.128:8080 => ./public/index.html
        //http://192.168.7.128:8080/jquery-2.1.3.min.js => ./public/jquery-2.1.3.min.js
        'directory': './public',
        'default': 'index.html'
    }));

    server.listen(8080, function() {
        console.log('%s listening at %s', server.name, server.url);
    });
}

function setupSocketIO() {

    var io = socketio.listen(server.server);
    //js client is automagically available http://192.168.7.128:8080/socket.io/socket.io.js

    io.sockets.on('connection', function(socket) {

        console.log("New connection from " + socket.request.connection.remoteAddress + ':' + socket.request.connection.remotePort);

        socket.emit('welcome', {
            message: 'Welcome!'
        });

        globals.io.sockets.emit('state', globals.state);

        socket.emit('initConfig', globals.config);

        socket.on('i am client', console.log);

        socket.on('userAction', onUserAction);

    });

    return io;
}

function onUserAction(data) {

    if (data.button) {

        console.log('its a button: ' + data.button);

        switch (data.button) {
            case 'play':
                playRecording(false);
                break;
            case 'play-local':
                break;
            case 'loop':
                startRecording(true);
                break;
            case 'record':
                startRecording(false);
                break;
            case 'stop':
                stateSetIdle();
                break;
            case 'save':
                saveConfigChange();
                break;
            case 'reset':
                //todo
                break;
            case 'load':
                globals.config = loadJsonSync('./config.json');
                console.dir(globals.config);
                for (var key in globals.config)
                    applyConfigChange(key, globals.config[key]);
                globals.io.emit('initConfig', globals.config);
                break;
        }
    } else {

        switch (Object.keys(data)[0]) {
            case 'start-threshold':
            case 'stop-threshold':
            case 'duration-start':
            case 'duration-stop':
            case 'duration':
            case 'input-gain':
            case 'output-volume':
            case 'output-boost':
            case 'input-boost':
                console.log('applying known setting: ', JSON.stringify(data));
                applyConfigChange(Object.keys(data)[0], data[Object.keys(data)[0]]);
                break;
            default:
                console.log('unknown setting: ' + JSON.stringify(data));

        }
    }
}




//return something like ('rec', ['recording.wav', 'silence', '1', '5', '2%', '1', '0:00:02', '2%']
function processRecSpawnParams() {

    return {
        command: 'rec',
        args: [
            '/tmp/media/recording.wav',
            'vol',
            globals.config['input-boost'],
            'silence',
            '1',
            globals.config['duration-start'],
            globals.config['start-threshold'] + '%',
            '1',
            '0:00:0' + globals.config['duration-stop'],
            globals.config['stop-threshold'] + '%'
        ]
    };

}


function processInfiniteRecSpawnParams() {

    return {
        command: 'rec',
        args: [
            '/tmp/media/recording.wav',
            'vol',
            globals.config['input-boost']
        ]
    };

}



function playRecording(loop) {

    console.log("starting playback....");

    if (globals.state === state.playing || globals.state === state.playingLoop) {
        console.log("already playing... ignoring");
        //messageClient("already playing... ignoring");
        return;
    }


    if (loop) {
        stateSetPlayingLoop();
    } else {
        stateSetPlaying();
    }

    globals.play = spawn('play', ['/tmp/media/recording.wav', 'vol', globals.config['output-boost']]);

    globals.play.stdout.on('data', function(data) {
        console.log('stdout: ' + data);
    });

    globals.play.stderr.on('data', function(data) {
        //console.log('stderr: ' + data);
        processStdErr(data);
    });

    globals.play.on('close', function(code) {
        console.log('child process exited with code ' + code);


        if (loop && globals.state !== state.idle) {
            stateSetIdle();
            startRecording(true);
        } else {
            stateSetIdle();
        }
    });

}


function stateSetPlaying() {
    globals.state = state.playing;
}

function stateSetPlayingLoop() {
    globals.state = state.playingLoop;
}

function stateSetIdle() {
    stopRecording();
    stopPlayback();
    globals.state = state.idle;
}

function stateSetRecording() {
    globals.state = state.recording;
}

function stateSetRecordingLoop() {
    globals.state = state.recordingLoop;
}

function stopPlayback() {
    console.log("stopping playback...");

    if (globals.play) {
        try {
            process.kill(globals.play.pid);
        } catch (e) {
            console.log("could not kill play pid ", globals.play.pid);
        }
    }
    globals.play = null;
}



function stopRecording() {
    console.log("stopping recording....");

    if (globals.rec) {
        try {
            process.kill(globals.rec.pid);
        } catch (e) {
            console.log("could not kill rec pid ", globals.rec.pid);
        }
    }
    globals.rec = null;
}

function onRecordingLimitReached() {

    messageClient("recording duration timer expired, stopping recording");
    stateSetIdle();

    playRecording(true);
}

function startRecording(loop) {

    console.log("starting recording....");

    if (globals.state === state.recording || globals.state === state.recordingLoop) {
        //just toggle it off and return
        stateSetIdle();
        return;
    }

    if (loop) {

        stateSetRecordingLoop();

        var params = processRecSpawnParams();
        globals.rec = spawn(params.command, params.args);

        messageClient("starting recording ...");

        globals.rec.stdout.on('data', function(data) {
            console.log('stdout: ' + data);
        });

        globals.rec.stderr.on('data', function(data) {
            //console.log('stderr: ' + data);
            processStdErr(data);
        });

        var timer = setTimeout(onRecordingLimitReached, globals.config.duration * 1000);

        globals.rec.on('close', function(code) {
            console.log('child process exited with code ' + code);

            clearTimeout(timer);

            if (globals.state !== state.idle)
                playRecording(true);
        });


    } else {
        //todo todo ...
        globals.state = state.recording;

        var params = processInfiniteRecSpawnParams();
        globals.rec = spawn(params.command, params.args);

        messageClient("starting infinite recording ...");

        globals.rec.stdout.on('data', function(data) {
            console.log('stdout: ' + data);
        });

        globals.rec.stderr.on('data', function(data) {
            //console.log('stderr: ' + data);
            processStdErr(data);
        });

        var timer = setTimeout(function() {
            messageClient("manual recording duration timer expired, stopping recording");
            stateSetIdle();

        }, globals.config.duration * 1000);

        globals.rec.on('close', function(code) {
            console.log('child process exited with code ' + code);

            clearTimeout(timer);

            if (globals.state !== state.idle)
                playRecording(true);
        });
    }

}


//    rec = spawn('rec', ['recording.wav', 'silence', '1', '5', '2%', '1', '0:00:02', '2%']);
//
//rec.stdout.on('data', function(data) {
//    console.log('stdout: ' + data);
//});
//
//rec.stderr.on('data', function(data) {
//    console.log('stderr: ' + data);
//    processStdErr(data);
//});
//
//rec.on('close', function(code) {
//    console.log('child process exited with code ' + code);
//});

//setTimeout(function() {
//process.kill(rec.pid);
//}, 5000);


function processStdErr(data) {

    //this is called while recording or while playback

    var extrctdData = {};


    // 1. try extract volume
    var volume = tryProcessVuMeter(data);

    //    //debug only
    //    volume = {};
    //    volume.leftChanVol = Math.round(Math.random() * 13);
    //    volume.rightChanVol = Math.round(Math.random() * 13);


    if (volume) {
        extrctdData.volume = volume;
        //console.log(volume.leftChanVol, volume.rightChanVol);
        //globals.io.emit('volume', volume);
    }



    // 2. check if recording has started
    //In:0.00% 00:00:16.90 [00:00:00.00] Out:0     [      |      ]        Clip:0
    //In:0.00% 00:00:17.07 [00:00:00.00] Out:7.34k [!=====|=====!] Hd:0.3 Clip:0
    //first line is an example of rec listening, but recording has not triggered
    //second line is an example where recording has started and input file is 7.34k in size

    var outSize = tryExtractOutputSize(data);
    if (outSize && outSize.length) {
        //console.log(outSize);
        //globals.io.emit('outSize', outSize);
        //console.log(outSize);
        extrctdData.out = outSize;
    }

    if (extrctdData.volume || extrctdData.out) {
        globals.io.emit('soxOutput', extrctdData);
    }

    //TODO

}



//if output size is 0 then sox is listening but not recording (yet)
function tryExtractOutputSize(data) {
    //In:0.00% 00:00:01.62 [00:00:00.00] Out:7.41k [      |      ]        Clip:0
    //In:0.00% 00:00:03.50 [00:00:00.00] Out:85.8k [  -===|===-  ]        Clip:0
    //In:0.00% 00:00:02.47 [00:00:00.00] Out:166k  [!=====|=====!] Hd:0.0 Clip:0
    //In:0.00% 00:00:34.56 [00:00:00.00] Out:1.65M [    ==|==    ]        Clip:0

    var regex = /Out:([\d,\.]*.)/;
    var match = regex.exec(data);

    if (match && match.length) {
        return match[1];
    }
}

function isListening(data) {
    return data.indexOf("[00:00:00.00]") > -1;
}

function isRecording(data) {

}


function tryProcessVuMeter(data) {

    //example of lines this is supposed to match:
    //In:0.00% 00:00:01.62 [00:00:00.00] Out:7.41k [      |      ]        Clip:0
    //In:0.00% 00:00:03.50 [00:00:00.00] Out:85.8k [  -===|===-  ]        Clip:0
    //In:0.00% 00:00:02.47 [00:00:00.00] Out:166k  [!=====|=====!] Hd:0.0 Clip:0
    //last number is an example of audio input being "in the red" which is not good

    var vuRegex = /\[([^\]]*)\|(.*?)\]/;
    var match = vuRegex.exec(data);
    if (match && match.length) {
        var leftChannel = match[1]; //equals to "      ", "  -===", "!=====" for above examples
        var rightChannel = match[2]; //equals to "      ", "===-  ", "=====!" for above examples
        var leftChanVol = getChanVolAsNumber(leftChannel);
        var rightChanVol = getChanVolAsNumber(rightChannel);

        return {
            leftChanVol: leftChanVol,
            rightChanVol: rightChanVol
        };
    }

    function getChanVolAsNumber(chanVu) {
        //returns number from 0 to 13
        var volume = 0;
        for (var i = 0; i < chanVu.length; i++) {
            var char = chanVu.charAt(i);
            if (char == '=') {
                volume += 2;
            }
            if (char == '-') {
                volume += 1;
            }
            if (char == '!') {
                //if this happens, audio-in is "in the red"
                volume += 3;
            }
        }
        return volume;
    }

    return null;
}

function messageClient(msg, color, bold) {

    globals.io.emit('server message', {
        msg: msg,
        color: color,
        bold: bold
    });

}

function applyConfigChange(setting, value) {
    globals.config[setting] = value;

    switch (setting) {
        case "start-threshold":

            break;
        case "stop-threshold":
            break;
        case "duration-start":
            break;
        case "duration-stop":
            break;
        case "duration":
            break;
        case "input-boost":
            break;
        case "output-boost":
            break;
        case "input-gain":
            //'amixer sset "Mic" 50%' //from -128db to -114dB
            exec('amixer sset "Mic" @val%'.replace('@val', value));
            break;
        case "output-volume":
            //'amixer sset "Speaker" 50%' //from -128db to -127dB
            exec('amixer sset "Speaker" @val%'.replace('@val', value));
            console.log('amixer sset "PCM" @val%'.replace('@val', value));
            break;

    }

}

function saveConfigChange() {
    saveJsonAsync(globals.config, './config.json');
}



function loadJsonSync(path) {
    var data,
        myObj;
    try {
        data = fs.readFileSync(path);
    } catch (err) {
        console.log('Could not open file ' + path);
        return null;
    }
    try {
        myObj = JSON.parse(data);
    } catch (err) {
        console.log('There has been an error parsing your JSON.');
        console.log(err);
    }

    return myObj;
}


function saveJsonAsync(object, path) {
    fs.writeFile(path, JSON.stringify(object, null, 4), function(err) {
        if (err) {
            console.log(err);
        } else {
            console.log("JSON saved to " + path);
        }
    });
}