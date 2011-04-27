import os
import re
import io
import sys
import tornado.web
import bcrypt
import Image
import urllib2
import hashlib
import sqlalchemy

import validation
import utils
import model

class UnsupportedFormatException(Exception): pass


class HandlerBase(tornado.web.RequestHandler):

    """ All handlers should extend this """

    def __init__(self, application, request, **kwargs):
        super(HandlerBase, self).__init__(application, request, **kwargs)
        self.db_session = model.DbSession()

        # Cache the session and user
        self._current_session = None
        self._current_user = None
        self.xsrf_token  # Sets token


    def get_error_html(self, status_code, **kwargs):
        """Renders error pages (called internally by Tornado)"""
        if status_code == 404:
            return open(os.path.join(sys.path[0], '../static/404.html'), 'r').read()

        return super(HandlerBase, self).get_error_html(status_code, **kwargs)

    def get_current_user(self):
        if self._current_user is not None:
            return self._current_user

        self._current_user = self.get_current_session().user

        return self._current_user

    def get_current_session(self):
        if self._current_session is not None:
            return self._current_session

        session_id = self.get_secure_cookie('session_id')
        if session_id:
            self._current_session = (self.db_session.query(model.Session)
                                       .get(session_id))

        if self._current_session == None:
            self._current_session = model.Session()
            self.db_session.add(self._current_session)
            self.db_session.flush()
            print("Setting session cookie: " + str(self._current_session.id))
            self.set_secure_cookie('session_id', str(self._current_session.id))

        return self._current_session

    def get_profile_url(self):
        user = self.get_current_user()
        return '/user/' + user.profile if user is not None else ''

    def owns_playlist(self, playlist):
        if playlist is None:
            return False
        session = self.get_current_session()
        user = self.get_current_user()

        # The Feross Exception
        if user is not None and user.id == 1:
            return True

        return ((session.id is not None and str(session.id) == str(playlist.session_id))
                or (user is not None and str(user.id) == str(playlist.user_id)))

    def get_playlists_for_current_user(self):
        query = self.db_session.query(model.Playlist)
        if self.get_current_user() is not None:
            query = query.filter_by(user_id=self.get_current_user().id)
        else:
            query = query.filter_by(session_id=self.get_current_session().id)
        query = query.order_by(model.Playlist.id.desc())
        return query.all()

    def _log_user_in(self, user, expire_on_browser_close=False):
        # Promote playlists, uploaded images, and session to be owned by user
        session = self.get_current_session()

        (self.db_session.query(model.Playlist)
            .filter_by(session_id=session.id, user_id=None)
            .update({"user_id": user.id}))

        (self.db_session.query(model.Image)
            .filter_by(session_id=session.id, user_id=None)
            .update({"user_id": user.id}))

        session.user_id = user.id
        self.db_session.flush()
        return user.client_visible_attrs

    def _log_user_out(self):
        session_id = self.get_secure_cookie('session_id')
        self.clear_cookie('session_id')
        self._current_session = None
        if session_id:
            (self.db_session.query(model.Session)
                .filter_by(id=session_id)
                .delete())

        # New session
        new_session = model.Session();
        self.db_session.add(new_session)
        self.db_session.flush()
        self.set_secure_cookie('session_id', str(new_session.id))
        return new_session


class PlaylistHandlerBase(HandlerBase):
    """ Any handler that involves playlists should extend this.
    """

    def _render_playlist_view(self, template_name, playlist=None, title=None, share=None, **kwargs):
        if title is None and playlist is not None:
            title = playlist.title

        self.render(template_name, playlist=playlist, share=share, title=title, **kwargs)


class UserHandlerBase(HandlerBase):
    def _verify_password(self, password, hashed):
        return bcrypt.hashpw(password, hashed) == hashed

    def _hash_password(self, password):
        return bcrypt.hashpw(password, bcrypt.gensalt())

    def _is_registered_fbid(self, fb_id):
        return self.db_session.query(model.User).filter_by(fb_id=fb_id).count() > 0


