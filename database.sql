/* Ubuntu: sudo apt-get install libmysqlclient-dev python2.6-dev
    sudo easy_install MySQL-python
    
    To get easy_install:
    sudo apt-get install python-setuptools (I think)
*/

CREATE TABLE `playlists` (
  `playlist_id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(100) DEFAULT NULL,
  `description` text,
  `songs` mediumtext,
  PRIMARY KEY (`playlist_id`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=latin1;