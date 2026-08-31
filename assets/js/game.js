// Published Google Sheet CSV URL for Wordle scores
const GOOGLE_SHEET_SCORES_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzzNg3HDQK3vUKpEnIwOREwa-SeRIcfYoECkL1qwivnChSUy5xrI7vE8Gpipuo_TxX6YDerL97rfGG/pub?gid=721541678&single=true&output=csv";

let fullList;
let currentRow = 0;
let nextRowBlock = 0;
let score = 0;
let remNotification = 0;
let gameFin = 0;
let gameOn = 0;
let maxBlock = 5;
let mode = 'easy'; // 'easy' = 5 letter words, 'long' = 7 letter words
let difficulty = 'easy'; // guess-validation difficulty (easy / difficult)
let mustUse = '';
let currentStreak = 0;
let userScore = 0;
let gameStartTime = null;
let chosenWord = ''; // Formally declared to prevent strict-mode reference errors
let username = ''; // Store entered username

const countOccurrences = (arr, val) => arr.reduce((a, v) => (v === val ? a + 1 : a), 0);

let container = document.createElement('div');
container.id = 'container';
document.body.append(container);

startMenu();

/* ---------------- CSV Leaderboard Helpers ---------------- */

function formatTime(seconds) {
	if (!seconds || isNaN(seconds)) return "N/A";
	let mins = Math.floor(seconds / 60);
	let secs = seconds % 60;
	return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function parseCsvToScores(csvString) {
	let lines = csvString.trim().split("\n");
	if (lines.length < 2) return [];

	let headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace("\r", ""));
	
	let nameIdx = headers.indexOf('username') !== -1 ? headers.indexOf('username') : headers.indexOf('name');
	if (nameIdx === -1) nameIdx = headers.indexOf('user');
	
	let scoreIdx = headers.indexOf('score');
	
	let timeIdx = headers.indexOf('time_taken_seconds') !== -1 
		? headers.indexOf('time_taken_seconds') 
		: headers.indexOf('time');

	let scores = [];
	for (let i = 1; i < lines.length; i++) {
		let values = lines[i].split(",");
		if (values.length >= 2) {
			scores.push({
				name: nameIdx !== -1 && values[nameIdx] ? values[nameIdx].replace("\r", "").trim() : 'Anonymous',
				score: scoreIdx !== -1 ? parseInt(values[scoreIdx], 10) || 0 : 0,
				time: timeIdx !== -1 ? parseInt(values[timeIdx], 10) || Infinity : Infinity
			});
		}
	}
	return scores;
}

function fetchAndShowLeaderboard(modalContainer) {
	modalContainer.innerHTML = '<div style="padding: 20px; text-align: center;">Loading Leaderboard...</div>';

	fetch(GOOGLE_SHEET_SCORES_URL, {
		headers: { "content-type": "text/csv;charset=UTF-8" },
		method: "GET"
	})
		.then(response => {
			if (!response.ok) throw new Error("Failed to load leaderboard");
			return response.text();
		})
		.then(csvData => {
			let scores = parseCsvToScores(csvData);
			
			// Filter out numeric-only names
			scores = scores.filter(entry => entry.name && !/^\d/.test(entry.name));

			// Sort by Score (descending), then by Time Taken (ascending)
			scores.sort((a, b) => {
				if (b.score !== a.score) {
					return b.score - a.score;
				}
				return a.time - b.time;
			});

			modalContainer.innerHTML = '';
			
			let table = document.createElement('table');
			table.style.cssText = 'width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; text-align: left;';
			table.innerHTML = `
				<thead>
					<tr style="border-bottom: 2px solid #ccc;">
						<th style="padding: 8px;">Rank</th>
						<th style="padding: 8px;">Name</th>
						<th style="padding: 8px;">Score</th>
						<th style="padding: 8px;">Time</th>
					</tr>
				</thead>
				<tbody>
					${scores.length > 0 ? scores.slice(0, 10).map((entry, idx) => `
						<tr style="border-bottom: 1px solid #eee;">
							<td style="padding: 8px;">${idx + 1}</td>
							<td style="padding: 8px;">${entry.name}</td>
							<td style="padding: 8px;">${entry.score}</td>
							<td style="padding: 8px;">${formatTime(entry.time)}</td>
						</tr>
					`).join('') : `
						<tr>
							<td colSpan="4" style="padding: 10px; text-align: center;">No scores found.</td>
						</tr>
					`}
				</tbody>
			`;
			modalContainer.append(table);
		})
		.catch(err => {
			console.error("Error loading CSV:", err);
			modalContainer.innerHTML = '<div style="padding: 20px; text-align: center;">Unable to load leaderboard.</div>';
		});
}

