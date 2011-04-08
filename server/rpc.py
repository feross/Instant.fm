'''
Created on Apr 7, 2011

@author: dinkydogg
'''

import functools
import tornadorpc.json
import tornado.auth

import handlers
import model
import utils
import type_enforcement
import validation


class MustOwnPlaylistException(Exception): pass


def owns_playlist(method):
    """ Decorator: throws an exception if user doesn't own current playlist
    
    NOTE: playlist_id must be the 1st positional arg. If you put some other
    value as the 1st positional arg it could be a security issue (as this 
    would check that the user owns the wrong playlist ID.) So make sure 
    playlist_id is the first positional arg.
    
    I need to read more about python to figure out if there's a better way to
    do this.
    """
    @functools.wraps(method)
    def wrapper(self, *args, **kwargs):
        playlist_id = (kwargs['playlist_id']
                       if 'playlist_id' in kwargs
                       else args[0])
        playlist = self.db_session.query(model.Playlist).get(playlist_id)
        if not self.owns_playlist(playlist):
            raise MustOwnPlaylistException()
        return method(self, *args, **kwargs)
    return wrapper


class JsonRpcHandler(tornadorpc.json.JSONRPCHandler,
                     handlers.PlaylistHandlerBase,
                     handlers.UserHandlerBase,
                     handlers.ImageHandlerBase,
                     tornado.auth.FacebookGraphMixin):

    @owns_playlist
    @type_enforcement.types(playlist_id=int, songs=list)
    def update_songlist(self, playlist_id, songs):
        self.db_session.query(model.Playlist).get(playlist_id).songs = songs
        self.db_session.flush()

    @owns_playlist
    @type_enforcement.types(playlist_id=int, title=unicode)
    def update_title(self, playlist_id, title):
        self.db_session.query(model.Playlist).get(playlist_id).title = title
        self.db_session.flush()

    @owns_playlist
    @type_enforcement.types(playlist_id=int, description=unicode)
    def update_description(self, playlist_id, description):
        self.db_session.query(model.Playlist).get(playlist_id).description = description
        self.db_session.flush()

    @type_enforcement.types(fb_id=int)
    def is_registered_fbid(self, fb_id):
        """ Wraps the inherited function so it can be called via RPC """
        return self._is_registered_fbid(fb_id)

    @validation.async_and_validated
    @owns_playlist
    @type_enforcement.types(playlist_id=int, url=unicode)
    def set_image_from_url(self, playlist_id, url):
        self.playlist_id = playlist_id
        http = tornado.httpclient.AsyncHTTPClient()
        http.fetch(url, callback=self._on_set_image_from_url_response)

    def _on_set_image_from_url_response(self, response):
        result = self._handle_image(response.buffer, self.playlist_id)
        self.result(result)

    @validation.async_and_validated
    @type_enforcement.types(email=unicode, password=unicode, remember_me=bool)
    def login(self, email, password, remember_me):
        email = email.strip()
        validator = validation.Validator(immediate_exceptions=True)

        user = self.db_session.query(model.User).filter_by(email=email).first()
        if not user:
            validator.error('No user with that email found.', 'Email')

        if not self._verify_password(password, user.password):
            validator.error('Incorrect password.', 'Password')

        # If we haven't failed out yet, the login is valid.
        self._log_user_in(user, expire_on_browser_close=(not remember_me))
        self.result(user.client_visible_attrs)

    def logout(self):
        self._log_user_out()
        return True

    @validation.async_and_validated
    @type_enforcement.types(title=unicode, description=unicode)
    def new_playlist(self, title, description):
        title = title.strip()
        description = description.strip()
        validator = validation.Validator(immediate_exceptions=False)
        validator.add_rule(title, 'Title', min_length=1, max_length=64)
        validator.add_rule(description, 'Description', min_length=1, max_length=64)
        validator.validate()

        playlist = model.Playlist(title)
        playlist.description = description
        playlist.session = self.get_current_session()
        self.db_session.add(playlist)
        self.result(playlist.client_visible_attrs)

    @validation.async_and_validated
    @type_enforcement.types(name=unicode, email=unicode, password=unicode,
                            fb_id=int, auth_token=int)
    def signup_with_fbid(self, name, email, password, fb_id, auth_token):
        email = email.strip()
        name = name.strip()
        validator = validation.Validator(immediate_exceptions=False)
        validator.add_rule(email, 'Email', email=True)
        validator.add_rule(name, 'Name', min_length=4, max_length=64)
        validator.add_rule(password, 'Password', min_length=6, max_length=64)
        validator.validate()

        # Make sure that FBID and email aren't already taken
        if self.db_session.query(model.User).filter_by(fb_id=fb_id).count() > 0:
            validator.error('This Facebook user is already registered on Instant.fm. Try logging in instead.')
            validator.validate()
        if self.db_session.query(model.User).filter_by(email=email).count() > 0:
            validator.error('This email is already registered on Instant.fm. Try logging in instead.')
            validator.validate()

        # Cache parameters for use in callback
        self._name = name
        self._email = email
        self._password = password
        self._fb_id = fb_id
        self._auth_token = auth_token

        # Authenticate to Facebook
        self.facebook_request(
            "/me",
            access_token=auth_token,
            callback=self.async_callback(self._on_fb_auth))

    @validation.async_and_validated
    def _on_fb_auth(self, user):
        validation.Validator = validation.Validator(immediate_exceptions=True)
        # TODO: Re-enable this before launch.
        #if user['id'] != self._fb_id:
        #    validator.error('Failed to authenticate to Facebook.')

        # Write the user to DB
        user = model.User()
        user.fb_id = self._fb_id
        user.name = self._name
        user.email = self._email
        user.password = self._hash_password(self._password)
        user.profile = self._generate_unique_profile_url(self._name)
        self.db_session.add(user)

        self._log_user_in(user)
        self.result(user.client_visible_attrs)

    def _generate_unique_profile_url(self, name):
        ''' Find an unused profile url to use '''
        profile = prefix = utils.urlify(name)
        collisions = [user.profile for user in
                        (self.db_session.query(model.User)
                         .filter(model.User.profile.startswith(prefix))
                         .all())]
        suffix = 0
        while profile in collisions:
            suffix += 1
            profile = prefix + '-' + str(suffix)

        return profile
