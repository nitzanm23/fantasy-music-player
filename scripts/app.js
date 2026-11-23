/**
 * Fantasy Music Player: app behavior.
 *
 * One <audio> element drives every view. The UI follows the audio element's own events (play,
 * pause, timeupdate, ended) instead of polling, so the mini bar, the full-screen player, the
 * playlist, and the phone's lock screen (Media Session API) always show the same state.
 * Shuffle, repeat, volume, and the last track are saved in localStorage.
 */

(() => {
  // --- Configuration ---
  const CONFIG = Object.freeze({
    CAROUSEL_INTERVAL_MS: 3000,
    RESTART_THRESHOLD_S: 3, // "Previous" restarts the track if it has played longer than this
    SEEK_STEP_S: 10, // lock-screen and headset seek buttons
    STORAGE_KEY: "fantasy-music-player",
    ICON_SPRITE: "./assets/icons/icons.svg",
  });

  const SONGS = window.SONGS ?? [];
  if (SONGS.length === 0) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // --- DOM Cache ---
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const dom = {
    audio: $(".player__audio"),
    home: $(".home"),

    player: $(".player"),
    mini: $(".player__mini"),
    full: $(".player__full"),
    expandButton: $(".player__expand-button"),
    collapseButton: $(".player__collapse-button"),
    miniProgress: $(".player__mini-progress"),

    songFields: $$("[data-song]"),
    toggleButtons: $$('[data-action="toggle"]'),
    shuffleButton: $('[data-action="shuffle"]'),
    repeatButton: $('[data-action="repeat"]'),

    seekBar: $(".player__seek-bar"),
    currentTime: $(".player__current-time"),
    duration: $(".player__duration"),

    volume: $(".player__volume"),
    volumeBar: $(".player__volume-bar"),
    muteButton: $(".player__mute-button"),

    queueButton: $(".player__queue-button"),
    drawer: $(".playlist-drawer"),
    drawerCloseButton: $(".playlist-drawer__close-button"),
    queueList: $(".playlist-drawer__list"),

    aboutButton: $(".home__about-button"),
    aboutSheet: $(".about-sheet"),
    aboutCloseButton: $(".about-sheet__close-button"),

    footerYear: $(".home__year"),

    carousel: $(".hero-carousel"),
    carouselImages: $$(".hero-carousel__image"),
    carouselToggle: $(".hero-carousel__toggle"),
  };

  // --- State ---
  const state = {
    index: 0,
    shuffle: false,
    history: [], // tracks played before the current one, used by "Previous" in shuffle mode
    isExpanded: false,
    isDrawerOpen: false,
  };

  // --- Helpers ---
  /** Formats seconds as m:ss (e.g. 3:09). */
  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    const whole = Math.floor(seconds);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  }

  /** Swaps a button's sprite icon and its screen reader label. */
  function setButtonIcon(button, iconName, label) {
    button
      .querySelector("use")
      .setAttribute("href", `${CONFIG.ICON_SPRITE}#${iconName}`);
    button.querySelector(".sr-only").textContent = label;
  }

  // iOS ignores audio.volume (the hardware buttons control it), so the slider would do nothing.
  function canSetVolume() {
    const probe = new Audio();
    probe.volume = 0.5;
    return probe.volume === 0.5;
  }

  // --- Saved Settings ---
  function loadSettings() {
    try {
      return JSON.parse(window.localStorage.getItem(CONFIG.STORAGE_KEY)) ?? {};
    } catch {
      return {}; // storage blocked (private mode) or corrupted: start with defaults
    }
  }

  function saveSettings() {
    try {
      window.localStorage.setItem(
        CONFIG.STORAGE_KEY,
        JSON.stringify({
          index: state.index,
          shuffle: state.shuffle,
          repeat: dom.audio.loop,
          volume: dom.audio.volume,
          muted: dom.audio.muted,
        }),
      );
    } catch {
      // Saving is a convenience; playback works without it.
    }
  }

  // --- Playlist Drawer Rendering ---
  function renderQueue() {
    dom.queueList.innerHTML = SONGS.map(
      (song, index) => `
        <li>
          <button class="queue-card" type="button" data-index="${index}">
            <img
              class="queue-card__cover"
              src="${song.cover}"
              alt=""
              width="600"
              height="600"
              loading="lazy"
              draggable="false"
            />
            <span class="queue-card__text">
              <span class="queue-card__name">${song.name}</span>
              <span class="queue-card__artist">${song.artist}</span>
            </span>
            <span class="queue-card__equalizer" aria-hidden="true">
              <span></span><span></span><span></span>
            </span>
          </button>
        </li>`,
    ).join("");
  }

  // --- Track Loading ---
  /**
   * Loads a track into the audio element and updates every view.
   * @param {number} index - position in SONGS
   * @param {{ autoplay?: boolean }} [options]
   */
  function loadTrack(index, { autoplay = false } = {}) {
    state.index = (index + SONGS.length) % SONGS.length;
    const song = SONGS[state.index];

    dom.audio.src = song.path;
    resetProgress();

    for (const field of dom.songFields) {
      if (field.dataset.song === "cover") field.src = song.cover;
      else field.textContent = song[field.dataset.song];
    }

    for (const card of dom.queueList.querySelectorAll(".queue-card")) {
      const isCurrent = Number(card.dataset.index) === state.index;
      card.classList.toggle("is-current", isCurrent);
      if (isCurrent) card.setAttribute("aria-current", "true");
      else card.removeAttribute("aria-current");
    }

    updateMediaSession(song);
    saveSettings();
    if (autoplay) play();
  }

  // --- Playback ---
  function play() {
    // play() rejects if the browser blocks it or the track is replaced mid-load; the UI already
    // follows the real state through the play/pause events, so there is nothing else to undo.
    dom.audio.play().catch(() => {});
  }

  function togglePlay() {
    if (dom.audio.paused) play();
    else dom.audio.pause();
  }

  function randomOtherIndex() {
    const offset = 1 + Math.floor(Math.random() * (SONGS.length - 1));
    return (state.index + offset) % SONGS.length;
  }

  function nextTrack() {
    state.history.push(state.index);
    const index =
      state.shuffle && SONGS.length > 1 ? randomOtherIndex() : state.index + 1;
    loadTrack(index, { autoplay: true });
  }

  function previousTrack() {
    if (dom.audio.currentTime > CONFIG.RESTART_THRESHOLD_S) {
      dom.audio.currentTime = 0;
      return;
    }
    const index =
      state.shuffle && state.history.length > 0
        ? state.history.pop()
        : state.index - 1;
    loadTrack(index, { autoplay: true });
  }

  function toggleShuffle() {
    state.shuffle = !state.shuffle;
    state.history = [];
    dom.shuffleButton.setAttribute("aria-pressed", String(state.shuffle));
    saveSettings();
  }

  function toggleRepeat() {
    dom.audio.loop = !dom.audio.loop;
    dom.repeatButton.setAttribute("aria-pressed", String(dom.audio.loop));
    saveSettings();
  }

  // --- Progress ---
  function renderProgress() {
    const { currentTime, duration } = dom.audio;
    const ratio = duration > 0 ? currentTime / duration : 0;

    dom.seekBar.value = String(currentTime);
    dom.seekBar.style.setProperty("--fill", `${ratio * 100}%`);
    dom.seekBar.setAttribute(
      "aria-valuetext",
      `${formatTime(currentTime)} of ${formatTime(duration)}`,
    );
    dom.miniProgress.style.setProperty("--progress", String(ratio));
    dom.currentTime.textContent = formatTime(currentTime);
  }

  function resetProgress() {
    dom.seekBar.max = "0";
    dom.duration.textContent = "0:00";
    renderProgress();
  }

  function renderDuration() {
    dom.seekBar.max = String(dom.audio.duration);
    dom.duration.textContent = formatTime(dom.audio.duration);
    renderProgress();
  }

  function renderPlayState() {
    const isPlaying = !dom.audio.paused;
    for (const button of dom.toggleButtons) {
      setButtonIcon(
        button,
        isPlaying ? "pause" : "play",
        isPlaying ? "Pause" : "Play",
      );
    }
    dom.player.classList.toggle("is-playing", isPlaying);
    dom.queueList.classList.toggle("is-playing", isPlaying);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }

  // --- Volume ---
  function renderVolume() {
    const { volume, muted } = dom.audio;
    const isSilent = muted || volume === 0;

    dom.volumeBar.value = String(volume);
    dom.volumeBar.style.setProperty("--fill", `${(muted ? 0 : volume) * 100}%`);
    dom.muteButton.setAttribute("aria-pressed", String(muted));
    setButtonIcon(
      dom.muteButton,
      isSilent ? "volume-xmark" : "volume-high",
      "Mute",
    );
  }

  // --- Views: full-screen player, playlist drawer ---
  // Only the visible layer can be reached with Tab or a screen reader.
  function updateInert() {
    dom.home.inert = state.isExpanded;
    dom.mini.inert = state.isExpanded;
    dom.full.inert = !state.isExpanded || state.isDrawerOpen;
    dom.drawer.inert = !state.isDrawerOpen;
  }

  function setExpanded(isExpanded) {
    state.isExpanded = isExpanded;
    dom.player.classList.toggle("is-expanded", isExpanded);
    dom.expandButton.setAttribute("aria-expanded", String(isExpanded));
    updateInert();
    (isExpanded ? dom.collapseButton : dom.expandButton).focus({
      preventScroll: true,
    });
  }

  function setDrawerOpen(isOpen) {
    state.isDrawerOpen = isOpen;
    dom.drawer.classList.toggle("is-open", isOpen);
    dom.queueButton.setAttribute("aria-expanded", String(isOpen));
    updateInert();
    if (isOpen) {
      const target =
        dom.queueList.querySelector(".is-current") ?? dom.drawerCloseButton;
      target.focus({ preventScroll: true });
    } else {
      dom.queueButton.focus({ preventScroll: true });
    }
  }

  // --- Hero Carousel ---
  function initCarousel() {
    const images = dom.carouselImages;
    if (images.length < 2 || reducedMotion.matches) return;

    let current = 0;
    let isPausedByUser = false;
    let isPausedByPointer = false;

    // WCAG 2.2.2: anything that moves on its own for over 5 seconds needs a pause control.
    dom.carouselToggle.hidden = false;

    window.setInterval(() => {
      if (isPausedByUser || isPausedByPointer || document.hidden) return;
      images[current].classList.remove("is-active");
      current = (current + 1) % images.length;
      images[current].classList.add("is-active");
    }, CONFIG.CAROUSEL_INTERVAL_MS);

    dom.carouselToggle.addEventListener("click", () => {
      isPausedByUser = !isPausedByUser;
      dom.carouselToggle.setAttribute("aria-pressed", String(isPausedByUser));
      setButtonIcon(
        dom.carouselToggle,
        isPausedByUser ? "play" : "pause",
        isPausedByUser ? "Play slideshow" : "Pause slideshow",
      );
    });

    dom.carousel.addEventListener(
      "pointerenter",
      () => (isPausedByPointer = true),
    );
    dom.carousel.addEventListener(
      "pointerleave",
      () => (isPausedByPointer = false),
    );
  }

  // --- Media Session (lock screen, notification, headset buttons) ---
  function updateMediaSession(song) {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.name,
      artist: song.artist,
      album: "Fantasy Music Player",
      artwork: [
        {
          src: new URL(song.cover, document.baseURI).href,
          sizes: "600x600",
          type: "image/webp",
        },
      ],
    });
  }

  function initMediaSession() {
    if (!("mediaSession" in navigator)) return;
    const { audio } = dom;
    const handlers = {
      play,
      pause: () => audio.pause(),
      previoustrack: previousTrack,
      nexttrack: nextTrack,
      seekbackward: () =>
        (audio.currentTime = Math.max(
          audio.currentTime - CONFIG.SEEK_STEP_S,
          0,
        )),
      seekforward: () =>
        (audio.currentTime = Math.min(
          audio.currentTime + CONFIG.SEEK_STEP_S,
          audio.duration || 0,
        )),
      seekto: ({ seekTime }) => (audio.currentTime = seekTime),
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Older browsers throw for actions they do not support.
      }
    }
  }

  // --- Events ---
  function wireEvents() {
    const { audio } = dom;

    audio.addEventListener("loadedmetadata", renderDuration);
    audio.addEventListener("timeupdate", renderProgress);
    audio.addEventListener("play", renderPlayState);
    audio.addEventListener("pause", renderPlayState);
    audio.addEventListener("volumechange", () => {
      renderVolume();
      saveSettings();
    });
    // With repeat on, audio.loop restarts the track and "ended" never fires.
    audio.addEventListener("ended", nextTrack);

    for (const button of dom.toggleButtons)
      button.addEventListener("click", togglePlay);
    $('[data-action="next"]').addEventListener("click", nextTrack);
    $('[data-action="previous"]').addEventListener("click", previousTrack);
    dom.shuffleButton.addEventListener("click", toggleShuffle);
    dom.repeatButton.addEventListener("click", toggleRepeat);

    dom.seekBar.addEventListener("input", () => {
      audio.currentTime = Number(dom.seekBar.value);
      renderProgress();
    });

    dom.volumeBar.addEventListener("input", () => {
      audio.volume = Number(dom.volumeBar.value);
      audio.muted = audio.volume === 0;
    });
    dom.muteButton.addEventListener("click", () => {
      audio.muted = !audio.muted;
      if (!audio.muted && audio.volume === 0) audio.volume = 0.5;
    });

    dom.expandButton.addEventListener("click", () => setExpanded(true));
    dom.collapseButton.addEventListener("click", () => setExpanded(false));
    dom.queueButton.addEventListener("click", () => setDrawerOpen(true));
    dom.drawerCloseButton.addEventListener("click", () => setDrawerOpen(false));

    dom.queueList.addEventListener("click", (event) => {
      const card = event.target.closest(".queue-card");
      if (!card) return;
      const index = Number(card.dataset.index);
      if (index === state.index) togglePlay();
      else {
        state.history.push(state.index);
        loadTrack(index, { autoplay: true });
      }
    });

    dom.aboutButton.addEventListener("click", () => dom.aboutSheet.showModal());
    dom.aboutCloseButton.addEventListener("click", () =>
      dom.aboutSheet.close(),
    );
    // A tap on the dimmed backdrop lands on the <dialog> element itself.
    dom.aboutSheet.addEventListener("click", (event) => {
      if (event.target === dom.aboutSheet) dom.aboutSheet.close();
    });

    document.addEventListener("keydown", (event) => {
      if (dom.aboutSheet.open) return; // <dialog> handles its own Escape key

      if (event.key === "Escape") {
        if (state.isDrawerOpen) setDrawerOpen(false);
        else if (state.isExpanded) setExpanded(false);
        return;
      }

      // Space plays and pauses, unless it is already doing something for the focused control.
      const isInteractive = event.target.closest(
        "button, a, input, textarea, select",
      );
      if (event.key === " " && !isInteractive) {
        event.preventDefault();
        togglePlay();
      }
    });
  }

  // --- Init ---
  function init() {
    const saved = loadSettings();

    dom.footerYear.textContent = String(new Date().getFullYear());
    renderQueue();
    wireEvents();
    initMediaSession();
    initCarousel();

    if (canSetVolume()) {
      dom.audio.volume = Number.isFinite(saved.volume) ? saved.volume : 1;
      dom.audio.muted = saved.muted === true;
    } else {
      dom.volume.hidden = true;
    }
    if (saved.repeat === true) toggleRepeat();
    if (saved.shuffle === true) toggleShuffle();

    const savedIndex = Number.isInteger(saved.index) ? saved.index : 0;
    loadTrack(savedIndex);
    renderPlayState();
    renderVolume();
    updateInert();
  }

  init();
})();