/* ---------------- Timer & Backend API ---------------- */

function startTimer(){
	gameStartTime = Date.now();
}

function stopTimerAndLog(attemptScore){
	if(gameStartTime !== null){
		let elapsedSeconds = Math.round((Date.now() - gameStartTime) / 1000);
		console.log('Game finished in ' + elapsedSeconds + ' seconds, attempt score: ' + attemptScore);
		sendTimeToServer(elapsedSeconds, attemptScore);
		gameStartTime = null;
	}
}

function sendTimeToServer(elapsedSeconds, attemptScore){
	fetch("https://airqualityquiz-backend.onrender.com/api/saveWordleScore", {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			user_id: username !== '' ? username : null,
			score: attemptScore,
			time_taken_seconds: elapsedSeconds,
			mode: difficulty,
			word: chosenWord,
			date: new Date().toISOString()
		})
	})
	.then(response => response.json())
	.then(data => console.log("Successfully saved score:", data))
	.catch(error => console.error("Error logging score:", error));
}

/* ---------------- Score / help modals ---------------- */

function showScores(modal, type, diff){
	let msBlock = document.createElement('div');
	msBlock.id = 'msBlock';
	modal.append(msBlock);
	let modes = ['easy', 'long'];
	for(let i = 0; i < modes.length; i++){
		let modalScoreBlock = document.createElement('div');
		modalScoreBlock.className = 'msBlock';
			let msHeadContent = modes[i].toUpperCase();
			let modalScoreHead = document.createElement('span');
			modalScoreHead.className = 'msHead';
			modalScoreHead.innerText = msHeadContent;
			modalScoreBlock.append(modalScoreHead);

			let msBodyContent = localStorage.getItem(type + diff + modes[i]);
			let modalScoreBody = document.createElement('span');
			modalScoreBody.className = 'msBody';
			modalScoreBody.innerText = (msBodyContent == null)? 0 : msBodyContent;
			modalScoreBlock.append(modalScoreBody);
		msBlock.append(modalScoreBlock);
	}
}

function showHelp(modal, type){
	let exampleWords = ['SUNNY', 'WORLD', 'TITAN'];
	let mhBlock = document.createElement('div');
	mhBlock.id = 'mhBlock';
	let mhbHead = document.createElement('div');
	mhbHead.className = 'mhbHead';
	mhbHead.innerText = (type == 'game')? 'You have 6 tries to guess the word.\n\nOnly valid words are allowed. Hit enter to submit your guess.\n\nWith each guess, the colour of the tiles will change to show you how close your guess is to the word.' : 'There are 2 modes - Easy (5 letter words) and Long (7 letter words). You can change the mode either in the main menu or in play by clicking on the currently stated mode.';
	mhBlock.append(mhbHead);

	let mhbBody = document.createElement('div');
	mhbBody.className = 'mhbBody';

	if(type == 'game'){
		for(let i = 0; i < exampleWords.length; i++){
			let rand = Math.floor(Math.random() * 5);
			let tileClass = (i == 0)? 'blockGreen' : ((i == 1)? 'blockGold' : 'blockGrey');
			let exNotification = '';
			let exampleRow = document.createElement('div');
			exampleRow.className = 'exampleRow';
			for(let j = 0; j < exampleWords[i].length; j++){
				let exampleTile = document.createElement('span');
				exampleTile.className = (j == rand)? 'exampleTile ' + tileClass : 'exampleTile';
				exampleTile.innerText = exampleWords[i][j];
				exampleRow.append(exampleTile);
				exNotification += (j == rand)? '<strong>' + exampleWords[i][j] + '</strong>' : '';
			}
			exNotification += (i == 0)? ' is in the word and in the correct place' : ((i == 1)? ' is in the word but in the wrong place' : ' is not in the word');
			let exNotRow = document.createElement('div');
			exNotRow.innerHTML = exNotification;
			exampleRow.append(exNotRow);
			mhbBody.append(exampleRow);
		}
	}else{
		mhbBody.className = 'mhbHead';
		mhbBody.innerText = '\nIn addition to the mode, there are 2 difficulty settings - easy and difficult. You can use any valid words within your guesses in easy mode.\n\nIn difficult mode, you must reuse any letters that you have previously chosen and are found to be within the word.\n\nYou can quit the game at any time by clicking on the give up button, which will deduct 15 points from your score and show you the current word.';
	}
	mhBlock.append(mhbBody);
	modal.append(mhBlock);
}