class ImageHandlerBase(HandlerBase):
    STATIC_DIR = 'static'
    IMAGE_DIR = '/images/uploaded/'

    def _crop_to_square(self, image):
        cropped_side_length = min(image.size)
        square = ((image.size[0] - cropped_side_length) / 2,
                  (image.size[1] - cropped_side_length) / 2,
                  (image.size[0] + cropped_side_length) / 2,
                  (image.size[1] + cropped_side_length) / 2)
        return image.crop(square)

    def _resize(self, image, side_length):
        image = image.copy()
        size = (side_length, side_length)
        image.thumbnail(size, Image.ANTIALIAS)
        return image

    def _save_image(self, image_id, image_format, image):
        filename = '{0:x}-{1}x{2}.{3}'.format(image_id,
                                              image.size[0],
                                              image.size[1],
                                              image_format.lower())
        path = os.path.join(self.IMAGE_DIR, filename)
        image.save(self.STATIC_DIR + path, img_format=image.format)
        return path

    def _is_valid_image(self, data):
        try:
            image = Image.open(data)
            image.verify()
        except:
            return False

        data.seek(0)
        return True

    def _handle_image(self, data, playlist_id):
        result = {'status': 'OK', 'images': {}}

        if self._is_valid_image(data) == False:
            result['status'] = 'No valid image at that URL.'
            return result

        image = model.Image()
        image.user = self.get_current_user()
        image.session = self.get_current_session()
        self.db_session.add(image)
        playlist = self.db_session.query(model.Playlist).get(playlist_id)
        playlist.image = image
        self.db_session.commit()

        original_image = Image.open(data)
        cropped_image = self._crop_to_square(original_image)

        image.original = self._save_image(image.id, original_image.format, original_image)
        image.medium = self._save_image(image.id, original_image.format, self._resize(cropped_image, 160))
        self.db_session.commit()


class HomeHandler(HandlerBase):
    def get(self):
        categories = []
        used_playlist_ids = set()

        my_lists_title = ('My Playlists' if self.get_current_user() is None
                          else self.get_current_user().name + "'s Playlists")
        categories.append({
            'title': my_lists_title,
            'playlists': self.get_playlists_for_current_user()
        })

        staff_picks = (self.db_session.query(model.Playlist)
                           .filter_by(featured=True)
                           .order_by(model.Playlist.views.desc())
                           .limit(8)
                           .all())
        categories.append({
            'title': 'Staff Picks',
            'playlists': staff_picks,
        })
        used_playlist_ids |= set([playlist.id for playlist in staff_picks])

        categories.append({
            'title': 'Popular',
            'playlists': (self.db_session.query(model.Playlist)
                             .filter(model.Playlist._songs != '[]')
                             .filter(model.Playlist.user_id != None)
                             .filter(model.Playlist.session_id != None)
                             .filter(model.Playlist.hide == 0)
                             .filter(sqlalchemy.not_((model.Playlist.id.in_(used_playlist_ids))))
                             .order_by(model.Playlist.views.desc())
                             .limit(12)
                             .all()
            )})

        self.render("index.html",
                    title="Instant.fm - Share Music Instantly",
                    categories=categories)


class TermsHandler(HandlerBase):
    def get(self):
        self.render("terms.html")


class PlaylistHandler(PlaylistHandlerBase):
    """Landing page for a playlist"""
    def get(self, playlist_alpha_id):
        playlist_id = utils.base36_10(playlist_alpha_id)
        playlist = self.db_session.query(model.Playlist).get(playlist_id)
        if playlist is None:
            return self.send_error(404)
        playlist.views += 1

        if self.get_argument('json', default=False):
            self.write(playlist.json())
        else:
            self._render_playlist_view('playlist.html', playlist=playlist)


class SearchHandler(PlaylistHandlerBase):
    # TODO: Make this actually work.
    def get(self):
        self._render_playlist_view('search.html')


class ArtistHandler(PlaylistHandlerBase):
    """ Renders an empty artist template """
    def get(self, requested_artist_name):
        artist_name = utils.deurlify(requested_artist_name)
        self._render_playlist_view('artist.html',
                                   artist_name=artist_name)


class AlbumHandler(PlaylistHandlerBase):
    def get(self, requested_artist_name, requested_album_name):
        """ Renders an empty album template """
        artist_name = utils.deurlify(requested_artist_name)
        album_name = utils.deurlify(requested_album_name)
        self._render_playlist_view('album.html',
                                   artist_name=artist_name,
                                   album_name=album_name)


class SongHandler(PlaylistHandlerBase):
    def get(self, requested_artist_name, requested_song_name):
        """ Renders an empty album template """
        share = None
        artist_name = utils.deurlify(requested_artist_name)
        song_name = utils.deurlify(requested_song_name)
        
        yt = self.get_argument('yt', None)
        img = self.get_argument('img', None)
        
        if yt is not None and img is not None:
            share = {'yt': yt,
                     'img': img}
        
        self._render_playlist_view('song.html',
                                   artist_name=artist_name,
                                   song_name=song_name,
                                   title = song_name + ' by ' + artist_name,
                                   share=share)


