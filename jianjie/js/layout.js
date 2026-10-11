/* ==========================================================================
   layout.js —— 新增卡片组件逻辑（一言 / 时间线 / 标签）
   说明：
   - 纯原生 JS，无 jQuery 依赖，可安全地在 <body> 末尾引入。
   - 所有 DOM 查询均可空守卫，元素缺失时不抛错。
   - 类名/ID 统一 dw- 前缀，避免与页面既有脚本冲突。
   ========================================================================== */
(function () {
	"use strict";

	function dwEl(id) {
		return document.getElementById(id);
	}

	/* ---------------------------------------------------------------
	   一言卡片：拉取 v1.hitokoto.cn，带逐字打字机效果
	   --------------------------------------------------------------- */
	var HITOKOTO_FALLBACK = "永远相信美好的事情即将发生";

	var hitokotoText = dwEl("dw-hitokoto-text");
	var hitokotoFrom = dwEl("dw-hitokoto-from");

	var typingTimer = null;
	var caret = null;

	function ensureCaret() {
		if (!hitokotoText || caret) {
			return;
		}
		caret = document.createElement("span");
		caret.className = "dw-caret";
		caret.setAttribute("aria-hidden", "true");
		hitokotoText.appendChild(caret);
	}

	function setHitokoto(text, from) {
		if (!hitokotoText) {
			return;
		}
		if (typingTimer) {
			clearInterval(typingTimer);
			typingTimer = null;
		}
		hitokotoText.textContent = "";
		if (hitokotoFrom) {
			hitokotoFrom.textContent = "";
		}
		ensureCaret();

		var chars = Array.from(String(text || ""));
		var index = 0;

		// 尊重用户的减少动效偏好：直接整段显示
		var reduceMotion = window.matchMedia &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (reduceMotion || chars.length === 0) {
			hitokotoText.textContent = chars.join("");
			if (caret) {
				caret.remove();
				caret = null;
			}
			if (hitokotoFrom && from) {
				hitokotoFrom.textContent = "—— " + from;
			}
			return;
		}

		typingTimer = setInterval(function () {
			if (index >= chars.length) {
				clearInterval(typingTimer);
				typingTimer = null;
				if (caret) {
					caret.remove();
					caret = null;
				}
				if (hitokotoFrom && from) {
					hitokotoFrom.textContent = "—— " + from;
				}
				return;
			}
			// 在光标之前插入下一个字
			var node = document.createTextNode(chars[index]);
			if (caret) {
				hitokotoText.insertBefore(node, caret);
			} else {
				hitokotoText.appendChild(node);
			}
			index += 1;
		}, 75);
	}

	function loadHitokoto() {
		if (!hitokotoText) {
			return;
		}
		if (typeof fetch !== "function") {
			setHitokoto(HITOKOTO_FALLBACK, "");
			return;
		}

		var controller = typeof AbortController === "function" ? new AbortController() : null;
		var timeoutId = setTimeout(function () {
			if (controller) {
				controller.abort();
			}
		}, 8000);

		fetch("https://v1.hitokoto.cn/", controller ? { signal: controller.signal } : undefined)
			.then(function (response) {
				if (!response.ok) {
					throw new Error("hitokoto HTTP " + response.status);
				}
				return response.json();
			})
			.then(function (data) {
				clearTimeout(timeoutId);
				if (data && data.hitokoto) {
					setHitokoto(data.hitokoto, data.from || "");
				} else {
					setHitokoto(HITOKOTO_FALLBACK, "");
				}
			})
			.catch(function () {
				clearTimeout(timeoutId);
				setHitokoto(HITOKOTO_FALLBACK, "");
			});
	}

	/* ---------------------------------------------------------------
	   时间线：点击某条记录时高亮为当前节点
	   --------------------------------------------------------------- */
	function initTimeline() {
		var items = document.querySelectorAll(".dw-line-item");
		if (!items.length) {
			return;
		}
		Array.prototype.forEach.call(items, function (item) {
			item.addEventListener("click", function () {
				Array.prototype.forEach.call(items, function (other) {
					other.classList.remove("is-focus");
				});
				item.classList.add("is-focus");
			});
		});
	}

	/* ---------------------------------------------------------------
	   标签：点击标签跳转到主页1 的标签筛选（若无对应页面则仅做视觉反馈）
	   --------------------------------------------------------------- */
	function initTags() {
		var tags = document.querySelectorAll(".dw-tag");
		if (!tags.length) {
			return;
		}
		Array.prototype.forEach.call(tags, function (tag) {
			tag.addEventListener("click", function () {
				Array.prototype.forEach.call(tags, function (other) {
					other.classList.remove("is-focus");
				});
				tag.classList.add("is-focus");
			});
		});
	}

	function init() {
		loadHitokoto();
		initTimeline();
		initTags();
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