function openModal(type, notification){
	let modal = document.createElement('div');
	modal.id = 'modal';
	if(type == 'modeSelect'){
		let options = ['Easy', 'Long'];
		for(let i = 0; i < options.length; i++){
			let modalBtn = document.createElement('button');
			modalBtn.className = 'modalBtnL';
			modalBtn.innerText = options[i];
			modalBtn.addEventListener('click', modeSelect);
			modal.append(modalBtn);
			setTimeout(function(){
				modal.style.cssText = 'opacity: 1';
			}, 1);
		}
	}
	else if(type == 'difficultySelect'){
		for(let i = 0; i < 2; i++){
			let modalBtn = document.createElement('button');
			modalBtn.className = 'modalBtnL';
			modalBtn.innerText = (i == 0)? 'Easy' : 'Difficult';
			modalBtn.addEventListener('click', difficultySelect);
			modal.append(modalBtn);
			setTimeout(function(){
				modal.style.cssText = 'opacity: 1';
			}, 1);
		}
	}
	else if(type == 'endScore'){
		let message = document.createElement('span');
		message.className = 'modalMessage';
		message.innerHTML = notification;
		modal.append(message);

		addSocial(modal);

		for(let i = 0; i < 4; i++){
			let modalScoreBlock = document.createElement('div');
			modalScoreBlock.className = 'msBlock';
				let msHeadContent = (i == 0)? 'SCORE' : ((i == 1)? 'TOP SCORE' : ((i == 2)? 'STREAK' : 'BEST STREAK'));
				let modalScoreHead = document.createElement('span');
				modalScoreHead.className = 'msHead';
				modalScoreHead.innerText = msHeadContent;
				modalScoreBlock.append(modalScoreHead);

				let msBodyContent = (i == 0)? userScore : ((i == 1)? localStorage.getItem('score' + difficulty + mode) : ((i == 2)? currentStreak : localStorage.getItem('streak' + difficulty + mode)));
				let modalScoreBody = document.createElement('span');
				modalScoreBody.className = 'msBody';
				modalScoreBody.innerText = (msBodyContent == null)? 0 : msBodyContent;
				modalScoreBlock.append(modalScoreBody);
			modal.append(modalScoreBlock);
		}
		setTimeout(function(){
			document.addEventListener('click', restartClick);
			document.addEventListener('keyup', restart);
		}, 100);
	}
	else if(type == 'highScores'){
		let title = document.createElement('span');
		title.className = 'modalMessage';
		title.innerText = 'GLOBAL LEADERBOARD';
		modal.append(title);

		let leaderboardContent = document.createElement('div');
		leaderboardContent.id = 'leaderboardContent';
		modal.append(leaderboardContent);

		fetchAndShowLeaderboard(leaderboardContent);
	}
	else if(type == 'help'){
		for(let i = 0; i < 2; i++){
			let helpBtn = document.createElement('button');
			helpBtn.className = (i == 0)? 'helpBtnActive' : 'helpBtn';
			helpBtn.innerText = (i == 0 || i == 2)? 'GAME' : 'OPTIONS';
			helpBtn.j = i;
			helpBtn.modal = modal;
			helpBtn.addEventListener('click', changeHelpView);
			modal.append(helpBtn);
		}
		showHelp(modal, 'game');
	}
	else if(type == 'usernameEdit'){
		let message = document.createElement('span');
		message.className = 'modalMessage';
		message.innerText = 'Change your name';
		modal.append(message);

		let nameInput = document.createElement('input');
		nameInput.id = 'usernameEditInput';
		nameInput.type = 'text';
		nameInput.placeholder = 'Enter Username (Optional)';
		nameInput.value = username;
		nameInput.style.cssText = 'margin: 12px 0; padding: 10px; font-size: 15px; text-align: center; border-radius: 4px; border: 1px solid #ccc; width: 80%; max-width: 250px;';
		modal.append(nameInput);

		let saveBtn = document.createElement('button');
		saveBtn.className = 'modalBtnL';
		saveBtn.innerText = 'Save';
		saveBtn.addEventListener('click', function(){
			username = nameInput.value.trim();
			let usernameBtn = document.getElementById('usernameBtn');
			if(usernameBtn != null){
				usernameBtn.innerText = username !== ''? username : 'set name';
			}
			closeModal({ currentTarget: { modal: modal, shadowBack: document.getElementById('shadowBack') } });
		});
		modal.append(saveBtn);
	}

	container.prepend(modal);
	setTimeout(function(){
		modal.style.cssText = 'opacity: 1';
	}, 1);

	let shadowBack = document.createElement('div');
	shadowBack.id = 'shadowBack';
	container.prepend(shadowBack);
	setTimeout(function(){
		shadowBack.style.cssText = 'opacity: .35';
	}, 1);

	let modalClose = document.createElement('button');
	modalClose.id = 'modalClose';
	modalClose.innerText = 'close';
	modalClose.modal = modal;
	modalClose.shadowBack = shadowBack;
	modalClose.addEventListener('click', closeModal);
	modal.prepend(modalClose);
}

