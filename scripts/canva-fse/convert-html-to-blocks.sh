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

# POSIX awk only (mawk on Debian/Ubuntu, BWK awk on macOS): no gawk 3-argument
# match() with a capture array. Helpers below do the capturing with RSTART/RLENGTH.

# Value of the first name="value" attribute in s, or "".
function attr(s, name,    re) {
    re = name "=\"[^\"]*\""
    if (match(s, re)) return substr(s, RSTART + length(name) + 2, RLENGTH - length(name) - 3)
    return ""
}

# Start index of the LAST match of re in s, or 0 (the greedy .* of the old regexes).
function last_index(s, re,    pos, off) {
    pos = 0; off = 1
    while (match(substr(s, off), re)) { pos = off + RSTART - 1; off = pos + 1 }
    return pos
}

# Text between the opening tag matching open_re at the start of s and the last
# closing tag matching close_re; "" when either is missing.
function inner_text(s, open_re, close_re,    t, last) {
    if (!match(s, open_re)) return ""
    t = substr(s, RLENGTH + 1)
    last = last_index(t, close_re)
    if (!last) return ""
    return substr(t, 1, last - 1)
}

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
    if (match($0, /^<h[1-6][^>]*>.*<\/h[1-6]>/)) {
        lvl = substr($0, 3, 1)
        inner = inner_text($0, "^<h[1-6][^>]*>", "<\\/h[1-6]>")
        printf "<!-- wp:heading {\"level\":%s} -->\n", lvl
        printf "<h%s class=\"wp-block-heading\">%s</h%s>\n", lvl, inner, lvl
        print "<!-- /wp:heading -->"
        next
    }
}

# --- paragraph ---
/^<p[ >]/ {
    if (match($0, /^<p[^>]*>.*<\/p>/)) {
        inner = inner_text($0, "^<p[^>]*>", "<\\/p>")
        print "<!-- wp:paragraph -->"
        printf "<p>%s</p>\n", inner
        print "<!-- /wp:paragraph -->"
        next
    }
}

# --- image (self-closing) ---
/^<img[ ]/ {
    src = ""; alt = ""
    src = attr($0, "src")
    alt = attr($0, "alt")
    print "<!-- wp:image -->"
    printf "<figure class=\"wp-block-image\"><img src=\"%s\" alt=\"%s\" /></figure>\n", src, alt
    print "<!-- /wp:image -->"
    next
}

# --- button (anchor with class containing "button") ---
/^<a [^>]*class="[^"]*button[^"]*"/ {
    href = ""; text = ""
    href = attr($0, "href")
    text = inner_text($0, "class=\"[^\"]*\"[^>]*>", "<\\/a>")
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
