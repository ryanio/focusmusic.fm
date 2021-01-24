$(() => {
  /* =============================================
    Init
    ============================================= */
  const CHANNEL_KEY = "channel";
  const THEME_KEY = "theme";
  const VOLUME_KEY = "volume";

  let timestamp = Date.now();
  let trackNumber = 0;
  let tracks = [];
  let offset = 0;
  let selectedChannel = readFromLocalStorage(CHANNEL_KEY) || "electronic";
  let autoplayNextTrack = false;
  let volume = parseFloat(readFromLocalStorage(VOLUME_KEY)) || 0.5;

  // Init vars for beep()
  const context = new (window.AudioContext ??
    window.webkitAudioContext ??
    false)();
  let oscillator = null;
  let gainNode = null;

  // Setup player
  const a = audiojs.createAll({
    play: () => {
      if (tracks.length == 0) {
        // Pause and wait for first track data to load
        audio.pause();
        //$('.spinner').removeClass('hidden');
        setTimeout(() => {
          audio.play();
        }, 1000);
        return;
      }

      // Toggle icon
      $(".fa-play-circle").addClass("hidden");
      $(".fa-pause-circle").removeClass("hidden");

      // Update track info
      updateTrackInfo();

      // Update MediaSession
      if (hasMediaSession()) {
        navigator.mediaSession.playbackState = "playing";
      }
    },

    pause: () => {
      // Toggle icon
      $(".fa-pause-circle").addClass("hidden");
      $(".fa-play-circle").removeClass("hidden");

      // Update MediaSession
      if (hasMediaSession()) {
        navigator.mediaSession.playbackState = "paused";
      }
    },

    init: () => {
      //$('.spinner').removeClass('hidden');
    },

    loadStarted: () => {
      $(".error-message").addClass("hidden");
      //$('.spinner').addClass('hidden');
    },

    loadProgress: percent => {},

    trackEnded: () => {
      playNext(false);
    },

    loadError: () => {
      $(".error-message").text("error loading :(");
      $(".error-message").removeClass("hidden");

      // Update MediaSession
      if (hasMediaSession()) {
        navigator.mediaSession.playbackState = "none";
      }
    }
  });

  const audio = a[0];
  audio.setVolume(volume);

  // Load in the first track
  getNextTrack();
  setInitialTheme();

  /* =============================================
    Functions
    ============================================= */

  function errorBeep() {
    // only offset the beep volume if the volume is below 10%
    if (volume <= 0.1) {
      // 300 hertz for .025 seconds, adding 10% to volume (because it is set very low)
      beepAtFrequencyForTime(300, 0.025, 0.1); // we have to add some to the volume here otherwise it will play at zero volume and be inaudible.
    } else {
      beepAtFrequencyForTime(300, 0.025, 0);
    }
  }

  function beep() {
    beepAtFrequencyForTime(5555, 0.025, 0);
  }

  // volumeOffset is a quick and dirty hack. there is most likely a better solution out there.
  function beepAtFrequencyForTime(frequency, time, volumeOffset) {
    // the beep! <3 thx musicforprogramming.net
    if (!context) return; // web audio not supported
    oscillator = context.createOscillator();
    oscillator.type = "square";
    oscillator.frequency.value = frequency;
    gainNode = context.createGain();
    gainNode.gain.value = volume * 0.1 + volumeOffset;
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + time);
  }

  function playNext(skip) {
    audio.pause();

    trackNumber++;

    if (trackNumber > tracks.length) trackNumber = 0;

    audio.load(tracks[trackNumber].url);
    audio.play();

    if (skip) {
      ga("send", "event", "music", "skip next track", tracks[trackNumber].url);
    } else {
      ga("send", "event", "music", "play next track", tracks[trackNumber].url);
    }

    getNextTrack();
  }

  function playPrevious() {
    audio.pause();

    trackNumber--;

    if (trackNumber < 0) trackNumber = 0;

    audio.load(tracks[trackNumber].url);
    audio.play();

    ga(
      "send",
      "event",
      "music",
      "skip previous track",
      tracks[trackNumber].url
    );
  }

  function getNextTrack() {
    $.getJSON(
      "api/tracks.php",
      {
        offset,
        timestamp,
        channel: selectedChannel
      },
      data => {
        tracks.push(data);

        // Load if first track
        if (offset == 0) {
          audio.load(data.url);
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
      }
    );
  }

  function updateTrackInfo() {
    const track = tracks[trackNumber];
    const { artist, title, permalink } = track;
    $(".artist").html(artist);
    $(".track-title").html(title);
    $(".permalink a").attr("href", permalink);

    if (permalink == "" || permalink === undefined) {
      $(".permalink").hide();
    } else {
      $("permalink").show();
    }

    // Update MediaSession
    if (hasMediaSession()) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist
      });
    }
  }

  function increaseVolume() {
    if (volume >= 1) {
      errorBeep();
      return;
    }

    beep();

    volume += 0.05;

    audio.setVolume(volume);
    saveToLocalStorage(VOLUME_KEY, volume);
    console.log(`New volume: ${volume}`);
  }

  function decreaseVolume() {
    // something lower than the lowest possible volume but high enough to catch rounding errors.
    if (volume <= 0.0001) {
      errorBeep();
      return;
    }

    beep();

    volume -= 0.05;

    audio.setVolume(volume);
    saveToLocalStorage(VOLUME_KEY, volume);
    console.log(`New volume: ${volume}`);
  }

  function toggleNightMode() {
    $("html").toggleClass("night-mode");

    if ($("html").hasClass("night-mode")) {
      ga("send", "event", "night mode", "enable", null);
      saveToLocalStorage(THEME_KEY, "night-mode");
    } else {
      ga("send", "event", "night mode", "disable", null);
      removeFromLocalStorage(THEME_KEY);
    }
    $(".btn-toggle-night-mode")
      .find("i")
      .toggleClass("fa-sun-o")
      .toggleClass("fa-moon-o");
  }
  function hasLocalStorage() {
    return (
      typeof window.localStorage === "object" &&
      typeof window.localStorage.setItem === "function"
    );
  }

  function saveToLocalStorage(key, value) {
    if (!hasLocalStorage()) return;
    window.localStorage.setItem(key, value);
  }

  function readFromLocalStorage(key) {
    if (!hasLocalStorage()) return;
    return window.localStorage.getItem(key);
  }

  function removeFromLocalStorage(key) {
    if (!hasLocalStorage()) return;
    return window.localStorage.removeItem(key);
  }
  function setInitialTheme() {
    const theme = readFromLocalStorage(THEME_KEY);
    if (theme === "night-mode") {
      $("html").addClass("night-mode");
      $(".btn-toggle-night-mode")
        .find("i")
        .toggleClass("fa-sun-o")
        .toggleClass("fa-moon-o");
    }
  }
  function hasMediaSession() {
    return (
      "mediaSession" in window.navigator &&
      typeof window.navigator.mediaSession === "object"
    );
  }

  /* =============================================
    Click handlers
    ============================================= */

  $(".play-pause").on("click", () => {
    if (!audio.playing) {
      ga("send", "event", "music", "play", tracks[trackNumber].url);
    } else {
      ga("send", "event", "music", "pause", tracks[trackNumber].url);
    }
    audio.playPause();
    beep();
  });

  $(".next").on("click", () => {
    playNext(true);
    beep();
  });

  $(".previous").on("click", () => {
    playPrevious();
    beep();
  });

  $(".overlay").on("click", event => {
    const target = $(event.target);
    if (target.is("a") || target.is(".donate-crypto-addresses")) {
      return;
    }
    $(".overlay:visible").fadeOut(200);
  });

  $(".permalink a").on("click", event => {
    ga("send", "event", "track info", "open link", tracks[trackNumber].url);
  });

  $(".btn-now-playing").on("click", () => {
    $(".track-info").fadeIn(200);
    ga("send", "event", "track info", "view", tracks[trackNumber].url);
  });

  $(".btn-channels").on("click", () => {
    $(".channel-picker").fadeIn(200);
    ga("send", "event", "channels", "view list", selectedChannel);
  });

  $(".btn-volume-up").on("click", () => {
    increaseVolume();
  });

  $(".btn-volume-down").on("click", () => {
    decreaseVolume();
  });

  $(".channel-picker .channel").on("click", (event) => {
    const channel = $(event.target).attr("attr-channel");

    if (selectedChannel == channel) {
      beep();
      audio.playPause();
      return;
    }

    beep();

    if (audio.playing) {
      audio.pause();
    }

    $(".channel-picker .channel").each((index, element) => {
      $(element).removeClass("active");
    });
    $(event.target).addClass("active");

    selectedChannel = channel;
    saveToLocalStorage(CHANNEL_KEY, channel);

    // reset
    tracks = [];
    trackNumber = 0;
    offset = 0;
    timestamp = Date.now();

    autoplayNextTrack = true;
    getNextTrack();

    ga("send", "event", "channel", "change", selectedChannel);
  });

  $(".btn-toggle-night-mode").on("click", () => {
    toggleNightMode();
  });

  $(".btn-show-keyboard-shortcuts").on("click", () => {
    $(".overlay-keyboard-shortcuts").fadeIn(200);
  });

  $(".btn-donate").on("click", () => {
    $(".overlay-donate").fadeIn(200);
    ga("send", "event", "donate", "view modal");
  });

  $("a.btn-donate").on("click", () => {
    ga("send", "event", "donate", "click donate button");
  });

  $("a.btn-donate-crypto").on("click", () => {
    $(".donate-crypto-addresses").slideToggle();
    ga("send", "event", "links", "click donate crypto button");
  });

  $("a.twitter").on("click", () => {
    ga("send", "event", "links", "click twitter");
  });

  $("a.iOS").on("click", () => {
    ga("send", "event", "links", "click iOS");
  });

  $("a.android").on("click", () => {
    ga("send", "event", "links", "click android");
  });

  $("a.alexa").on("click", () => {
    ga("send", "event", "links", "click alexa");
  });

  /* =============================================
    Keyboard shortcuts
    ============================================= */

  $(document).keydown(e => {
    const unicode = e.charCode ? e.charCode : e.keyCode;

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
      $(".track-info").fadeToggle(200, () => {
        if ($(".track-info").is(":visible")) {
          ga("send", "event", "track info", "view", tracks[trackNumber].url);
        }
      });
    } else if (unicode == 80) {
      // channel picker
      // 80: p
      $(".channel-picker").fadeToggle(200, () => {
        if ($(".channel-picker").is(":visible")) {
          ga("send", "event", "channel", "view list", selectedChannel);
        }
      });
    } else if (unicode == 27) {
      // fade out overlay
      // 27: esc
      if ($(".overlay:visible")) {
        $(".overlay:visible").fadeOut(200);
      }
    } else if (unicode == 68 || unicode == 78) {
      // toggle night mode
      // 68: d
      // 78: n
      toggleNightMode();
    }
  });

  /* =============================================
    Media keys
    ============================================= */

  if (hasMediaSession()) {
    const actionHandlers = [
      [
        "play",
        () => {
          audio.playPause();
          beep();
        }
      ],
      [
        "pause",
        () => {
          audio.playPause();
          beep();
        }
      ],
      [
        "previoustrack",
        () => {
          playPrevious();
          beep();
        }
      ],
      [
        "nexttrack",
        () => {
          playNext(true);
          beep();
        }
      ],
      [
        "stop",
        () => {
          audio.playPause();
          beep();
        }
      ]
    ];

    for (const [action, handler] of actionHandlers) {
      try {
        window.navigator.mediaSession.setActionHandler(action, handler);
      } catch (error) {
        console.warn(`The media session action is not supported: ${action}`);
      }
    }
  }
});
