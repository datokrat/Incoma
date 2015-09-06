<?php
header('Content-Type: text/html; charset=utf-8');

$weblang= $_GET['weblang'];

$langfile = file('lang-'.$weblang.'.txt');

echo json_encode($langfile);

?>