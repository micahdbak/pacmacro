// register.js
// programming for the Player Registration page (register.html)

import { saveCredentials, ribbons } from "./pacmacro.js";

window.onload = () => {
	ribbons();

	let submit_button = document.getElementById("register-submit");

	submit_button.onclick = async () => {
		let type = document.getElementById("register-type").value;
		let name = document.getElementById("register-name").value;
		let stat = document.getElementById("register-status");
		let pass = "1234";

		let form = new FormData;
		form.append("type", type);
		form.append("name", name);
		form.append("pass", pass);

		let ID;

		try {
			ID = await fetch("/api/player/register", {
				method: "POST",
				body: form
			});
		} catch {
			stat.innerHTML = "Couldn't contact API.";
			return;
		}

		if (!ID.ok) {
			stat.innerHTML = `Error ${ID.status}`;
			return;
		}

		ID = await ID.text();
		saveCredentials(ID, pass); // save ID in cookies
		window.location.href = '/'; // go to index
	};
}
