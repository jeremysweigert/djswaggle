<?php
/* =====================================================================
   scores.php  —  shared leaderboard for DJ SWAGGLE vs THE ALGORITHMS
   ---------------------------------------------------------------------
   Drop this file in the SAME folder as swaggle.html on your website.
   The game already calls "scores.php" by default, so there is nothing
   else to wire up. Scores are stored in scores.json next to this file.

   Replacing / updating swaggle.html never touches scores.json, so the
   leaderboard survives every update.

   Requirements:
     - Your web host runs PHP (almost all do).
     - scores.json must be WRITABLE by the web server. If you see scores
       not saving, set its permissions: chmod 664 scores.json   (or 666),
       or just let this script create it (the folder must be writable).
   ===================================================================== */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$FILE = __DIR__ . '/scores.json';

function read_scores($f) {
    if (!file_exists($f)) return array();
    $a = json_decode(@file_get_contents($f), true);
    return is_array($a) ? $a : array();
}

function merge_scores($a, $b) {
    $m = array();
    foreach (array_merge($a ? $a : array(), $b ? $b : array()) as $e) {
        if (!is_array($e) || !isset($e['id'])) continue;
        // sanitise so a bad client can't poison the file
        $id = substr((string)$e['id'], 0, 64);
        $n  = strtoupper(substr((string)(isset($e['n']) ? $e['n'] : 'PLAYER'), 0, 12));
        $s  = max(0, min(1000000000000, intval(isset($e['s']) ? $e['s'] : 0)));
        $d  = intval(isset($e['d']) ? $e['d'] : round(microtime(true) * 1000));
        if (!isset($m[$id]) || $s > $m[$id]['s']) {
            $m[$id] = array('id' => $id, 'n' => $n, 's' => $s, 'd' => $d);
        }
    }
    $out = array_values($m);
    usort($out, function ($x, $y) { return $y['s'] - $x['s']; });
    return array_slice($out, 0, 50);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = file_get_contents('php://input');
    $inc  = json_decode($body, true);
    if (!is_array($inc)) $inc = array();
    if (isset($inc['id'])) $inc = array($inc);   // single object -> array of one

    // lock the file for the whole read-merge-write so two players can't clobber
    $fp = @fopen($FILE, 'c+');
    if ($fp) {
        flock($fp, LOCK_EX);
        $cur = stream_get_contents($fp);
        $curArr = json_decode($cur, true);
        if (!is_array($curArr)) $curArr = array();
        $merged = merge_scores($curArr, $inc);
        rewind($fp);
        ftruncate($fp, 0);
        fwrite($fp, json_encode($merged));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
        echo json_encode($merged);
    } else {
        // couldn't open file (permissions) — at least don't error out the game
        echo json_encode(read_scores($FILE));
    }
    exit;
}

// GET (and anything else) -> return the current board
echo json_encode(read_scores($FILE));