function addSocial(loc){
	let socialNav = document.createElement('div');
	socialNav.className = 'socialNav';

	let telegramIcon = document.createElement('img');
	telegramIcon.className = 'modalSocialIcon';
	telegramIcon.src = './assets/img/social/telegram_icon.png';
	telegramIcon.title = 'Share on Telegram';
	telegramIcon.alt = 'Telegram';
	telegramIcon.addEventListener("click", function(){
		openWindow('https://t.me/share/url?url=https://wordled.online&text=I\'ve been playing Wordled and love it. You have 6 tries to guess the hidden word and beat your high score. There are multiple difficulty settings to keep things interesting and it\'s free to play.', 'Telegram');
	});
	socialNav.append(telegramIcon);

	let twitterIcon = document.createElement('img');
	twitterIcon.className = 'modalSocialIcon';
	twitterIcon.src = './assets/img/social/twitter_icon.png';
	twitterIcon.title = 'Share on Twitter';
	twitterIcon.alt = 'Twitter';
	twitterIcon.addEventListener("click", function(){
		openWindow('https://twitter.com/intent/tweet?text=I%27ve%20been%20playing%20%23Wordled%20and%20love%20it.%20You%20have%206%20tries%20to%20guess%20the%20hidden%20word%20and%20beat%20your%20high%20score.%20There%20are%20multiple%20difficulty%20settings%20to%20keep%20things%20interesting%20and%20it%27s%20free%20to%20play.&url=https%3A%2F%2Fwordled.online&via=wordled', 'Twitter');
	});
	socialNav.append(twitterIcon);

	let facebookIcon = document.createElement('img');
	facebookIcon.className = 'modalSocialIcon';
	facebookIcon.src = './assets/img/social/facebook_icon.png';
	facebookIcon.title = 'Share on FaceBook';
	facebookIcon.alt = 'FaceBook';
	facebookIcon.addEventListener("click", function(){
		openWindow('https://www.facebook.com/sharer.php?u=https://wordled.online', 'FaceBook');
	});
	socialNav.append(facebookIcon);

	let redditIcon = document.createElement('img');
	redditIcon.className = 'modalSocialIcon';
	redditIcon.src = './assets/img/social/reddit_icon.png';
	redditIcon.title = 'Share on Reddit';
	redditIcon.alt = 'Reddit';
	redditIcon.addEventListener("click", function(){
		openWindow('https://www.reddit.com/submit?url=https://wordled.online&title=Play%20Wordled%20Online%20-%20a%20free%20word%20game', 'Reddit');
	});
	socialNav.append(redditIcon);

	loc.append(socialNav);
}

