function recentPost(postdate) {
    let datetimeNow = new Date();//現在の時刻
    let diff = datetimeNow - postdate;//投稿日と現在の時刻の差
    let thisYear = datetimeNow.getFullYear();
    let postYear = postdate.getFullYear();
    let whenPost;
    if(diff < 60000){
        const sec = Math.floor(diff/1000)%60;
        whenPost = 'たった今';
    } else if (diff < 3600000){
        const min=Math.floor(diff/1000/60)%60;
        whenPost = min + '分前';
    } else if (diff < 86400000){
        const hours = Math.floor(diff/1000/60/60)%24;
        whenPost = hours + '時間前';
    } else if (thisYear === postYear) {
        whenPost = postdate.toFormat('MM月DD日');
    } else {
        whenPost = postdate.toFormat('YYYY年MM月DD日');
    }
    return whenPost;
}
module.exports = { recentPost };