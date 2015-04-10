var socket = io.connect(location.origin);

$(document).ready(function() {

    socket.on('connect', function() {
        console.log("connect!");
        displayMessage('socket.io: connected');
    });
    socket.on('disconnect', function() {
        console.log("disconnect!");
        displayMessage('socket.io: disconnected! Server might be offline?', 'red');
    });
    socket.on('error', function() {
        console.error(arguments);
        displayMessage('A connection error occured.Socket.io / websocket failed to connect. Check your firewall settings', 'red', true);
    });

    socket.on('welcome', function(data) {
        displayMessage(data.message);

        socket.emit('i am client', {
            data: 'foo!'
        });
    });

    socket.on('server message', function(data) {
        displayMessage('s: ' + data.msg, data.color, data.bold);
    });

    socket.on('initConfig', function(config) {
        for (var key in config) {
            $('#' + key).slider('value', config[key]);

        }
    });

    socket.on('state', function(state) {
        $('#state').text(state);

        console.log('server state changed: ', state);

        switch (state) {
            case serverState.idle:
                $('button.record, button.loop').css('color', 'black').removeAttr('disabled');
                setTimeout(function() {
                    $('#vu-meter').empty();
                }, 1000)
                break;
            case serverState.recording:
                $('button.record').css('color', 'red');
                $('button.loop').css('color', 'black').attr('disabled', 'disabled');
                break;
            case serverState.recordingLoop:
                $('button.loop').css('color', 'red');
                $('button.record').css('color', 'black').attr('disabled', 'disabled');
                break;
        }
    });

    var vuMeter = $('#vu-meter');
    var vuMeterColor = 'black';
    socket.on('soxOutput', function(extrctdData) {
        var text = '';
        var volume = extrctdData.volume;
        if (volume && volume.leftChanVol > 0) {
            text = Array(volume.leftChanVol).join("|");
            vuMeter.text(text);

            if (volume.leftChanVol >= 13) {

                if (vuMeterColor !== 'red') {

                    vuMeter.css('color', 'red');
                    vuMeterColor = 'red';
                }
            } else if (vuMeterColor !== 'black') {

                vuMeter.css('color', 'black');
                vuMeterColor = 'black';
            }
        }

        var outSize = extrctdData.out;
        if (outSize && outSize.length) {
            $('#out-size').text(outSize);
        }


    });

    initPage();
});


var serverState = {
    idle: "idle",
    recording: "recording",
    recordingLoop: "recording-loop"
};

function initPage() {

    initButtons();
    initSliders();
}

function displayMessage(msg, color, bold) {

    var style = color ? 'style="color:@color; font-weight: @bold;"'.replace('@color', color) : '';
    style = bold ? style.replace('@bold', 'bold') : style.replace('@bold', 'normal');

    msg = timestamp() + ' ' + msg;

    console.log(msg);
    $('#messages').prepend('<li @style>'.replace('@style', style) + msg + '</li>');
}

function timestamp() {
    var date = new Date();
    return ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2) + ':' + ('0' + date.getSeconds()).slice(-2);
}

function initButtons() {

    $('button').on('click', function(event) {
        var action = $(event.target).attr('class');

        socket.emit('userAction', {
            button: action
        });

        if (action === 'play-local') {
            var audio = new Audio('recording.wav');
            audio.play();
        }

    });

}


function initSliders() {

    initHorizontalSliders();

    initVerticalSliders();
}

function initHorizontalSliders() {

    var horizontalSliders = $('.horizontal');

    horizontalSliders.each(function(index, horizontalSlider) {

        var $horizontalSlider = $(horizontalSlider);

        var slider = $horizontalSlider.find('.slider'),
            tooltip = $horizontalSlider.find('.tooltip');

        var units = slider.data('units') ? slider.data('units') : '';


        //Hide the Tooltip at first
        tooltip.hide();

        //Call the Slider
        slider.slider({
            //Config
            range: "min",
            min: 1,
            value: 33,
            start: function(event, ui) {
                tooltip.fadeIn('fast');
            },

            //Slider Event
            slide: function(event, ui) { //When the slider is sliding

                var value = slider.slider('value'),
                    volume = $horizontalSlider.find('.horizontal-icon');

                tooltip.css('left', value).text(ui.value + units); //Adjust the tooltip accordingly

                if (value <= 5) {
                    volume.css('background-position', '0 0');
                } else if (value <= 25) {
                    volume.css('background-position', '0 -25px');
                } else if (value <= 75) {
                    volume.css('background-position', '0 -50px');
                } else {
                    volume.css('background-position', '0 -75px');
                };

            },

            stop: function(event, ui) {

                processSliderChange(event, ui);
                tooltip.fadeOut('fast');

            },
        });


        var handle = slider.parent().find('.ui-slider-handle');
        handle.on('mouseenter', function(event) {
            var value = $(event.target).parent().slider('value');
            var tooltip = $(event.target).parent().parent().find('.tooltip');
            tooltip.css('left', value).text(value + units);
            tooltip.fadeIn('fast');
        });
        handle.on('mouseleave', function(event) {
            tooltip.fadeOut('fast');
        });


    });
}

function processSliderChange(event, ui) {

    var value = ui.value;
    var settingName = $(event.target).attr('id');
    var action = {};
    action[settingName] = value;

    displayMessage(settingName + ' sent to server...');

    socket.emit('userAction', action);
}

function initVerticalSliders() {


    var verticalSliders = $('.vertical-slider-container > .slider-vertical').parent();

    verticalSliders.each(function(index, verticalSliderContainer) {

        var $verticalSliderContainer = $(verticalSliderContainer);

        var slider = $verticalSliderContainer.find('.slider-vertical'),
            tooltip = $verticalSliderContainer.find('.tooltip');

        var maxVal = slider.data('max') ? slider.data('max') : 100;
        var step = slider.data('step') ? slider.data('step') : 1;
        var units = slider.data('units') ? slider.data('units') : '';


        //Hide the Tooltip at first
        tooltip.hide();

        $verticalSliderContainer.find(".slider-vertical").slider({
            value: 33,
            range: "max",
            min: 1,
            step: step,
            max: maxVal,
            orientation: "vertical",
            start: function(event, ui) {
                tooltip.fadeIn('fast');
            },

            slide: function(event, ui) { //When the slider is sliding
                var value = slider.slider('value'),
                    volume = $verticalSliderContainer.find('.vertical-icon');

                tooltip.css('top', 100 - value / (maxVal / 100) - 10).text(ui.value + units); //Adjust the tooltip accordingly


                //tooltip.css('top', value).text(ui.value); //Adjust the tooltip accordingly


                if (slider.attr('id').indexOf('output-') > -1) {
                    if (value <= 5) {
                        volume.css('background-position', '0 0');
                    } else if (value <= 25) {
                        volume.css('background-position', '0 -25px');
                    } else if (value <= 75) {
                        volume.css('background-position', '0 -50px');
                    } else {
                        volume.css('background-position', '0 -75px');
                    }
                }

            },

            stop: function(event, ui) {
                tooltip.fadeOut('fast');
                processSliderChange(event, ui);
            }
        });

        var handle = slider.parent().find('.ui-slider-handle');
        handle.on('mouseenter', function(event) {
            var value = $(event.target).parent().slider('value');
            var tooltip = $(event.target).parent().parent().find('.tooltip');
            tooltip.css('top', 100 - value / (maxVal / 100) - 10).text(value + units);
            tooltip.fadeIn('fast');
        });
        handle.on('mouseleave', function(event) {
            tooltip.fadeOut('fast');
        });


    });



}