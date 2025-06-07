function saveOptions(e) {
	e.preventDefault();

	chrome.storage.sync.set({
		trademark: document.querySelector("#trademark").checked,
	});
}

function restoreOptions() {
	function setCurrentChoice(result) {
		document.querySelector("#trademark").checked = result.trademark || false;
	}

	function onError(error) {
		console.log(`Error: ${error}`);
	}

	let tm = chrome.storage.sync.get("trademark");
	tm.then(setCurrentChoice, onError);
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions)