
parrot-vox
============
Listens for sounds, records them and automatically plays them back.

**Wraps the sox utility internally, so make sure you have sox installed on your system**

**This app is far from finished it and is closer to a prototype than a finished product! YMMV** 

![parrot-vox screenshot](https://raw.githubusercontent.com/pingec/parrot-vox/master/screenshots/screen1.png)

![r.pi hardware picture](https://raw.githubusercontent.com/pingec/parrot-vox/master/screenshots/r-pi.png)



This setup was tested to be working on the following setup:

Raspberry Pi B+ running Raspbian GNU/Linux 7 (wheezy) 

Linux raspberrypi 3.18.7+ #755 PREEMPT Thu Feb 12 17:14:31 GMT 2015 armv6l GNU/Linux

Using an external usb sound card (1908:2070 GEMBIRD) but any C-Media CM108 and similar should work fine.

##Configuration
- Some things can be changed via the web interface (everything in config.json), other are hardcoded in code. You might have to modify the paths in code.
- To make the external usb audio card the default one change /etc/modprobe.d/alsa-base.conf set:
    ```bash
    options snd-usb-audio index=0
    ```
- Ensure you have sox installed and "rec"/"play" commands are globally available.
- Run with "node main.js" and then browse to device's ip address and port 8080.


If you're using a Raspberry Pi and notice the output isnt totally clean, some USB Audio adapters don't like USB-1.2 and produce crackling in the output. You can work around the problem by adding dwc_otg.speed=1 to /boot/cmdline.txt and setting the USB ports to USB-1.1 mode.


##config.json example

```js
{
    "start-threshold": 2,
    "stop-threshold": 2,
    "duration-start": 5,
    "duration-stop": 2,
    "duration": 20,
    "input-gain": 100,
    "output-volume": 100,
    "input-boost": 1,
    "output-boost": 1
}
``` 

##Appendix: sox syntax explanation

```bash
silence [ -l ] above_periods [ duration threshold[d|%] ] [ below_periods duration threshold[d|%] ]
```  
```bash
rec recording.wav silence 1 5 2% 1 0:00:02 2%
```  

- **1** - above-periods (start recording when non-silence is detected) TREAT AS CONSTANT
- **5** - duration (amount of SAMPLES that non-silence must be detected for before starting recording, you can also specify time instead number of samples, eg. use '2t' for 2 seconds or '0:00:02' syntax also works)
- **2%** - threshold (what is treated as silence and what not when determining when to start recording)
- **1** - below-periods (stop recording when silence is detected) TREAT AS CONSTANT
- **0:00:02** - duration (amount of time of non-silence before recording is stopped, same formatting options are available as for duration parameter above)
- **2%** - threshold (what is treated as silence and what not when determining when to stop recording)