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
    this.playlist = playlist;
};

Model.prototype.isEditable = function() {
	return isOwner();
}

// Move song in the playlist
// @oldIndex - old playlist position
// @newIndex - new playlist position
Model.prototype.moveSong = function(oldIndex, newIndex) {
    var songData = model.playlist.songs[oldIndex];
    this.playlist.songs.splice(oldIndex, 1);
    this.playlist.songs.splice(newIndex, 0, songData);
    this.saveSongs();
};

Model.prototype.addSong = function(song) {
    this.playlist.songs.push(song);
    this.saveSongs();
};

Model.prototype.removeSong = function(songNum) {
    this.playlist.songs.splice(songNum, 1);
    this.saveSongs();
};

Model.prototype.saveSongs = function() {
    model.savePlaylist('&songs='+encodeURIComponent(JSON.stringify(model.playlist.songs)));
};

Model.prototype.updateTitle = function(newTitle) {
    model.playlist.title = $.trim(newTitle);
    
    model.savePlaylist('&title='+model.playlist.title);
};

Model.prototype.updateDesc = function(newDesc) {
    model.playlist.description = $.trim(newDesc);
    
    model.savePlaylist('&description='+model.playlist.description);
};

Model.prototype.updateAlbumImg = function(index, albumImg) {
    model.playlist.songs[index].i = albumImg;
    model.saveSongs();
};

Model.prototype.savePlaylist = function(data) {
    if (!model.isEditable()) {
        log('Playlist not saved. Playlist is uneditable.');
        return;
    }
    
    var edit_url = model.playlist.url+'/edit';
    $.ajax({
        data: data,
        dataType: 'json',
        type: 'POST',
        url: edit_url,
        success: function(responseData, textStatus, XMLHttpRequest) {
            log('Server received updated playlist.');
        }
    });
};