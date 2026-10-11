document.addEventListener("DOMContentLoaded", function () {
    var popup = document.querySelector(".popup");
    var popupText = document.getElementById("popupText");
    if (!popup || !popupText) return;

    var texts = [
        "📢：欢迎来到 Muyu 的小窝",
        "🔔：双击头像卡片可以进入终端模式",
        "🐟：永远相信美好的事情即将发生",
        "📝：博客同步更新中",
        "🎵：右下角可以听歌",
        "🖼️：右键有更多菜单",
        "🥳"
    ];
    var currentIndex = 0;

    function updatePopupText() {
        popupText.innerHTML = texts[currentIndex];
        currentIndex = (currentIndex + 1) % texts.length;
    }

    function showPopup() {
        popup.style.top = "20px";
    }

    function hidePopup() {
        popup.style.top = "-100px";
    }

    updatePopupText();
    setInterval(function () {
        showPopup();
        setTimeout(function () {
            hidePopup();
            updatePopupText();
        }, 3000);
    }, 4000);
});
