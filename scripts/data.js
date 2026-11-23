/**
 * Fantasy Music Player: track list.
 *
 * Kept apart from app.js so tracks can be added, renamed, or reordered without touching the
 * player logic. The order here is the playlist order.
 *
 * Music: Tanner Helland, CC BY 4.0 (https://github.com/tannerhelland/free-music).
 * Cover art: original artwork made for this project.
 */

/**
 * @typedef {object} Song
 * @property {string} name
 * @property {string} artist
 * @property {string} path  - MP3 file, relative to index.html
 * @property {string} cover - square cover image, relative to index.html
 */

/** @type {ReadonlyArray<Readonly<Song>>} */
window.SONGS = Object.freeze(
  [
    {
      name: "Daybreak",
      artist: "Tanner Helland",
      path: "./assets/audio/daybreak.mp3",
      cover: "./assets/images/covers/daybreak.webp",
    },
    {
      name: "A Memory Away",
      artist: "Tanner Helland",
      path: "./assets/audio/a-memory-away.mp3",
      cover: "./assets/images/covers/a-memory-away.webp",
    },
    {
      name: "The Forest Awakes",
      artist: "Tanner Helland",
      path: "./assets/audio/the-forest-awakes.mp3",
      cover: "./assets/images/covers/the-forest-awakes.webp",
    },
    {
      name: "From Here",
      artist: "Tanner Helland",
      path: "./assets/audio/from-here.mp3",
      cover: "./assets/images/covers/from-here.webp",
    },
    {
      name: "Syntheticity",
      artist: "Tanner Helland",
      path: "./assets/audio/syntheticity.mp3",
      cover: "./assets/images/covers/syntheticity.webp",
    },
    {
      name: "Destiny",
      artist: "Tanner Helland",
      path: "./assets/audio/destiny.mp3",
      cover: "./assets/images/covers/destiny.webp",
    },
    {
      name: "Familiar Roads",
      artist: "Tanner Helland",
      path: "./assets/audio/familiar-roads.mp3",
      cover: "./assets/images/covers/familiar-roads.webp",
    },
    {
      name: "Lost Islands",
      artist: "Tanner Helland",
      path: "./assets/audio/lost-islands.mp3",
      cover: "./assets/images/covers/lost-islands.webp",
    },
  ].map((song) => Object.freeze(song)),
);