function openWindow(url, windowName){
	window.open(url, windowName,'width=550,height=450,left=150,top=200,toolbar=0,status=0,data-action=share/whatsapp/share')
}

function addLogo(){
	let logo = document.createElement('div');
	logo.className = 'logo';
	logo.addEventListener("click", logoClick);

	let domName = 'WORDLED';
	for(let i = 0; i < domName.length; i++){
		let spanClass = (i == 0 || i % 2 == 0)? 'logo_green' : 'logo_gold';
		let logoSpan = document.createElement('span');
		logoSpan.className = spanClass;
		logoSpan.innerText = domName[i];
		logo.append(logoSpan);
	}

	container.append(logo);
}

function changeHelpView(event){
	let j = event.currentTarget.j;
	let modal = event.currentTarget.modal;
	document.getElementsByClassName('helpBtnActive')[0].className = 'helpBtn';
	event.currentTarget.className = 'helpBtnActive';
	if(j == 0){
		document.getElementById('mhBlock').remove();
		showHelp(modal, 'game');
	}else{
		document.getElementById('mhBlock').remove();
		showHelp(modal, 'options');
	}
}

/* ---------------- Menu / setup ---------------- */

function setGlobal(){
	let difficulties = ['easy', 'difficult'];
	let modes = ['easy', 'long'];
	difficulties.forEach(function(d){
		modes.forEach(function(m){
			if(localStorage.getItem('score' + d + m) === null){
				localStorage.setItem('score' + d + m, 0);
			}
			if(localStorage.getItem('streak' + d + m) === null){
				localStorage.setItem('streak' + d + m, 0);
			}
		});
	});

	gameFin = 0;
	currentRow = 0;
	nextRowBlock = 0;
	score = 0;
	remNotification = 0;
	mustUse = '';
}

function startMenu(){
	if(document.getElementById('wordscript') != null){
		document.getElementById('wordscript').remove();
	}
	let script = document.createElement('script');
	script.id = 'wordscript';
	script.src = './assets/js/words/' + maxBlock + '.js';
	document.body.prepend(script);
	setGlobal();
	container.innerHTML = '';
	addLogo();
	let menu = document.createElement('div');
	menu.id = 'menu';

	// Username Input Field
	let nameInput = document.createElement('input');
	nameInput.id = 'usernameInput';
	nameInput.type = 'text';
	nameInput.placeholder = 'Enter Username (Optional)';
	nameInput.value = username;
	nameInput.style.cssText = 'margin-bottom: 12px; padding: 10px; font-size: 15px; text-align: center; border-radius: 4px; border: 1px solid #ccc; width: 80%; max-width: 250px;';
	nameInput.addEventListener('input', function(e) {
		username = e.target.value.trim();
	});
	menu.append(nameInput);

	for(let i = 0; i < 5; i++){
		let menuBtn = document.createElement('button');
		menuBtn.className = 'menuBtn';
		menuBtn.innerText = (i == 0)? (mode + ' (' + ((mode === 'long')? 7 : 5) + ' letters)') : ((i == 1)? ('difficulty: ' + difficulty) : ((i == 2)? 'high scores' : ((i == 3)? 'help' : 'start game')));
		menuBtn.j = i;

		menuBtn.addEventListener("click", menuClick);
		menu.append(menuBtn);
	}
	container.append(menu);
}

function gameOver(){
	gameFin = 1;
	document.removeEventListener('keyup', deleteClick, false);
	document.removeEventListener('keyup', keyPress, false);
	document.removeEventListener('keyup', restart, false);
	document.removeEventListener('click', logoClick, false);
	document.removeEventListener('click', menuClick, false);
	document.removeEventListener('click', enterClick, false);
	document.removeEventListener('click', difficultyModal, false);
	document.removeEventListener('click', closeModal, false);
}

