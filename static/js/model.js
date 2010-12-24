var Model = function(playlist) {
    playlist && this.updatePlaylist(playlist);
};

Model.prototype.updatePlaylist = function(playlist) {
    this.playlistId  = playlist.id || -1;
    this.title       = playlist.title;
    this.description = playlist.description;
    this.songs       = playlist.songs || [];
};

Model.prototype.moveSong = function(oldIndex, newIndex) {
    var songData = model.songs[oldIndex];
    model.songs.splice(oldIndex, 1);
    model.songs.splice(newIndex, 0, songData);
}

