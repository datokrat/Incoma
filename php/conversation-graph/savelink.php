<?php
require_once('hash.php');

header('Content-Type: text/html; charset=utf-8');
//$newlinkphp = $_POST['newlinkphp'];
//$conversation = $_POST['conversation'];
$link = json_decode($_POST['data']);
$time = time(); //seconds since Jan 1, 1970, 00:00
$hash = hashInt($link->source . $link->target . $link->author . $link->type . $time); //TODO: Check whether hash is still available

preg_match('/^[a-zA-Z0-9]+$/', $link->conversation) or die('{ "success": false, "error": "Illegal letters found in conversation hash" }');

$lines = file('../incomadb.conf');
$username = rtrim(str_replace(array("\$username=\"", "\";"), "", $lines[0]));
$password = rtrim(str_replace(array("\$password=\"", "\";"), "", $lines[1]));
$database = rtrim(str_replace(array("\$database=\"", "\";"), "", $lines[2]));
$localhost = rtrim(str_replace(array("\$localhost=\"", "\";"), "", $lines[3]));

$db = new mysqli($localhost,$username,$password,$database) or die( '{ "success": false, "error": "Unable to select database" }');
$db->query("SET NAMES 'utf8'");

$sqllink = 'INSERT INTO links_'.$db->real_escape_string($link->conversation).
	'( hash  , source , target, direct, evalpos , evalneg , evaluatedby , adveval, advevalby, type , author , time) '.
	"VALUES ( '{$db->real_escape_string($hash)}' , '{$db->real_escape_string($link->source)}' , '{$db->real_escape_string($link->target)}' , '{$db->real_escape_string($link->direct)}' , 1 , 0  , '{$db->real_escape_string($link->author)}' ,  '0@@@@0@@@@0@@@@0@@@@0@@@@0' ,  '$$$$$$$$$$$$$$$$$$$$' , '{$db->real_escape_string($link->type)}', '{$db->real_escape_string($link->author)}', $time )";

$db->query($sqllink) or die('{ "success": false, "error": '.JSON_encode(mysql_error()).' }');

$db->close();

echo '{ "success": true, "hash": '.$hash.', "evalpos": 1, "evalneg": 0, "time": '.$time.', "evaluatedby": ["'.$link->author.'"], "adveval": [0,0,0,0,0,0], "advevalby": [[],[],[],[],[],[]] }';

?>
