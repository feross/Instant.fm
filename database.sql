CREATE TABLE `playlists` (
  `playlist_id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(100) DEFAULT NULL,
  `description` text,
  `songs` mediumtext,
  PRIMARY KEY (`playlist_id`)
) ENGINE=MyISAM CHARSET=utf8;