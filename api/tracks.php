<?php

  function fisherYatesShuffle(&$items, $seed) {
    @mt_srand($seed);
    for ($i = count($items) - 1; $i > 0; $i--) {
      $j = @mt_rand(0, $i);
      $tmp = $items[$i];
      $items[$i] = $items[$j];
      $items[$j] = $tmp;
    }
  }

  $valid_channels = ["electronic", "downtempo", "classical", "rain"];

  $tracks_json = file_get_contents("tracks.json");
  $tracks = json_decode($tracks_json, true);

  $timestamp = 0;
  $offset = 0;
  $channel = "electronic";

  if (isset($_GET['offset']) && is_numeric($_GET['offset'])) {
    $offset = $_GET['offset'];
  }

  if (isset($_GET['timestamp']) && is_numeric($_GET['timestamp'])) {
    $timestamp = $_GET['timestamp'];
  }

  if (isset($_GET['channel']) && in_array($_GET['channel'], $valid_channels)) {
    $channel = $_GET['channel'];
  }

  $track_count = count($tracks[$channel]);

  fisherYatesShuffle($tracks[$channel], $timestamp);

  // If the offset is greater than the number of tracks we have available,
  // loop back to the beginning by subtracting the total amount of tracks we have
  // until we get a track in range
  if ($offset >= $track_count) {
    do {
      $offset = $offset - $track_count;
    } while ($offset >= $track_count);
  }

  $track_json = json_encode($tracks[$channel][$offset]);
  echo($track_json);

?>