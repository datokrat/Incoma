<?php
header('Content-Type: text/html; charset=utf-8');

$lines = file('incomadb.conf');
$username = rtrim(str_replace(array("\$username=\"", "\";"), "", $lines[0]));
$password = rtrim(str_replace(array("\$password=\"", "\";"), "", $lines[1]));
$database = rtrim(str_replace(array("\$database=\"", "\";"), "", $lines[2]));
$localhost = rtrim(str_replace(array("\$localhost=\"", "\";"), "", $lines[3]));

$db = new mysqli($localhost, $username, $password, $database);
$db->connect_error and die('{ "success": false, "error": "Unable to connect and select database" }');
$db->query("SET NAMES 'utf8'");

$queryconv="SELECT * FROM conversations WHERE ispublic=1";
$resultconv=$db->query($queryconv) or die('{ "success": false, "error": "Query error #1 whilst loading conversations" }');
//while($convphp[]=mysql_fetch_array($resultconv));
$convphp = $resultconv->fetch_all(MYSQLI_ASSOC);
$numconv=$resultconv->num_rows;

$querylinks = "SELECT `source_conv`, `target_conv`, `type`, COUNT(DISTINCT `type`) AS `numtypes`, COUNT(*) AS `numlinks` FROM `global_links` " .
	"GROUP BY `source_conv`, `target_conv`";
$resultlinks = $db->query($querylinks) or die('{ "success": false, "error": "Query error #2 whilst loading conversations" }');
$links = $resultlinks->fetch_all(MYSQLI_ASSOC);

$db->close();


$dataconv = array();
$data['conversations'] = $convphp;
$data['links'] = $links;

echo json_encode($data);

?>