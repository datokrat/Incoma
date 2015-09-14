<?php
function hashInt($str) {
	$hash = 5381;
	$chars = array_map(function($c) { return ord($c); }, str_split($str));
	foreach($chars as $c) {
		$hash = (($hash << 5) + $hash) + $c; /* hash * 33 + c */
		$hash = $hash % pow(2,32);
	}
	return abs($hash);
}
?>