function gameStart(){
	setGlobal();
	container.innerHTML = '';
	let wordType = fullList;
	let rand = Math.floor(Math.random() * wordType.length);
	chosenWord = wordType[rand].toUpperCase();

	startTimer();

	addLogo();

	let navBar = document.createElement('div');
	navBar.className = 'nav_bar';
		let difficultySelectBtn = document.createElement('button');
		difficultySelectBtn.id = 'difficultySelectBtn';
		difficultySelectBtn.className = 'btn';
		difficultySelectBtn.innerText = 'difficulty: ' + difficulty;
		difficultySelectBtn.addEventListener('click', difficultyModal);
		navBar.append(difficultySelectBtn);

		let modeSelectBtn = document.createElement('button');
		modeSelectBtn.id = 'modeSelectBtn';
		modeSelectBtn.className = 'btn';
		modeSelectBtn.innerText = mode + ' (' + maxBlock + ' letters)';
		modeSelectBtn.addEventListener('click', function(event){
			openModal('modeSelect');
		});
		navBar.append(modeSelectBtn);

		let usernameBtn = document.createElement('button');
		usernameBtn.id = 'usernameBtn';
		usernameBtn.className = 'btn';
		usernameBtn.innerText = username !== ''? username : 'set name';
		usernameBtn.addEventListener('click', function(event){
			openModal('usernameEdit');
		});
		navBar.append(usernameBtn);
	container.append(navBar);

	let gameArea = document.createElement('div');
	gameArea.className = 'game_area';
	for(let i = 0; i < 6; i++){
		let row = document.createElement('div');
		row.className = 'row';
		for(let j = 0; j < maxBlock; j++){
			let rowBlock = document.createElement('div');
			rowBlock.className = 'row_block';
			row.append(rowBlock);
		}
		gameArea.append(row);
	}
	container.append(gameArea);

	let notification = document.createElement('div');
	notification.id = 'notification';
	notification.innerText = 'Start guessing!'
	container.append(notification);

	let keyLayoutTop = 'QWERTYUIOP';
	let keyLayoutMid = 'ASDFGHJKL';
	let keyLayoutBot = 'ZXCVBNM';

	let keyboard = document.createElement('div');
	keyboard.id = 'keyboard';

		let topKeys = document.createElement('div');
		topKeys.id = 'topKeys';
		addKeys(topKeys, keyLayoutTop, 'keyboardKey_s');
		keyboard.append(topKeys);

		let midKeys = document.createElement('div');
		midKeys.id = 'midKeys';
		addKeys(midKeys, keyLayoutMid, 'keyboardKey_m');
		keyboard.append(midKeys);

		let botKeys = document.createElement('div');
		botKeys.id = 'botKeys';

		let deleteKey = document.createElement('span');
		deleteKey.className = 'keyboardKey_l';
		deleteKey.innerHTML = '&#x2190;';
		deleteKey.addEventListener("click", deleteClick);
		botKeys.append(deleteKey);
		addKeys(botKeys, keyLayoutBot, 'keyboardKey_s');

		let enterKey = document.createElement('span');
		enterKey.className = 'keyboardKey_l';
		enterKey.innerText = 'Enter';
		enterKey.addEventListener("click", enterClick);
		botKeys.append(enterKey);
		keyboard.append(botKeys);

	container.append(keyboard);
	
	addSocial(container);

	document.addEventListener('keyup', keyPress);
}

function difficultyModal(){
	openModal('difficultySelect');
}

function keyPress(event) {
	if(event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA')){
		return;
	}
	if(gameFin == 0){
		let alphabet = 'abcdefghijklmnopqrstuvwxyz';
		let wordRow = document.getElementsByClassName('row')[currentRow];
		let rowBlockEl = wordRow.childNodes;
		for(let i = 0; i < alphabet.length; i++){
			if ((event.key === alphabet[i] || event.key === alphabet[i].toUpperCase())) {
				addLetter(rowBlockEl, alphabet[i]);
			}
		}
		if(event.key === 'Enter') {
			submitWord(wordRow);
		}
		if(event.key === 'Backspace') {
			deleteLetter(rowBlockEl);
		}
	}
}

