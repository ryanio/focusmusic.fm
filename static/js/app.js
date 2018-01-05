$(function() { 

    /* =============================================

    Init

    ============================================= */

    // Init vars for app
    var trackNumber = 0;
    var tracks = [];
    var offset = 0;
    var timestamp = Date.now();
    var selectedChannel = 'electronic';
    var autoplayNextTrack = false;
    var volume = 0.5;

    // Init vars for beep()
    var context = new(window.AudioContext || window.webkitAudioContext || false);
    var oscillator = null;
    var gainNode = null;

    // Setup player
    var a = audiojs.createAll({
      play: function() {
        if (tracks.length == 0) {
            // Pause and wait for first track data to load
            audio.pause();
            //$('.spinner').removeClass('hidden');
            setTimeout(function() { audio.play(); }, 1000);
            return;
        }

        // Toggle icon
        $('.fa-play-circle').addClass('hidden');
        $('.fa-pause-circle').removeClass('hidden');

        // Update track info 
        updateTrackInfo();
      },

      pause: function() {
        // Toggle icon
        $('.fa-pause-circle').addClass('hidden');
        $('.fa-play-circle').removeClass('hidden');

      },

      init: function() {
        //$('.spinner').removeClass('hidden');
      },

      loadStarted: function() {
        $('.error-message').addClass('hidden');
        //$('.spinner').addClass('hidden');
      },

      loadProgress: function(percent) {
      },

      trackEnded: function() {
        playNext(false);
      },

      loadError: function() {
        $('.error-message').text('error loading :(');
        $('.error-message').removeClass('hidden');
      }
    });

    var audio = a[0];
    audio.setVolume(volume);
    
    // Load in the first track
    getNextTrack();

    /* =============================================

    Functions

    ============================================= */
    function errorBeep() {
        //only offset the beep volume if the volume is below 10%
        if (volume <= 0.1) {
            //300 hertz for .025 seconds, adding 10% to volume (because it is set very low)
            beepAtFrequencyForTime(300, 0.025, 0.1);//we have to add some to the volume here otherwise it will play at zero volume and be inaudible.
        } else {
            beepAtFrequencyForTime(300, 0.025, 0);
        }
    }

    function beep() {beepAtFrequencyForTime(5555, 0.025, 0);}

//volumeOffset is a quick and dirty hack. there is most likely a better solution out there.
    function beepAtFrequencyForTime(frequency, time, volumeOffset) {
        // the beep! <3 thx musicforprogramming.net
        if(!context) return; // web audio not supported
        oscillator = context.createOscillator();
        oscillator.type = "square";
        oscillator.frequency.value = frequency;
        gainNode = context.createGain()
        gainNode.gain.value = volume*0.1+volumeOffset;
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + time);
    }

    function playNext(skip) {
        audio.pause();

        trackNumber++;

        if (trackNumber > tracks.length) trackNumber = 0;

        audio.load(tracks[trackNumber]['url']);
        audio.play();

        if (skip) {
            ga('send', 'event', 'music', 'skip next track', tracks[trackNumber]['url']);
        } else {
            ga('send', 'event', 'music', 'play next track', tracks[trackNumber]['url']);
        }

        getNextTrack();
    }

    function playPrevious() {
        audio.pause();

        trackNumber--;

        if (trackNumber < 0) trackNumber = 0;
        
        audio.load(tracks[trackNumber]['url']);
        audio.play();

        ga('send', 'event', 'music', 'skip previous track', tracks[trackNumber]['url']);
    }

    function getNextTrack() {
        $.getJSON( "api/tracks.php",  {
            offset: offset,
            timestamp: timestamp,
            channel: selectedChannel
         }, function(data) {

            tracks.push(data);

            // Load if first track
            if (offset == 0) {
                audio.load(data['url']);
                updateTrackInfo();
            }

            offset++;

            // Get next track if loaded first one
            if (offset == 1) {
                getNextTrack();
            }

            if (autoplayNextTrack) {
                audio.play();

                autoplayNextTrack = false;
            }
        });
    }

    function updateTrackInfo() {
        var track = tracks[trackNumber];
        $('.artist').html(track['artist']);
        $('.track-title').html(track['title']);
        $('.permalink a').attr('href', track['permalink']);

        if (track['permalink'] == '' || track['permalink'] === undefined) {
            $('.permalink').hide();
        } else {
            $('permalink').show();
        }
    }

    function increaseVolume() {
        if (volume >= 1) {
            errorBeep();
            return;
        }

        beep();

        volume += .05;

        audio.setVolume(volume);
        console.log(volume);

        ga('send', 'event', 'volume', 'increase', volume);
    }

    function decreaseVolume() {
        //something lower than the lowest possible volume but high enough to catch rounding errors.
        if (volume <= 0.0001) {
            errorBeep();
            return;
        }

        beep();

        volume -= .05

        audio.setVolume(volume);
        console.log(volume);

        ga('send', 'event', 'volume', 'decrease', volume);
    }

   /* =============================================

    Click handlers

    ============================================= */

    $('.play-pause').on('click', function() {
        if (!audio.playing) {
            ga('send', 'event', 'music', 'play', tracks[trackNumber]['url']);
        } else {
            ga('send', 'event', 'music', 'pause', tracks[trackNumber]['url']);
        }

        audio.playPause();
        beep();
    });

    $('.next').on('click', function() {
        playNext(true);
        beep();
    });

    $('.previous').on('click', function() {
        playPrevious();
        beep();
    });

    $('.overlay').on('click', function(event) {
        var target = $(event.target);
        if (target.is('a') || target.is('.donate-crypto-addresses')) {
            return;
        }

        $('.overlay:visible').fadeOut(200);
    });

    $('.permalink a').on('click', function(event) {
        ga('send', 'event', 'track info', 'open link', tracks[trackNumber]['url']);
    });

    $('.btn-now-playing').on('click', function() {
        $('.track-info').fadeIn(200)

        ga('send', 'event', 'track info', 'view', tracks[trackNumber]['url']);
    });

    $('.btn-channels').on('click', function() {
        $('.channel-picker').fadeIn(200);

        ga('send', 'event', 'channels', 'view list', selectedChannel);
    });

    $('.btn-volume-up').on('click', function() {
        increaseVolume();
    });

    $('.btn-volume-down').on('click', function() {
        decreaseVolume()
    });

    $('.channel-picker .channel').on('click', function(event) {
        var channel = $(this).attr('attr-channel');

        if (selectedChannel == channel) {
            beep();
            audio.playPause();
            return;
        }

        beep();

        if (audio.playing) {
            audio.pause();
        }

        $('.channel-picker .channel').each(function(index, element) {
            $(element).removeClass('active');
        });
        $(this).addClass('active');

        selectedChannel = channel;

        // reset
        tracks = [];
        trackNumber = 0;
        offset = 0;
        timestamp = Date.now();

        autoplayNextTrack = true;
        getNextTrack();

        ga('send', 'event', 'channel', 'change', selectedChannel);
    });

    $('.btn-donate').on('click', function() {
        $('.overlay-donate').fadeIn(200);
        ga('send', 'event', 'donate', 'view modal');
    });

    $('a.btn-donate').on('click', function() {
        ga('send', 'event', 'donate', 'click donate button');
    });

    $('a.btn-donate-crypto').on('click', function() {
        $('.donate-crypto-addresses').slideToggle();
        ga('send', 'event', 'links', 'click donate crypto button');
    });

    $('a.twitter').on('click', function() {
        ga('send', 'event', 'links', 'click twitter');
    });

    $('a.iOS').on('click', function() {
        ga('send', 'event', 'links', 'click iOS');
    });

    $('a.android').on('click', function() {
        ga('send', 'event', 'links', 'click android');
    });

    $('a.alexa').on('click', function() {
        ga('send', 'event', 'links', 'click alexa');
    });

    /* =============================================
    
    Keyboard shortcuts

    ============================================= */

    $(document).keydown(function(e) {
      var unicode = e.charCode ? e.charCode : e.keyCode;

      if (unicode == 39) {
        // play next track
        // 39: right arrow

        playNext(true);
        beep();

      } else if (unicode == 37) {
        // play previous track
        // 37: left arrow

        playPrevious();
        beep();

      } else if (unicode == 38) {
        // increase volume
        // 38: up arrow

        increaseVolume();

      } else if (unicode == 40) {
        // decrease volume
        // 40: down arrow

        decreaseVolume();

      } else if (unicode == 32) {
        // pause
        // 32: spacebar
        audio.playPause();
        beep();

      } else if (unicode == 73 || unicode == 84) {
        // track info
        // 73: i 
        // 84: t

        $('.track-info').fadeToggle(200, function() {
            if ($('.track-info').is(':visible')) {
                ga('send', 'event', 'track info', 'view', tracks[trackNumber]['url']);
            }
        });

      } else if (unicode == 80) {
        // channel picker
        // 80: p

        $('.channel-picker').fadeToggle(200, function() {
            if ($('.channel-picker').is(':visible')) {
                ga('send', 'event', 'channel', 'view list', selectedChannel);
            }
        });

      } else if (unicode == 27) {
        // fade out overlay
        // 27: esc

        if ($('.overlay:visible')) {
            $('.overlay:visible').fadeOut(200);
        }

      } else if (unicode == 68 || unicode == 78) {
        // toggle night mode
        // 68: d
        // 78: n

        $('html').toggleClass('night-mode');

        if ($('html').hasClass('night-mode')) {
            ga('send', 'event', 'night mode', 'enable', null);
        } else {
            ga('send', 'event', 'night mode', 'disable', null);
        }
     }
    });
});