class UploadHandler(PlaylistHandlerBase):

    """ Handles playlist upload requests """

    def _has_uploaded_files(self):
        files = self.request.files
        if 'file' not in files or len(files['file']) == 0:
            return False
        return True

    def _get_request_content(self):
        file = self.request.files['file'][0]
        filename = file['filename']
        contents = file['body']
        return (filename, contents)

    def _parseM3U(self, contents):
        f = io.StringIO(contents.decode('utf-8'), newline=None)

        first_line = f.readline()
        if not re.match(r"#EXTM3U", first_line):
            return None

        # Attempt to guess if the artist/title are in iTunes order
        itunes_format = False
        while True:
            line = f.readline()
            if len(line) == 0:
                break

            if re.match(r"[^#].*([/\\])iTunes\1", line):
                itunes_format = True
                break

        f.seek(0)

        res_arr = []
        while True:
            line = f.readline()
            if len(line) == 0:
                break

            line = line.rstrip("\n")

            if itunes_format:
                res = re.match(r"#EXTINF:\d*,(.*) - (.*)", line)
                if res:
                    title = res.group(1)
                    artist = res.group(2)
                    res_arr.append({'t': title, 'a': artist})

            else:
                # Slightly different regex to handle dashes in song titles better
                res = re.match(r"#EXTINF:\d*,(.*?) - (.*)", line)
                if res:
                    artist = res.group(1)
                    title = res.group(2)
                    res_arr.append({'t': title, 'a': artist})

        return res_arr

    def _parse_text(self, contents):
        try:
            decoded = contents.decode('utf-8')
        except:
            decoded = contents.decode('utf-16')

        f = io.StringIO(decoded, newline=None)

        first_line = f.readline()
        if not re.match(r"Name\tArtist", first_line):
            return None

        res_arr = []
        while True:
            line = f.readline()
            if len(line) == 0:
                break

            line = line.rstrip("\n")

            res = re.match(r"([^\t]*)\t([^\t]*)", line)
            if res:
                title = res.group(1)
                artist = res.group(2)
                res_arr.append({'t': title, 'a': artist})

        return res_arr

    def _parse_pls(self, contents):
        f = io.StringIO(contents.decode('utf-8'), newline=None)

        first_line = f.readline()
        if not re.match(r"\[playlist\]", first_line):
            return None

        res_arr = []
        while True:
            line = f.readline()
            if len(line) == 0:
                break

            line = line.rstrip("\n")

            res = re.match(r"Title\d=(.*?) - (.*)", line)
            if res:
                artist = res.group(1)
                title = res.group(2)
                res_arr.append({'t': title, 'a': artist})

        return res_arr

    def _parse_songs_from_uploaded_file(self):
        (filename, contents) = self._get_request_content()
        ext = os.path.splitext(filename)[1]

        # Parse the file based on the format
        songs = None
        if ext == ".m3u" or ext == ".m3u8":
            songs = self._parseM3U(contents)

        elif ext == ".txt":
            songs = self._parse_text(contents)

        elif ext == ".pls":
            songs = self._parse_pls(contents)

        if songs is None:
            raise(UnsupportedFormatException())

        return songs


    @validation.validated
    def post(self):
        """ Handles the "New Playlist" form post.
        
        This can't be JSON RPC because of the file uploading.
        """
        validator = validation.Validator(immediate_exceptions=True)
        title = self.get_argument('title', default='', strip=True)
        validator.add_rule(title, 'Title', min_length=1)
        description = self.get_argument('description', default=None, strip=True)
        songs = []

        if self._has_uploaded_files():
            try:
                songs = self._parse_songs_from_uploaded_file()
            except UnsupportedFormatException:
                validator.error('Unsupported format.')

        playlist = model.Playlist(title)
        playlist.description = description
        playlist.songs = songs
        playlist.session = self.get_current_session()
        playlist.user = self.get_current_user()
        self.db_session.add(playlist)
        self.db_session.flush()

        self.set_header("Content-Type", "application/json")
        return playlist.client_visible_attrs;


class ProfileHandler(PlaylistHandlerBase):
    def get(self, requested_user_name):
        self._render_playlist_view('profile.html', playlist=None)


class TTSHandler(PlaylistHandlerBase):
    q = None

    @tornado.web.asynchronous
    def get(self):
        self.q = self.get_argument("q")
        self.set_header("Content-Type", "audio/mpeg")

        q_encoded = urllib2.quote(self.q.encode("utf-8"))
        url = "http://translate.google.com/translate_tts?q=" + q_encoded + "&tl=en"
        http = tornado.httpclient.AsyncHTTPClient()
        http.fetch(url, callback=self.on_response)

    def on_response(self, response):
        if response.error: raise tornado.web.HTTPError(500)
        filename = hashlib.sha1(self.q.encode('utf-8')).hexdigest()

        fileObj = open(os.path.join(os.path.dirname(__file__), "../static/tts/" + filename + ".mp3"), "w")
        fileObj.write(response.body)
        fileObj.close()
        self.write(response.body)
        self.finish()

class ErrorHandler(HandlerBase):
    def prepare(self):
        self.send_error(404)