function enterClick(){
	if(gameFin == 0){
		let wordRow = document.getElementsByClassName('row')[currentRow];
		submitWord(wordRow);
	}
}

function logoClick(event) {
	gameOn = 0;
	container.innerHTML = '';
	startMenu();
}

function menuClick(event) {
	let j = event.currentTarget.j;
	let modalType = (j == 0)? 'modeSelect' : ((j == 1)? 'difficultySelect' : ((j == 2)? 'highScores' : 'help'));
	if(j < 4){
		openModal(modalType);
	}else{
		gameOn = 1;
		gameStart();
	}
}

function restart(event) {
	if (event.key === 'Enter') {
		document.removeEventListener('keyup', restart, false);
		document.removeEventListener('click', restartClick, false);
		gameStart();
	}
}

function restartClick(){
	document.removeEventListener('keyup', restart, false);
	document.removeEventListener('click', restartClick, false);
	gameStart();
}

function difficultySelect(){
	difficulty = this.innerText.toLowerCase();
	if(gameOn == 1){
		userScore = 0;
		currentStreak = 0;
		gameOver();
		document.removeEventListener('keyup', restart, false);
		gameStart();
	}else{
		startMenu();
	}
}

function modeSelect(){
	mode = this.innerText.toLowerCase();
	maxBlock = (mode === 'long')? 7 : 5;
	userScore = 0;
	currentStreak = 0;
	if(gameOn == 1){
		gameOver();
	}
	gameOn = 0;
	document.removeEventListener('keyup', restart, false);
	startMenu();
}

function changeScore(event){
	let j = event.currentTarget.j;
	let modal = event.currentTarget.modal;
	document.getElementsByClassName('scoreBtnActive')[0].className = 'scoreBtn';
	event.currentTarget.className = 'scoreBtnActive';
	if(j == 0 || j == 1){
		document.getElementById('msBlock').remove();
		showScores(modal, 'score', event.currentTarget.innerText.toLowerCase());
	}else{
		document.getElementById('msBlock').remove();
		showScores(modal, 'streak', event.currentTarget.innerText.toLowerCase());
	}
}

function closeModal(event){
	let modal = event.currentTarget.modal;
	let shadowBack = event.currentTarget.shadowBack;
	modal.style.cssText = 'opacity:0';
	shadowBack.style.cssText = 'opacity:0';
	setTimeout(function(){
		modal.remove();
		shadowBack.remove();
	}, 355);
}

function deleteClick(){
	if(gameFin == 0){
		let wordRow = document.getElementsByClassName('row')[currentRow];
		let rowBlockEl = wordRow.childNodes;
		deleteLetter(rowBlockEl);
	}
}

function keyboardPress(event){
	if(gameFin == 0){
		let layout = event.currentTarget.layout;
		let wordRow = document.getElementsByClassName('row')[currentRow];
		let rowBlockEl = wordRow.childNodes;
		addLetter(rowBlockEl, layout);
	}
}

function deleteLetter(rowBlockEl){
	if(nextRowBlock > 0){
		nextRowBlock--;
		rowBlockEl[nextRowBlock].innerText = '';
	}
}

function count(str, find) {
    return (str.split(find)).length - 1;
}

