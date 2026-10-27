// Settings for where the game is published. On a server started with tools/server.js the server fills these in from its
// environment (SERVER_URL, GOOGLE_CLIENT_ID); on a static host such as GitHub Pages, write them here.
//   server:         the multiplayer server the game offers first, e.g. 'my-server.onrender.com' (empty: the page's own host)
//   googleClientId: an OAuth client ID ("웹 애플리케이션") from console.cloud.google.com for "Google로 로그인"
var NEMO_CONFIG = window.NEMO_CONFIG || { server: '', googleClientId: '' };
