/* --------------------------- MODEL --------------------------- */

function Model(playlist) {
    playlist && this.updatePlaylist(playlist);
    
    var cache;
    if (Modernizr.localstorage) {
	    cache = new LastFMCache();
	}
	this.lastfm = new LastFM({
		apiKey    : '414cf82dc17438b8c880f237a13e5c09',
		cache     : cache
	});
}
    
Model.prototype.updatePlaylist = function(playlist) {
    this.playlistId  = playlist.playlist_id || -1;
    this.title       = playlist.title;
    this.description = playlist.description;
    this.songs       = playlist.songs || [];
    this.editable    = playlist.editable || false;
    this.session_id  = playlist.session_id || -1;
    this.user_id     = playlist.user_id || -1;
};

// Move song in the playlist
// @oldIndex - old playlist position
// @newIndex - new playlist position
Model.prototype.moveSong = function(oldIndex, newIndex) {
    var songData = model.songs[oldIndex];
    this.songs.splice(oldIndex, 1);
    this.songs.splice(newIndex, 0, songData);
    this.saveSongs();
};

Model.prototype.addSong = function(song) {
    this.songs.push(song);
    this.saveSongs();
};

Model.prototype.saveSongs = function() {
    model.savePlaylist('&songs='+encodeURIComponent(JSON.stringify(model.songs)));
};

Model.prototype.updateTitle = function(newTitle) {
    model.title = $.trim(newTitle);
    
    model.savePlaylist('&title='+model.title);
};

Model.prototype.updateDesc = function(newDesc) {
    model.description = $.trim(newDesc);
    
    model.savePlaylist('&description='+model.description);
};

Model.prototype.updateAlbumImg = function(index, albumImg) {
    model.songs[index].i = albumImg;
    model.saveSongs();
};

Model.prototype.savePlaylist = function(data) {
    if (!model.editable) {
        log('Playlist not saved. Playlist is uneditable.');
        return;
    }
    
    var the_url = '/p/'+model.playlistId+'/edit';
    $.ajax({
        data: data,
        dataType: 'json',
        type: 'POST',
        url: the_url,
        success: function(responseData, textStatus, XMLHttpRequest) {
            // TODO: Show a throbber while request is being sent.
            log('Server received updated playlist.');
        }
    });
};