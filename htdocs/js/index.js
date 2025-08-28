// index.js
// programming for the lobby and PacMacro game

import {
	ribbons,
	EXPAND_X, EXPAND_Y,
	pacmacro_init,
	connectWS,
	watchLocation,
	convertCoords,
	NREPS,
	getCredentials,
	reps,
} from "./pacmacro.js";

window.onload = async () => {
	ribbons();
	// reset globals
	pacmacro_init();

	let self_summary = document.getElementById("self-summary");
	let pacmacro_status = document.getElementById("pacmacro-status");
	let pacmacro_canvas = document.getElementById("pacmacro-canvas");
	let pass = ""; // received upon window.prompt(...)

	pacmacro_status.style.visibility = "hidden"; // hides debug

	try {
		let pacmacro_map = await fetch("/api/game/map.json");
		window.pacmacro_map = await pacmacro_map.json();
	} catch {
		pacmacro_status.innerHTML = "Error: Couldn't receive map information.";
		window.pacmacro_ws.close(); // close websocket connection
		return; // do not proceed
	}

	window.pacmacro_ctx = pacmacro_canvas.getContext("2d");
	// set canvas size as per window.pacmacro_map
	window.pacmacro_ctx.canvas.width = window.pacmacro_map.width * EXPAND_X;
	window.pacmacro_ctx.canvas.height = window.pacmacro_map.height * EXPAND_Y;
	window.pacmacro_ctx.font = "16pt sans-serif";

	let pacmacro_draw = () => {
		console.log("draw");

		if (window.pacmacro_ctx === undefined)
			return;

		// fill canvas with map drawing
		window.pacmacro_ctx.drawImage(
		        window.pacmacro_img_map, 0, 0,
		        window.pacmacro_ctx.canvas.width,
		        window.pacmacro_ctx.canvas.height);

		// render each player
		Object.keys(window.pacmacro_players).forEach((ID,i) => {
			console.log("---- DRAWING ----");

			const p = window.pacmacro_players[ID];
			if (p.player.type == 3) // TypeHidden
				return;
			let img, text;

			console.log(p);

			if (p.player.type == 1) {
				if (p.player.reps == 1) {
					img = window.pacmacro_img_coin;
				} else {
					img = window.pacmacro_img_leader;
				}
			} else {
				switch (p.player.reps) {
				case 1: // pacman
					img = window.pacmacro_img_pacman;
					break;
				case 2: // antipac
					img = window.pacmacro_img_anti;
					break;
				case 3: // ghost
					img = window.pacmacro_img_ghost;
					break;
				case 4: // edible
					img = window.pacmacro_img_edible;
					break;
				default: // nothing; watcher; error
					return;
				}
			}

			window.pacmacro_ctx.drawImage(img,
				p.plot.x * EXPAND_X - 48,
				p.plot.y * EXPAND_Y - 88,
				96, 96);
			window.pacmacro_ctx.textAlign = "center";
			window.pacmacro_ctx.fillStyle = "#ffffff";

			if (ID == window.pacmacro_ID) {
				text = `${p.player.name} (You)`;
			} else {
				text = `${p.player.name} (${ID})`;
			}

			console.log(p.plot);

			window.pacmacro_ctx.fillText(text,
				p.plot.x * EXPAND_X,
				p.plot.y * EXPAND_Y - 112);
		});
	};

	let pacmacro_open = async () => {
		// send password to authenticate player
		window.pacmacro_ws.send(pass);

		watchLocation((p) => {
			let coordinate = {
				"latitude": p.coords.latitude,
				"longitude": p.coords.longitude
			};

			window.pacmacro_ws.send(JSON.stringify(coordinate));
		});

		pacmacro_status.innerHTML = "Good to go.";
	};

	let pacmacro_redirect = () => {
		// window.location.href = "/login";
	};

	let pacmacro_recv = (e) => {
		let msg = JSON.parse(e.data);
		console.log(`COMMAND: ${msg.command}`);
		console.log(`DATA: ${msg.data}`);

		if (msg.command === undefined)
			return; // invalid message

		if (msg.command == "inform") {
			let plot = convertCoords(window.pacmacro_map,
				msg.coordinate.latitude, msg.coordinate.longitude);
			const p = JSON.parse(msg.data);

			if (p.id === undefined)
				return; // invalid

			// set player
			window.pacmacro_players[p.id] = {
				"plot": plot,
				"player": p
			};

			if (p.id == window.pacmacro_ID) {
				self_summary.innerHTML =
					`${p.name} (${p.id}) is ${reps(p.reps)}`;
			}
		} else
		if (msg.command == "move") {
			console.log("moving");
			const p = window.pacmacro_players[msg.data]; // data is ID

			if (p === undefined)
				return; // invalid

			// update plot
			p.plot = convertCoords(window.pacmacro_map,
				msg.coordinate.latitude, msg.coordinate.longitude);
		}

		// write server message to status element
		pacmacro_status.innerHTML = e.data;
		pacmacro_draw(); // re-draw the map; maybe there was a player update
	};

	const params = new URLSearchParams(window.location.search);

	const { ID, password } = getCredentials();

	if (ID.length == 0 || password.length == 0) {
		window.location.href = '/register';
		return;
	}

	pass = password;
	window.pacmacro_ID = ID;

	connectWS(ID,
		pacmacro_open, // on open
		pacmacro_redirect, // on close
		pacmacro_redirect, // on error
		pacmacro_recv); // on message
}
