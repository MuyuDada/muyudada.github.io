// 要操作的元素
// 说明：浮动汉堡菜单已移除（其链接与「社交媒体」网格重复），此处保留可空守卫，
// 若将来重新加入 .menu-box 仍可直接复用本文件。
const menu_box=document.querySelector('.menu-box');
const menu_button=document.querySelector('.menu-button');

// 为菜单按钮绑定点击事件
if(menu_box && menu_button){
    menu_button.addEventListener('click',function(){
        menu_box.classList.toggle('active');
    })
}