//HTMLコードをエスケープ
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// 改行コードのみ<br>に置換
function format(text) {
    return escapeHtml(text).replace(/\n/g, '<br>');
}

module.exports = { format };
