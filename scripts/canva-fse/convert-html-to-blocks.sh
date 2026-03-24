#!/usr/bin/env bash
# convert-html-to-blocks.sh
# Converts Canva-exported HTML into WordPress block markup.
# Usage: convert-html-to-blocks.sh <input.html>
set -e

INPUT_FILE="${1:-}"

if [[ -z "$INPUT_FILE" || ! -f "$INPUT_FILE" ]]; then
    echo "Error: File '${INPUT_FILE}' not found." >&2
    exit 1
fi

# Read the entire file, collapse to one line, normalise inter-tag whitespace,
# then split so each top-level element sits on its own line.
content="$(cat "$INPUT_FILE" | tr '\n' ' ' | sed -E 's/>[[:space:]]+</></g')"

# Insert a newline before every opening tag (not closing tags like </h1>).
# Also split before closing container tags (</div>, </ul>, </ol>) so they
# get their own line for proper wp:group / wp:list closing.
content="$(echo "$content" \
    | sed -E 's/<([a-zA-Z])/\x00<\1/g' \
    | sed -E 's/<\/(div|ul|ol)>/\x00<\/\1>/g' \
    | tr '\0' '\n' \
    | sed '/^$/d')"

# Process each line through awk for block conversion.
echo "$content" | awk '
BEGIN { in_ul = 0; in_ol = 0; ul_buf = ""; ol_buf = "" }

function flush_ul() {
    if (in_ul) {
        print "<!-- wp:list -->"
        print "<ul>" ul_buf "</ul>"
        print "<!-- /wp:list -->"
        in_ul = 0; ul_buf = ""
    }
}
function flush_ol() {
    if (in_ol) {
        print "<!-- wp:list {\"ordered\":true} -->"
        print "<ol>" ol_buf "</ol>"
        print "<!-- /wp:list -->"
        in_ol = 0; ol_buf = ""
    }
}

# --- list item accumulation ---
/^<li/ {
    if (in_ul) { ul_buf = ul_buf $0; next }
    if (in_ol) { ol_buf = ol_buf $0; next }
}

# --- list open / close ---
/^<ul/ { flush_ol(); in_ul = 1; next }
/^<ol/ { flush_ul(); in_ol = 1; next }

# --- closing container tags on their own line ---
/^<\/ul>/ { flush_ul(); next }
/^<\/ol>/ { flush_ol(); next }
/^<\/div>/ {
    print "</div>"
    print "<!-- /wp:group -->"
    next
}

# Flush lists if we encounter a non-list element
{
    if (in_ul && !/^<li/) flush_ul()
    if (in_ol && !/^<li/) flush_ol()
}

# --- headings h1-h6 ---
/^<h[1-6][ >]/ {
    if (match($0, /^<h([1-6])[^>]*>(.*)<\/h[1-6]>/, m)) {
        lvl = m[1]
        inner = m[2]
        printf "<!-- wp:heading {\"level\":%s} -->\n", lvl
        printf "<h%s class=\"wp-block-heading\">%s</h%s>\n", lvl, inner, lvl
        print "<!-- /wp:heading -->"
        next
    }
}

# --- paragraph ---
/^<p[ >]/ {
    if (match($0, /^<p[^>]*>(.*)<\/p>/, m)) {
        inner = m[1]
        print "<!-- wp:paragraph -->"
        printf "<p>%s</p>\n", inner
        print "<!-- /wp:paragraph -->"
        next
    }
}

# --- image (self-closing) ---
/^<img[ ]/ {
    src = ""; alt = ""
    if (match($0, /src="([^"]*)"/, ms)) src = ms[1]
    if (match($0, /alt="([^"]*)"/, ma)) alt = ma[1]
    print "<!-- wp:image -->"
    printf "<figure class=\"wp-block-image\"><img src=\"%s\" alt=\"%s\" /></figure>\n", src, alt
    print "<!-- /wp:image -->"
    next
}

# --- button (anchor with class containing "button") ---
/^<a [^>]*class="[^"]*button[^"]*"/ {
    href = ""; text = ""
    if (match($0, /href="([^"]*)"/, mh)) href = mh[1]
    if (match($0, /class="[^"]*"[^>]*>(.*)<\/a>/, mt)) text = mt[1]
    print "<!-- wp:button -->"
    printf "<div class=\"wp-block-button\"><a class=\"wp-block-button__link\" href=\"%s\">%s</a></div>\n", href, text
    print "<!-- /wp:button -->"
    next
}

# --- div (wp:group) ---
/^<div/ {
    print "<!-- wp:group -->"
    print "<div class=\"wp-block-group\">"
    next
}

# --- fallback ---
{ print }

END {
    flush_ul()
    flush_ol()
}
'
