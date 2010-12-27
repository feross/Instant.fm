#!/usr/bin/env python

import sys
import os
import re
import json
import io
import base64
import tornado.httpserver
import tornado.ioloop
import tornado.web
import tornado.database

class BaseHandler(tornado.web.RequestHandler):
    @property
    def db(self):
        """Provides access to the database connection"""
        return self.application.db
        
    def base36_10(self, alpha_id):
        """Converts a base 36 id (0-9a-z) to an integer"""
        playlist_id = 0
        index = 0
        while index < len(alpha_id):
            char = alpha_id[index]
            if str.isdigit(char):
                value = int(char)
            else:
                value = ord(char.lower()) - ord('a') + 10
            playlist_id = playlist_id * 36 + value
            
            index += 1
            
        return playlist_id      
        
    def base10_36(self, playlist_id):
        """Converts an integer id to base 36 (0-9a-z)"""
        alpha_id = ''
        while playlist_id > 0:
            value = playlist_id % 36
            playlist_id = playlist_id // 36
            
            if value < 10:
                char = str(value)
            else:
                char = chr(ord('a') + value - 10)
                
            alpha_id = char + alpha_id
            
        return alpha_id
    
    def makePlaylistJSON(self, playlist_entry):
        """Generate the JSON for a given playlist"""
        alpha_id = self.base10_36(playlist_entry.playlist_id)
        title = playlist_entry.title
        description = playlist_entry.description
        songs = playlist_entry.songs
        
        # This is a bit of a hack to build up a JSON string that contains pre-converted
        # JSON data (the songs array), which must not be converted again"""
        playlist = '{"id": ' + json.dumps(alpha_id) + ', "title": ' + json.dumps(title) \
            + ', "description": ' + json.dumps(description) + ', "songs": ' + songs + '}'
        return playlist
    
    def get_error_html(self, status_code, **kwargs):
        """Renders error pages (called internally by Tornado)"""
        if status_code == 404:
            try:
                return open('static/404.html', 'r').read()
            except Exception:
                pass
                
        return super(BaseHandler, self).get_error_html(status_code, **kwargs)
        
        
class PlaylistHandler(BaseHandler):
    """Handles requests for the homepage and inserts the correct playlist JavaScript"""
    
    def _get_playlist(self, playlist_id):
        print "Getting playlist ID: " + str(playlist_id)
        return self.db.get("SELECT * FROM playlists WHERE playlist_id = %s;", playlist_id)
    
    def render_playlist(self, playlist_id):
        """Renders the homepage with the specified playlist.  If the playlist isn't in the database,
        redirects to the homepage."""
        playlist_entry = self._get_playlist(playlist_id)
        
        if playlist_entry is None:
            print "Couldn't find playlist"
            self.redirect("/")
            return
        
        playlist = self.makePlaylistJSON(playlist_entry)
        
        self.render("templates/index.html", playlist=playlist)
    
    def get(self, playlist_alpha_id):
        playlist_id = self.base36_10(playlist_alpha_id)
        self.render_playlist(playlist_id)


class PlaylistJSONHandler(PlaylistHandler):
    """Handles requests to get playlists from the database"""
    
    def render_playlist(self, playlist_id):
        """Renders the specified playlist's JSON representation"""
        playlist_entry = self._get_playlist(playlist_id)
        
        if playlist_entry is None:
            print "Couldn't find playlist"
            self.write(json.dumps({'status': 'Not found'}))
            return
        
        playlist = self.makePlaylistJSON(playlist_entry)
        
        self.write(playlist)


class PlaylistEditHandler(BaseHandler):
    """Handles updates to playlists in the database"""
    
    def _update_playlist(self, playlist_id, songs):
        print "Updating playlist ID: " + str(playlist_id)
        self.db.execute("UPDATE playlists SET songs = %s WHERE playlist_id = %s;", songs, playlist_id)
    
    def post(self, playlist_alpha_id):
        playlist_id = self.base36_10(playlist_alpha_id)
        songs = self.get_argument('songs')
        self._update_playlist(playlist_id, songs)
        self.write(json.dumps({'status': 'Updated'}))
        

