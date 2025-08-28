// login.js
// programming for login page

import { ribbons, getCredentials } from "./pacmacro.js";

window.onload = () => {
	ribbons();

	let ID = document.getElementById("login-id");
	ID.value = getCredentials().ID;
	let submit_button = document.getElementById("login-submit");

	submit_button.onclick = () => {
		window.location.href = `/?id=${ID.value}`; // go to index
	};
}
