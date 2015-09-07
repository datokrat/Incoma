<?php
header('Content-Type: text/html; charset=utf-8');

$conversation= $_GET['conversation'];

$lines = file('incomadb.conf');
$username = rtrim(str_replace(array("\$username=\"", "\";"), "", $lines[0]));
$password = rtrim(str_replace(array("\$password=\"", "\";"), "", $lines[1]));
$database = rtrim(str_replace(array("\$database=\"", "\";"), "", $lines[2]));
$localhost = rtrim(str_replace(array("\$localhost=\"", "\";"), "", $lines[3]));

$db = new mysqli($localhost, $username, $password, $database);
$db->connect_error and die('{ "success": false, "error": "Unable to select database" }');

$db->query("SET NAMES 'utf8'");

$querynodes="SELECT * FROM nodes_{$db->real_escape_string($conversation)}";
$resultnodes=$db->query($querynodes);
$nodesphp = $resultnodes->fetch_all(MYSQLI_ASSOC);
$numnodes=$resultnodes->num_rows;

$querylinks="SELECT * FROM links_{$db->real_escape_string($conversation)}";
$resultlinks=$db->query($querylinks);
$linksphp = $resultlinks->fetch_all(MYSQLI_ASSOC);
$numlinks = $resultlinks->num_rows;

$queryIncomingGlobalLinks = "SELECT `source_conv`, `source`, `target`, `type` FROM `global_links` WHERE `target_conv`='{$db->real_escape_string($conversation)}'";
$resultIncomingGlobalLinks = $db->query($queryIncomingGlobalLinks);
$incomingGlobalLinks = $resultIncomingGlobalLinks->fetch_all(MYSQLI_ASSOC);

$queryOutgoingGlobalLinks = "SELECT `target_conv`, `source`, `target`, `type` FROM `global_links` WHERE `source_conv`='{$db->real_escape_string($conversation)}'";
$resultOutgoingGlobalLinks = $db->query($queryOutgoingGlobalLinks);
$outgoingGlobalLinks = $resultOutgoingGlobalLinks->fetch_all(MYSQLI_ASSOC);

$db->close();


$data = array();
$data['nodes'] = $nodesphp;
$data['links'] = $linksphp;
$data['incomingGlobalLinks'] = $incomingGlobalLinks;
$data['outgoingGlobalLinks'] = $outgoingGlobalLinks;

echo json_encode($data, JSON_UNESCAPED_UNICODE);

?>
