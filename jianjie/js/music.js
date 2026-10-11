/* ==========================================================================
   music.js —— 音乐卡片（移植自主页1 static/js/script.js 的音乐组件段落）
   来源：static/js/script.js 第 11-16 行（配置）与第 672-1191 行（全部逻辑）
   说明：
   - 纯原生 JS，只依赖浏览器 Audio API + fetch + Font Awesome 图标，无第三方库。
   - 全部 DOM 查询做空值保护；节点缺失时静默返回，不抛异常。
   - id 沿用主页1 的 mw-* / music-* 命名（jianjie 页面无同名节点，无冲突）。
   - 歌单仍用主页2 原来的网易云歌单 ID，仅替换播放器实现。
   ========================================================================== */
(function () {
	"use strict";

	// ===== 歌单配置（原 jianjie 用 APlayer 播放的同一张网易云歌单） =====
	var musicPlaylistConfig = {
		server: "netease",
		type: "playlist",
		id: "2926227857",
		api: "https://api.qijieya.cn/meting/?server=:server&type=:type&id=:id"
	};

	var musicPlayer = {
		audio: null,
		playlist: [],
		index: 0,
		mode: "all",
		lrc: [],
		lrcIndex: -1,
		seeking: false
	};

	function formatMusicTime(seconds) {
		if (!Number.isFinite(seconds) || seconds < 0) {
			return "0:00";
		}
		var total = Math.floor(seconds);
		var minutes = Math.floor(total / 60);
		return minutes + ":" + String(total % 60).padStart(2, "0");
	}

	function parseLrc(text) {
		var lines = [];
		String(text || "").split(/\r\n|\n|\r/).forEach(function (raw) {
			var matches = raw.match(/\[\d{1,2}:\d{1,2}(?:[.:]\d{1,3})?\]/g);
			if (!matches) {
				return;
			}
			var content = raw.replace(/\[[^\]]*\]/g, "").trim();
			if (!content) {
				return;
			}
			matches.forEach(function (tag) {
				var parts = tag.slice(1, -1).split(/[:.]/);
				var minutes = parseInt(parts[0], 10);
				var seconds = parseInt(parts[1], 10);
				var fraction = parts[2] ? parseInt(parts[2], 10) / Math.pow(10, parts[2].length) : 0;
				lines.push({ time: minutes * 60 + seconds + fraction, text: content });
			});
		});
		return lines.sort(function (a, b) {
			return a.time - b.time;
		});
	}

	function escapeHtml(text) {
		return String(text).replace(/[&<>"']/g, function (ch) {
			return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch];
		});
	}

	function musicElements() {
		return {
			widget: document.getElementById("music-widget"),
			title: document.getElementById("mw-title"),
			artist: document.getElementById("mw-artist"),
			cover: document.getElementById("mw-cover-img"),
			playButton: document.getElementById("mw-play"),
			playIcon: document.querySelector("#mw-play .mw-icon-play"),
			pauseIcon: document.querySelector("#mw-play .mw-icon-pause"),
			prevButton: document.getElementById("mw-prev"),
			nextButton: document.getElementById("mw-next"),
			modeButton: document.getElementById("mw-mode"),
			muteButton: document.getElementById("mw-mute"),
			volumeIcon: document.querySelector("#mw-mute .mw-icon-vol"),
			muteIcon: document.querySelector("#mw-mute .mw-icon-mute"),
			volumeTrack: document.getElementById("mw-volume"),
			volumeBar: document.getElementById("mw-volume-bar"),
			progress: document.getElementById("mw-progress"),
			progressBar: document.getElementById("mw-progress-bar"),
			progressThumb: document.querySelector("#mw-progress .mw-progress-thumb"),
			currentTime: document.getElementById("mw-time-current"),
			totalTime: document.getElementById("mw-time-total"),
			lrcToggle: document.getElementById("mw-lrc-toggle"),
			lrcDrawer: document.getElementById("mw-lrc-drawer"),
			lrcContainer: document.getElementById("mw-lrc"),
			listToggle: document.getElementById("mw-list-toggle"),
			listDrawer: document.getElementById("mw-list-drawer"),
			playlist: document.getElementById("mw-playlist"),
			status: document.getElementById("music-player-status")
		};
	}

	function setMusicStatus(elements, message, isError) {
		if (!elements.status) {
			return;
		}
		if (!message) {
			elements.status.hidden = true;
			return;
		}
		elements.status.textContent = message;
		elements.status.classList.toggle("is-error", Boolean(isError));
		elements.status.hidden = false;
	}

	function updatePlayIcon(elements) {
		var playing = musicPlayer.audio && !musicPlayer.audio.paused;
		elements.playIcon.hidden = playing;
		elements.pauseIcon.hidden = !playing;
		elements.playButton.title = playing ? "暂停" : "播放";
		elements.playButton.setAttribute("aria-label", playing ? "暂停" : "播放");
		elements.widget.classList.toggle("is-playing", Boolean(playing));
	}

	function updateProgress(elements) {
		var audio = musicPlayer.audio;
		if (!audio || musicPlayer.seeking) {
			return;
		}
		var duration = audio.duration;
		var percent = duration ? (audio.currentTime / duration) * 100 : 0;
		elements.progressBar.style.width = percent + "%";
		elements.progressThumb.style.left = percent + "%";
		elements.currentTime.textContent = formatMusicTime(audio.currentTime);
		elements.totalTime.textContent = formatMusicTime(duration);
		elements.progress.setAttribute("aria-valuenow", String(Math.round(percent)));
	}

	function updateVolumeUI(elements) {
		var audio = musicPlayer.audio;
		if (!audio) {
			return;
		}
		var muted = audio.muted || audio.volume === 0;
		elements.volumeIcon.hidden = muted;
		elements.muteIcon.hidden = !muted;
		elements.muteButton.title = muted ? "取消静音" : "静音";
		elements.muteButton.setAttribute("aria-label", muted ? "取消静音" : "静音");
		var percent = audio.muted ? 0 : audio.volume * 100;
		elements.volumeBar.style.width = percent + "%";
		elements.volumeTrack.setAttribute("aria-valuenow", String(Math.round(percent)));
	}

	function updateModeUI(elements) {
		elements.widget.classList.remove("mode-one", "mode-shuffle");
		if (musicPlayer.mode === "one") {
			elements.widget.classList.add("mode-one");
			elements.modeButton.title = "单曲循环";
		} else if (musicPlayer.mode === "shuffle") {
			elements.widget.classList.add("mode-shuffle");
			elements.modeButton.title = "随机播放";
		} else {
			elements.modeButton.title = "列表循环";
		}
	}

	function highlightPlaylist(elements) {
		if (!elements.playlist) {
			return;
		}
		var items = elements.playlist.children;
		for (var i = 0; i < items.length; i++) {
			items[i].classList.toggle("current", i === musicPlayer.index);
		}
	}

	function renderLyrics(elements) {
		musicPlayer.lrcIndex = -1;
		if (!elements.lrcContainer) {
			return;
		}
		if (!musicPlayer.lrc.length) {
			elements.lrcContainer.innerHTML = "<div class=\"mw-lrc-empty\">暂无歌词</div>";
			return;
		}
		elements.lrcContainer.innerHTML = musicPlayer.lrc.map(function (line, i) {
			return "<p class=\"mw-lrc-line\" data-lrc-index=\"" + i + "\">" + escapeHtml(line.text) + "</p>";
		}).join("");
	}

	function updateLyric(elements) {
		var lines = musicPlayer.lrc;
		if (!lines.length || !elements.lrcContainer) {
			return;
		}
		var time = musicPlayer.audio.currentTime;
		var index = -1;
		for (var i = 0; i < lines.length; i++) {
			if (lines[i].time <= time) {
				index = i;
			} else {
				break;
			}
		}
		if (index === musicPlayer.lrcIndex) {
			return;
		}
		musicPlayer.lrcIndex = index;
		var nodes = elements.lrcContainer.children;
		for (var j = 0; j < nodes.length; j++) {
			nodes[j].classList.toggle("current", j === index);
		}
		if (index >= 0 && nodes[index]) {
			var node = nodes[index];
			elements.lrcContainer.scrollTop = node.offsetTop -
				elements.lrcContainer.offsetTop -
				elements.lrcContainer.clientHeight / 2 +
				node.offsetHeight / 2;
		}
	}

	function loadLyrics(song, elements) {
		musicPlayer.lrc = [];
		renderLyrics(elements);
		if (!song.lrc) {
			return;
		}
		fetch(song.lrc)
			.then(function (response) {
				if (!response.ok) {
					throw new Error("歌词请求失败：" + response.status);
				}
				return response.text();
			})
			.then(function (text) {
				if (musicPlayer.playlist[musicPlayer.index] !== song) {
					return;
				}
				musicPlayer.lrc = parseLrc(text);
				renderLyrics(elements);
			})
			.catch(function () {
				if (musicPlayer.playlist[musicPlayer.index] === song) {
					musicPlayer.lrc = [];
					renderLyrics(elements);
				}
			});
	}

	function loadCurrentSong(autoplay, elements) {
		var song = musicPlayer.playlist[musicPlayer.index];
		if (!song || !musicPlayer.audio) {
			return;
		}

		elements.title.textContent = song.name;
		elements.title.title = song.name;
		elements.artist.textContent = song.artist || "未知歌手";
		elements.artist.title = song.artist || "未知歌手";

		if (song.cover) {
			elements.cover.src = song.cover;
			elements.cover.classList.add("is-visible");
		} else {
			elements.cover.classList.remove("is-visible");
		}

		elements.progressBar.style.width = "0%";
		elements.progressThumb.style.left = "0%";
		elements.currentTime.textContent = "0:00";
		elements.totalTime.textContent = "0:00";
		elements.progress.setAttribute("aria-valuenow", "0");

		musicPlayer.audio.src = song.url;
		musicPlayer.audio.load();
		highlightPlaylist(elements);
		loadLyrics(song, elements);

		if (autoplay) {
			var playback = musicPlayer.audio.play();
			if (playback && playback.catch) {
				playback.catch(function (error) {
					console.error(error);
				});
			}
		}
	}

	function playSongAt(index, elements) {
		if (!musicPlayer.playlist.length) {
			return;
		}
		musicPlayer.index = (index + musicPlayer.playlist.length) % musicPlayer.playlist.length;
		loadCurrentSong(true, elements);
	}

	function nextSongIndex(mode) {
		var total = musicPlayer.playlist.length;
		if (total <= 1) {
			return musicPlayer.index;
		}
		if (mode === "shuffle") {
			var next = musicPlayer.index;
			while (next === musicPlayer.index) {
				next = Math.floor(Math.random() * total);
			}
			return next;
		}
		return (musicPlayer.index + 1) % total;
	}

	function initMusicSlider(track, onSeek) {
		if (!track) {
			return;
		}
		var dragging = false;
		var percentFromEvent = function (event) {
			var rect = track.getBoundingClientRect();
			if (!rect.width) {
				return 0;
			}
			var x = (event.touches && event.touches[0] ? event.touches[0].clientX : event.clientX);
			return Math.min(1, Math.max(0, (x - rect.left) / rect.width));
		};
		var apply = function (event) {
			onSeek(percentFromEvent(event));
		};
		var start = function (event) {
			dragging = true;
			track.classList.add("is-seeking");
			apply(event);
		};
		var move = function (event) {
			if (dragging) {
				apply(event);
			}
		};
		var end = function () {
			if (!dragging) {
				return;
			}
			dragging = false;
			track.classList.remove("is-seeking");
		};

		track.addEventListener("mousedown", start);
		window.addEventListener("mousemove", function (event) {
			move(event);
		});
		window.addEventListener("mouseup", end);
		track.addEventListener("touchstart", start, { passive: true });
		track.addEventListener("touchmove", function (event) {
			if (dragging) {
				event.preventDefault();
				apply(event);
			}
		}, { passive: false });
		track.addEventListener("touchend", end);
		track.addEventListener("touchcancel", end);
	}

	function initializeMusicPlayer() {
		var elements = musicElements();
		if (!elements.widget || elements.widget.dataset.playerReady === "true") {
			return;
		}
		// 任一必需节点缺失就整体跳过，避免半初始化导致报错
		if (!elements.playButton || !elements.title || !elements.artist) {
			return;
		}
		elements.widget.dataset.playerReady = "true";
		elements.widget.classList.add("is-loading");

		var audio = new Audio();
		audio.preload = "metadata";
		audio.volume = 0.7;
		musicPlayer.audio = audio;

		audio.addEventListener("play", function () {
			updatePlayIcon(elements);
		});
		audio.addEventListener("pause", function () {
			updatePlayIcon(elements);
		});
		audio.addEventListener("timeupdate", function () {
			updateProgress(elements);
			updateLyric(elements);
		});
		audio.addEventListener("durationchange", function () {
			updateProgress(elements);
		});
		audio.addEventListener("ended", function () {
			if (musicPlayer.mode === "one") {
				audio.currentTime = 0;
				audio.play();
				return;
			}
			playSongAt(nextSongIndex(musicPlayer.mode), elements);
		});
		audio.addEventListener("error", function () {
			if (!musicPlayer.playlist.length) {
				return;
			}
			console.error("歌曲加载失败：" + musicPlayer.playlist[musicPlayer.index].name);
		});

		elements.playButton.addEventListener("click", function () {
			if (!musicPlayer.playlist.length) {
				return;
			}
			if (audio.paused) {
				var playback = audio.play();
				if (playback && playback.catch) {
					playback.catch(function (error) {
						console.error(error);
					});
				}
			} else {
				audio.pause();
			}
		});

		if (elements.prevButton) {
			elements.prevButton.addEventListener("click", function () {
				playSongAt(musicPlayer.index - 1, elements);
			});
		}
		if (elements.nextButton) {
			elements.nextButton.addEventListener("click", function () {
				playSongAt(nextSongIndex(musicPlayer.mode), elements);
			});
		}

		if (elements.modeButton) {
			elements.modeButton.addEventListener("click", function () {
				musicPlayer.mode = musicPlayer.mode === "all" ? "one"
					: musicPlayer.mode === "one" ? "shuffle" : "all";
				updateModeUI(elements);
			});
		}

		if (elements.muteButton) {
			elements.muteButton.addEventListener("click", function () {
				audio.muted = !audio.muted;
				updateVolumeUI(elements);
			});
		}

		initMusicSlider(elements.volumeTrack, function (percent) {
			audio.muted = false;
			audio.volume = percent;
			updateVolumeUI(elements);
		});
		initMusicSlider(elements.progress, function (percent) {
			if (!audio.duration) {
				return;
			}
			audio.currentTime = percent * audio.duration;
			updateProgress(elements);
		});
		if (elements.progress) {
			elements.progress.addEventListener("mousedown", function () {
				musicPlayer.seeking = true;
				elements.progress.classList.add("is-seeking");
			});
		}
		window.addEventListener("mouseup", function () {
			if (musicPlayer.seeking) {
				musicPlayer.seeking = false;
				if (elements.progress) {
					elements.progress.classList.remove("is-seeking");
				}
			}
		});

		function bindDrawerToggle(button, drawer, other) {
			if (!button || !drawer) {
				return;
			}
			button.addEventListener("click", function () {
				var willOpen = !drawer.classList.contains("open");
				drawer.classList.toggle("open", willOpen);
				button.setAttribute("aria-expanded", String(willOpen));
				if (other && other.drawer && other.button) {
					other.drawer.classList.remove("open");
					other.button.setAttribute("aria-expanded", "false");
				}
			});
		}

		bindDrawerToggle(elements.lrcToggle, elements.lrcDrawer, {
			button: elements.listToggle,
			drawer: elements.listDrawer
		});
		bindDrawerToggle(elements.listToggle, elements.listDrawer, {
			button: elements.lrcToggle,
			drawer: elements.lrcDrawer
		});

		updateModeUI(elements);
		updateVolumeUI(elements);

		var query = new URLSearchParams({
			server: musicPlaylistConfig.server,
			type: musicPlaylistConfig.type,
			id: musicPlaylistConfig.id
		});

		fetch(musicPlaylistConfig.api + "?" + query.toString())
			.then(function (response) {
				if (!response.ok) {
					throw new Error("网易云歌单请求失败：" + response.status);
				}
				return response.json();
			})
			.then(function (data) {
				if (!Array.isArray(data) || data.length === 0) {
					throw new Error("网易云歌单没有可播放的歌曲");
				}

				musicPlayer.playlist = data.map(function (song) {
					return {
						name: song.name,
						artist: song.artist,
						url: song.url,
						cover: song.pic,
						lrc: song.lrc
					};
				}).filter(function (song) {
					return song.name && song.url;
				});

				if (!musicPlayer.playlist.length) {
					throw new Error("网易云歌单没有有效的音频地址");
				}

				if (elements.playlist) {
					elements.playlist.innerHTML = musicPlayer.playlist.map(function (song, i) {
						return "<button class=\"mw-playlist-item\" type=\"button\" data-song-index=\"" + i + "\">" +
							"<span class=\"mw-playlist-index\">" + (i + 1) + "</span>" +
							"<span class=\"mw-playlist-name\">" + escapeHtml(song.name) + "</span>" +
							"<span class=\"mw-playlist-artist\">" + escapeHtml(song.artist || "") + "</span>" +
							"</button>";
					}).join("");

					elements.playlist.addEventListener("click", function (event) {
						var item = event.target.closest(".mw-playlist-item");
						if (!item) {
							return;
						}
						playSongAt(parseInt(item.dataset.songIndex, 10), elements);
					});
				}

				elements.widget.classList.remove("is-loading");
				setMusicStatus(elements, null);
				loadCurrentSong(false, elements);
			})
			.catch(function (error) {
				console.error(error);
				elements.widget.classList.remove("is-loading");
				elements.widget.classList.add("is-error");
				setMusicStatus(elements, "歌单加载失败，请检查网易云歌单 ID。", true);
			});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initializeMusicPlayer);
	} else {
		initializeMusicPlayer();
	}
})();
