// news-render.js
// Tiny markdown-lite renderer shared by the News page (index.html) and the
// offline post composer (news-composer.html), so the composer preview always
// matches exactly what ends up live on the site.
//
// Supported syntax (on purpose — kept small so it's easy to type by hand):
//   ***bold italic***
//   **bold**
//   *italic*
//   [link text](https://example.com)
//   - bullet item        (a line starting with "- ")
//   blank line            = new paragraph
//   single line break     = <br>

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Applies inline formatting (bold/italic/links) to an already-escaped line.
function renderInline(escapedLine) {
    let s = escapedLine;
    // Links: [text](url)
    s = s.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // Bold+italic: ***text*** (must come before ** and * checks)
    s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    // Bold: **text**
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic: *text* (remaining single * are safe since ** was replaced first)
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return s;
}

function renderNewsBody(raw) {
    if (!raw) return '';
    const escaped = escapeHtml(raw).replace(/\r\n/g, '\n');
    const blocks = escaped.split(/\n\s*\n/); // blank line = new block
    let html = '';
    for (const block of blocks) {
        const lines = block.split('\n').filter(l => l.length > 0);
        if (!lines.length) continue;

        // Walk the block grouping consecutive bullet lines into <ul> and
        // consecutive plain lines into <p>, so a bold label line directly
        // above a bullet list (a common pattern) still renders the list.
        let i = 0;
        let paraBuffer = [];
        const flushPara = () => {
            if (paraBuffer.length) {
                html += '<p>' + paraBuffer.map(renderInline).join('<br>') + '</p>';
                paraBuffer = [];
            }
        };
        while (i < lines.length) {
            const line = lines[i];
            if (/^-\s+/.test(line.trim())) {
                flushPara();
                html += '<ul class="news-body-list">';
                while (i < lines.length && /^-\s+/.test(lines[i].trim())) {
                    html += '<li>' + renderInline(lines[i].trim().replace(/^-\s+/, '')) + '</li>';
                    i++;
                }
                html += '</ul>';
            } else {
                paraBuffer.push(line);
                i++;
            }
        }
        flushPara();
    }
    return html;
}