class UploadHandler(BaseHandler):
    """Handles playlist upload requests"""
    def _parseM3U(self, contents):
        f = io.StringIO(contents.decode('utf-8'), newline=None)
        res_arr = []

        while True:
            line = f.readline()
            if len(line) == 0:
                break
                
            line = line.rstrip("\n")

            res = re.match("#EXTINF:\d*,(.*) - (.*)", line)
            if res:
                title = res.group(1)
                artist = res.group(2)
                res_arr.append({'t': title, 'a': artist})
                
        return res_arr
        
    def _parse_text(self, contents):
        try:
            decoded = contents.decode('utf-8')
        except Exception:
            decoded = contents.decode('utf-16')
        
        f = io.StringIO(decoded, newline=None)
        res_arr = []
        
        first_line = f.readline()
        
        if re.match("Name\tArtist", first_line):
            while True:
                line = f.readline()
                if len(line) == 0:
                    break
                    
                line = line.rstrip("\n")
                
                res = re.match("([^\t]*)\t([^\t]*)", line)
                if res:
                    title = res.group(1)
                    artist = res.group(2)
                    res_arr.append({'t': title, 'a': artist})        
        
        return res_arr
        
    def _store_playlist(self, name, description, songs):
        new_id = self.db.execute("INSERT INTO playlists (title, description, songs) VALUES (%s,%s,%s)",
            name, description, songs)

        return self.base10_36(new_id)
                
    def _handle_request(self):
        # If the file is directly uploaded in the POST body
        # Make a dict of the headers with all lowercase keys
        lower_headers = dict([(key.lower(), value) for (key, value) in self.request.headers.items()])
        if 'up-filename' in lower_headers:
            filename = lower_headers['up-filename']

            if self.get_argument('base64', 'false') == 'true':
                try:                    
                    contents = base64.b64decode(self.request.body)
                except Exception:
                    return {'status': 'Invalid request'}
            else:
                contents = self.request.body
        # If the file is in form/multipart data
        else:
            if 'file' not in self.request.files or len(self.request.files['file']) == 0:
                return {'status': 'No file specified'}
        
            uploaded_file = self.request.files['file'][0]
            filename = uploaded_file['filename']
            contents = uploaded_file['body']

        name, ext = os.path.splitext(filename)
        
        # Parse the file based on the format
        if ext == ".m3u" or ext == ".m3u8":
            parsed = self._parseM3U(contents)
            
        elif ext == ".txt":
            parsed = self._parse_text(contents)

        else:
            return {'status': 'Unsupported type'}
            
        playlist_id = self._store_playlist(name, "Imported playlist", json.dumps(parsed))
        return {'status': 'ok', 'title': name, 'description': 'Uploaded playlist', 'id': playlist_id, 'songs': parsed}
    
    def post(self):
        self.set_header("Content-Type", "application/json")
        result = self._handle_request()
        self.write(json.dumps(result))
        

class DefaultHandler(BaseHandler):
    """Error handler class.  This could probably be improved"""       
    def prepare(self):
        self.send_error(404)    
    
        
class Application(tornado.web.Application):
    """Custom application class that keeps a database connection"""
    def __init__(self):
        handlers = [
            (r"/upload", UploadHandler),
            (r"/p/([a-zA-Z0-9]*)$", PlaylistHandler),
            (r"/p/([a-zA-Z0-9]*)/json$", PlaylistJSONHandler),
            (r"/p/([a-zA-Z0-9]*)/edit$", PlaylistEditHandler),
            (r".*", DefaultHandler),
        ]
        app_settings = { "debug" : "True" } # always refresh templates
        tornado.web.Application.__init__(self, handlers, **app_settings)
        
        # TODO: Change this to use UNIX domain sockets?
        self.db = tornado.database.Connection(host="localhost", database="instantfm", user="instantfm", password="CXZrPkkJEgk7lAZMnzbk5hb9g")


def main():
    # Check for the -d (debug) argument
    from optparse import OptionParser
    optparser = OptionParser()
    optparser.add_option("-d", action="store_false", dest="daemonize", help="don't dameonize (debug mode)", default=True)
    (options, args) = optparser.parse_args()
    
    if options.daemonize:
        try:
            import daemon
            log = open('tornado.log', 'a+')
            context = daemon.DaemonContext(stdout=log, stderr=log, working_directory='.')
            context.open()
        except ImportError:
            print 'python-daemon not installed; not running as daemon'

    application = Application()
    http_server = tornado.httpserver.HTTPServer(application)
    http_server.listen(8000)

    # Start the main loop
    tornado.ioloop.IOLoop.instance().start()

if __name__ == "__main__":    
    main()
