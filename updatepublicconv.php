<?
$lines = file('incomadb.conf');
$username = rtrim(str_replace(array("\$username=\"", "\";"), "", $lines[0]));
$password = rtrim(str_replace(array("\$password=\"", "\";"), "", $lines[1]));
$database = rtrim(str_replace(array("\$database=\"", "\";"), "", $lines[2]));


mysql_connect(localhost,$username,$password);
@mysql_select_db($database) or die( "Unable to select database");

$queryconvs="SELECT hash FROM public_conversations";
$resultconvs=mysql_query($queryconvs);
while($convlist[]=mysql_fetch_array($resultconvs));

for($i = 0, $size = count($convlist)-1; $i < $size; ++$i) {
       	      $conversation = $convlist[$i][0]; 

	      $querynodes="SELECT time FROM nodes_".$conversation." ORDER BY time";
	      $resultnodes=mysql_query($querynodes);
	      while($nodesphp[]=mysql_fetch_array($resultnodes));
	      $numnodes=mysql_numrows($resultnodes);

	      array_pop($nodesphp);
	      $nodesphp2[]=array_pop($nodesphp);

	      $lasttimenode=$nodesphp2[0][0];

	      $sqlupdate =  'UPDATE public_conversations'.
	      ' SET thoughtnum='.$numnodes.', lasttime='.$lasttimenode.
	      ' WHERE hash="'.$conversation.'"';

	      mysql_query($sqlupdate);

unset($nodesphp);
unset($nodesphp2);

}

mysql_close();


?>