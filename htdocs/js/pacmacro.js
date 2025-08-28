// pacmacro.js
// general programming for all pages

var WS       = "ws"; // change to "wss" in production
var URL_ROOT = "localhost:8000"; // must be root domain of server hosting API
var EXPAND_X = 32;
var EXPAND_Y = 32;

/* GLOBALS
 * window.pacmacro_set_ws  : Admin; setting map minimum and maximum latitude and longitude values
 * window.pacmacro_ws      : websocket connection to API for lobby or PacMacro game
 * window.pacmacro_geo     : geolocation value associated with current watch function
 * window.pacmacro_ctx     : canvas API 2d context for drawing PacMacro game
 * window.pacmacro_map     : PacMacro map information (JSON; /api/game/map.json)
 */

function ribbons() {
	document.body.innerHTML = `
		<header>
			<!-- thumbnails -->
			<img onload="this.remove()" class="top-grid" src="static/flag_grid_t.png" alt="(grid)">
			<img onload="this.remove()" class="bottom-grid" src="static/flag_grid_t.png" alt="(grid)">

			<img class="top-grid" src="static/flag_grid.png" alt="">
			<img class="bottom-grid" src="static/flag_grid.png" alt="">

			<img class="pacmacro-logo" src="static/pacmacro.svg" alt="PacMacro">
		</header>
		<!--
		<footer>
			<img class="frosh-logo" src="static/frosh.png" alt="CSSS RETRO FROSH 2023">
		</footer>
		-->
		${document.body.innerHTML}
	`;
}

// init pacmacro
function pacmacro_init() {
	// undefine globals
	window.pacmacro_set_ws = undefined;
	window.pacmacro_ws     = undefined;
	window.pacmacro_geo    = undefined;
	window.pacmacro_ctx    = undefined;
	window.pacmacro_map    = undefined;

	window.pacmacro_players = {}; // prepare player map

	// load images (for the canvas)
	window.pacmacro_img_map             = new Image(EXPAND_X, EXPAND_Y);
	window.pacmacro_img_map.src         = "static/game/map.svg";
	window.pacmacro_img_pacman          = new Image(96, 96);
	window.pacmacro_img_pacman.src      = "static/game/pacman.png";
	window.pacmacro_img_pacman_flag     = new Image(96, 96);
	window.pacmacro_img_pacman_flag.src = "static/game/pacman_flag.png";
	window.pacmacro_img_anti            = new Image(96, 96);
	window.pacmacro_img_anti.src        = "static/game/anti_pacman.png";
	window.pacmacro_img_ghost           = new Image(96, 96);
	window.pacmacro_img_ghost.src       = "static/game/ghost.png";
	window.pacmacro_img_edible          = new Image(96, 96);
	window.pacmacro_img_edible.src      = "static/game/edible.png";
	window.pacmacro_img_coin            = new Image(96, 96);
	window.pacmacro_img_coin.src        = "static/game/coin.png";
	window.pacmacro_img_leader          = new Image(96, 96);
	window.pacmacro_img_leader.src      = "static/game/leader.png";
}

// save credentials
function saveCredentials(ID, password) {
	document.cookie = `id=${ID}`;
	document.cookie = `password=${password}`;
}

// get player ID from cookies
function getCredentials() {
	let ID = "", password = "1234";

	let cookies = document.cookie;
	cookies = cookies.split(';').map(v => v.split('='));

	for (const c of cookies) {
		if (c[0].trim() == "id")
			ID = c[1];

		if (c[0].trim() == "password")
			password = c[1];
	}

	return { ID, password };
}

// connect to websocket as player
function connectWS(ID, onopen, onclose, onerror, onmessage) {
	// calling function should run connectWS in a try-catch block
	window.pacmacro_ws = new WebSocket(`${WS}://${URL_ROOT}/api/ws/${ID}`);
	window.pacmacro_ws.onopen = onopen;
	window.pacmacro_ws.onclose = onclose;
	window.pacmacro_ws.onerror = onerror;
	window.pacmacro_ws.onmessage = onmessage;
}

// watch location of user; run update_func on each update
function watchLocation(update_func) {
	if ("geolocation" in navigator) {
		// check if watchLocation was previously run;
		// if yes, stop watching location.
		if (window.pacmacro_geo !== undefined)
			navigator.geolocation.clearWatch(window.pacmacro_geo);

		// start watching location
		window.pacmacro_geo = navigator.geolocation.watchPosition(
			// on each update...
			update_func,
			// in the event of an error...
			(e) => { console.log(`watchLocation error: ${e}.`) },
			// watch options
			{
				maximumAge: 0, // don't stop watching
				timeout: 5000,
				enableHighAccuracy: true
			}
		);
	} else {
		return false;
	}

	return true;
}

function stopWatchLocation() {
	if (navigator.geolocation !== undefined &&
		window.pacmacro_geo !== undefined)
		navigator.geolocation.clearWatch(window.pacmacro_geo);

	window.pacmacro_geo = undefined;
}

function convertCoords(map, lat, lon) {
	let plot = {
		x: 0,
		y: 0
	};

	let dlat = map.max.latitude - map.min.latitude;
	let dlon = map.max.longitude - map.min.longitude;

	// denominator cannot be zero
	if (dlat == 0 || dlon == 0)
		return plot;

	plot.x = ((lon - map.min.longitude) / dlon) * map.width;
	plot.y = ((lat - map.min.latitude) / dlat) * map.height;
	plot.y = map.height - plot.y;

	console.log(`[${lat}, ${lon}] => [${plot.x}, ${plot.y}`);

	return plot;
}

var NREPS = 5;
var NTYPE = 4;

function reps(n) {
	switch (n) {
	case 0:  return "Nothing"; break;
	case 1:  return "Pacman";  break;
	case 2:  return "Antipac"; break;
	case 3:  return "Ghost";   break;
	case 4:  return "Edible";  break;
	default: return "Error";   break;
	}
}

function type(n) {
	switch (n) {
	case 0:  return "Froshee"; break;
	case 1:  return "Leader";  break;
	case 2:  return "Admin";   break;
	case 3:  return "Hidden";  break;
	default: return "Error";   break;
	}
}

export {
	WS,
	URL_ROOT,
	EXPAND_X, EXPAND_Y,
	ribbons,
	pacmacro_init,
	saveCredentials,
	getCredentials,
	connectWS,
	watchLocation,
	stopWatchLocation,
	convertCoords,
	NREPS,
	NTYPE,
	reps,
	type
};