function checkAnswer(wordRow, answer){
	let answerArray = [];
	score = 0;

	for(let i = 0; i < answer.length; i++){
		let letter = answer[i].toUpperCase();
		answerArray.push(letter);
		let blockClass = 'blockGrey';
		if(chosenWord.toUpperCase().includes(letter)){
			if(chosenWord[i].toUpperCase() === letter){
				score++;
				blockClass = ' blockGreen';
				if(count(answer, letter) > count(chosenWord, letter)){
					for(let j = 0; j < wordRow.childNodes.length; j++){
						if(wordRow.childNodes[j].innerText == letter && wordRow.childNodes[j].className == 'row_block  blockGold'){
							wordRow.childNodes[j].className = 'row_block  blockGrey';
							let index = answerArray.indexOf(letter);
							if (index !== -1) {
								answerArray.splice(index, 1);
							}
						}
					}
				}
			}else{
				if(countOccurrences(answerArray, letter) <= count(chosenWord, letter)){
					blockClass = ' blockGold';
				}
				else{
					blockClass = ' blockGrey';
				}
			}
		}
		wordRow.childNodes[i].className = 'row_block ' + blockClass;
		let keyboard = document.getElementById('keyboard_' + letter);
		if(chosenWord.toUpperCase().includes(letter)){
			if(letter == chosenWord[i]){
				if(!keyboard.className.includes('blockGreen')){
					keyboard.classList.remove('blockGold');
					keyboard.className += ' blockGreen';
				}
			}else{
				if(!keyboard.className.includes('blockGreen') && !keyboard.className.includes('blockGold')){
					keyboard.className += ' blockGold';
				}
			}
			if(count(answer, letter) > count(mustUse, letter) && count(mustUse, letter) <= count(chosenWord, letter)){
				mustUse += letter;
			}
		}
		else{
			if(!keyboard.className.includes('blockGrey')){
				keyboard.className += ' blockGrey';
			}
		}
	}

	if(score === maxBlock){
		let modeMultiplier = (mode == 'long')? 2 : 1;
		let attemptScore = (modeMultiplier * 10) - ((modeMultiplier + 1) * currentRow);
		userScore = userScore + attemptScore;

		if(userScore > localStorage.getItem('score' + difficulty + mode)){
			localStorage.setItem('score' + difficulty + mode, userScore);
		}

		currentStreak++;
		if(currentStreak > localStorage.getItem('streak' + difficulty + mode)){
			localStorage.setItem('streak' + difficulty + mode, currentStreak);
		}

		stopTimerAndLog(attemptScore);

		let notification = 'Well done, you won! Click to play again';
		gameOver();

		setTimeout(function(){
			openModal('endScore', notification);
		}, 250);
	}
	else if(currentRow == 5){
		let attemptScore = -10;
		stopTimerAndLog(attemptScore);
		let url = '<a href="https://duckduckgo.com/?q=%22'+ chosenWord +'%22+%22definition%22&ia=definition" target="_blank">' + chosenWord + '</a>';
		let notification = 'You lost. The word was ' + url + '. Click to play again';
		userScore = userScore - 10;
		currentStreak = 0;
		gameOver();

		setTimeout(function(){
			openModal('endScore', notification);
		}, 250);
	}
	else{
		score = 0;
		nextRowBlock = 0;
		currentRow++;
	}
}

function submitWord(wordRow){
	if(nextRowBlock > 0 && nextRowBlock % maxBlock == 0){
		let answer = wordRow.innerText.replace(/[\n\r]/g, '');
		if(fullList.includes(answer)){
			if(difficulty == 'difficult'){
				for(let i = 0; i < mustUse.length; i++){
					if(!answer.includes(mustUse[i])){
						remNotification = 0;
						document.getElementById('notification').innerText = 'You must use found characters';
						return;
					}
				}
			}
			checkAnswer(wordRow, answer);		
		}else{
			remNotification = 0;
			document.getElementById('notification').innerText = 'Word not in list';
		}
	}else{
		remNotification = 0;
		document.getElementById('notification').innerText = 'You must enter ' + maxBlock + ' characters';
	}
}

function addKeys(el, layout, keyClass){
	for(let i = 0; i < layout.length; i++){
		let key = document.createElement('span');
		key.className = keyClass;
		key.id = 'keyboard_' + layout[i];
		key.innerText = layout[i];
		key.layout = layout[i];
		key.addEventListener("click", keyboardPress);
		el.append(key);
	}
}

function addLetter(rowBlockEl, letter){
	if(remNotification == 0){
		remNotification = 1;
		document.getElementById('notification').innerText = '';
	}
	if(nextRowBlock < maxBlock){
		rowBlockEl[nextRowBlock].innerText = letter.toUpperCase();
		nextRowBlock++;
	}
}