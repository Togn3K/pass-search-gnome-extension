import Gio from 'gi://Gio';


/**
 * Recursively enumerate all .gpg entries in the password store.
 * Returns an array of relative paths without the .gpg extension.
 * Skips hidden directories (like .git).
 */
export function getAllEntries(storeDir) {
    const entries = [];
    const baseDir = Gio.File.new_for_path(storeDir);

    if (!baseDir.query_exists(null))
        return entries;

    _walkDir(baseDir, baseDir, entries);
    entries.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    return entries;
}

function _walkDir(baseDir, dir, entries) {
    const enumerator = dir.enumerate_children(
        'standard::name,standard::type',
        Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
        null
    );

    let info;
    while ((info = enumerator.next_file(null)) !== null) {
        const name = info.get_name();

        // Skip hidden files/dirs
        if (name.startsWith('.'))
            continue;

        const child = dir.get_child(name);
        const fileType = info.get_file_type();

        if (fileType === Gio.FileType.DIRECTORY) {
            _walkDir(baseDir, child, entries);
        } else if (name.endsWith('.gpg')) {
            const relativePath = baseDir.get_relative_path(child);
            // Remove .gpg suffix
            entries.push(relativePath.slice(0, -4));
        }
    }
}

/**
 * Fuzzy match: checks if all characters of `pattern` appear in `text`
 * in order (case-insensitive). Returns true/false.
 */
export function fuzzyMatch(pattern, text) {
    let pi = 0;
    for (let ti = 0; ti < text.length && pi < pattern.length; ti++) {
        if (pattern[pi] === text[ti])
            pi++;
    }
    return pi === pattern.length;
}

/**
 * Fuzzy scoring: higher score = better match.
 * Rewards:
 *  - Consecutive character matches
 *  - Matches at word boundaries (after / - _ or start)
 *  - Exact substring matches
 * Returns 0 if no match.
 */
export function fuzzyScore(pattern, text) {
    if (pattern.length === 0)
        return 0;

    if (!fuzzyMatch(pattern, text))
        return 0;

    // Bonus for exact substring
    const substringIdx = text.indexOf(pattern);
    if (substringIdx >= 0)
        return 1000 + (text.length - pattern.length === 0 ? 500 : 0);

    let score = 0;
    let pi = 0;
    let consecutive = 0;
    let prevMatchIdx = -2;

    for (let ti = 0; ti < text.length && pi < pattern.length; ti++) {
        if (pattern[pi] === text[ti]) {
            // Base score for a match
            let charScore = 10;

            // Consecutive bonus
            if (ti === prevMatchIdx + 1) {
                consecutive++;
                charScore += consecutive * 5;
            } else {
                consecutive = 0;
            }

            // Word boundary bonus
            if (ti === 0 || '/\\-_ '.includes(text[ti - 1]))
                charScore += 20;

            // Camel case boundary
            if (ti > 0 && text[ti] >= 'A' && text[ti] <= 'Z' &&
                text[ti - 1] >= 'a' && text[ti - 1] <= 'z')
                charScore += 15;

            score += charScore;
            prevMatchIdx = ti;
            pi++;
        }
    }

    // Penalize longer texts slightly (prefer shorter, more precise matches)
    score -= (text.length - pattern.length) * 0.5;

    return score;
}
