<?php
/**
 * Convert Tagalog Bible SQL dump to JSON format
 * Run: php tools/convert-tagalog.php
 */

$sqlFile = __DIR__ . '/../BIBLE/TL-Wikang_Tagalog/tagab.sql';
$outDir  = __DIR__ . '/../BIBLE/TL';
$outFile = $outDir . '/TL_bible.json';

// Canonical book order (1-66 maps to standard Protestant canon)
$BOOK_ORDER = [
    1=>'Genesis',2=>'Exodus',3=>'Leviticus',4=>'Numbers',5=>'Deuteronomy',
    6=>'Joshua',7=>'Judges',8=>'Ruth',9=>'1 Samuel',10=>'2 Samuel',
    11=>'1 Kings',12=>'2 Kings',13=>'1 Chronicles',14=>'2 Chronicles',
    15=>'Ezra',16=>'Nehemiah',17=>'Esther',18=>'Job',19=>'Psalms',
    20=>'Proverbs',21=>'Ecclesiastes',22=>'Song of Solomon',23=>'Isaiah',
    24=>'Jeremiah',25=>'Lamentations',26=>'Ezekiel',27=>'Daniel',
    28=>'Hosea',29=>'Joel',30=>'Amos',31=>'Obadiah',32=>'Jonah',
    33=>'Micah',34=>'Nahum',35=>'Habakkuk',36=>'Zephaniah',37=>'Haggai',
    38=>'Zechariah',39=>'Malachi',40=>'Matthew',41=>'Mark',42=>'Luke',
    43=>'John',44=>'Acts',45=>'Romans',46=>'1 Corinthians',47=>'2 Corinthians',
    48=>'Galatians',49=>'Ephesians',50=>'Philippians',51=>'Colossians',
    52=>'1 Thessalonians',53=>'2 Thessalonians',54=>'1 Timothy',55=>'2 Timothy',
    56=>'Titus',57=>'Philemon',58=>'Hebrews',59=>'James',60=>'1 Peter',
    61=>'2 Peter',62=>'1 John',63=>'2 John',64=>'3 John',65=>'Jude',
    66=>'Revelation'
];

if (!file_exists($sqlFile)) {
    echo "ERROR: SQL file not found: $sqlFile\n";
    exit(1);
}

echo "Reading SQL file...\n";
$sql = file_get_contents($sqlFile);

// Parse INSERT statements
$bible = [];
$count = 0;

// Match: INSERT INTO `bible_verses_tagab` VALUES ('id', 'book', 'chapter', 'verse', 'text');
preg_match_all(
    "/VALUES\s*\(\s*'(\d+)'\s*,\s*'(\d+)'\s*,\s*'(\d+)'\s*,\s*'(\d+)'\s*,\s*'((?:[^'\\\\]|\\\\.|'')*)'\s*\)/",
    $sql,
    $matches,
    PREG_SET_ORDER
);

foreach ($matches as $m) {
    $bookNum = (int)$m[2];
    $chapter = (string)$m[3];
    $verse   = (string)$m[4];
    $text    = str_replace(["''", "\\'"], "'", $m[5]);
    $text    = stripslashes($text);
    // Clean paragraph markers
    $text    = preg_replace('/^¶\s*/', '', $text);

    $bookName = $BOOK_ORDER[$bookNum] ?? null;
    if (!$bookName) {
        echo "WARNING: Unknown book number $bookNum, skipping\n";
        continue;
    }

    if (!isset($bible[$bookName])) $bible[$bookName] = [];
    if (!isset($bible[$bookName][$chapter])) $bible[$bookName][$chapter] = [];
    $bible[$bookName][$chapter][$verse] = $text;
    $count++;
}

echo "Parsed $count verses across " . count($bible) . " books\n";

// Create output directory
if (!is_dir($outDir)) {
    mkdir($outDir, 0755, true);
}

// Write JSON
$json = json_encode($bible, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
file_put_contents($outFile, $json);

echo "Written to: $outFile\n";
echo "File size: " . round(strlen($json) / 1024 / 1024, 2) . " MB\n";

// Verify
$books = array_keys($bible);
echo "Books found (" . count($books) . "): " . implode(', ', array_slice($books, 0, 5)) . " ... " . implode(', ', array_slice($books, -3)) . "\n";
echo "Done!\n";
