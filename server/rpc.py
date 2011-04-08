'''
Created on Apr 7, 2011

@author: dinkydogg
'''

import functools
import tornadorpc.json
import tornadorpc.base
import jsonrpclib.jsonrpc
import re
import tornado
import tornado.auth

import handlers
import model
import utils
import type_enforcement


class MustOwnPlaylistException(Exception): pass


class InvalidParameterException(Exception):
    def __init__(self, errors):
        self.errors = errors


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

def validated(method):
    """ Wraps a method so that it will return a dictionary with attributes indicating validation success or failure with errors or results.
    
    This is the hackiest function I ever wrote, but the results are actually quite nice. It is intended for use as a decorator on RPC methods in a JSON RPC handler. It overrides the handler's result method in order to rap the results, and catches any exceptions thrown by a validator in order to return error messages to the client. Useful for forms. """
    @functools.wraps(method)
    def wrapper(self, *args, **kwargs):
        def result_with_validation(result):
            if (result.__class__ is not jsonrpclib.jsonrpc.Fault
                and (result.__class__ is not dict or "success" not in result)):
                result = {"success": True, "result": result}
            super(JsonRpcHandler, self).result(result)
        self.result = result_with_validation
        try:
            result = method(self, *args, **kwargs)
        except InvalidParameterException as e:
            result = {
                 "success": False,
                 "errors": e.errors
            }
        return result
    return wrapper


def validated_async(method):
    """ Wraps a method so that it will return a dictionary with attributes indicating validation success or failure with errors or results.
    
    This is the hackiest function I ever wrote, but the results are actually quite nice. It is intended for use as a decorator on RPC methods in a JSON RPC handler. It overrides the handler's result method in order to rap the results, and catches any exceptions thrown by a validator in order to return error messages to the client. Useful for forms. """
    @functools.wraps(method)
    def wrapper(self, *args, **kwargs):
        def result_with_validation(result):
            if (result.__class__ is not jsonrpclib.jsonrpc.Fault
                and (result.__class__ is not dict or "success" not in result)):
                result = {"success": True, "result": result}
            super(JsonRpcHandler, self).result(result)
        self.result = result_with_validation
        try:
            result = method(self, *args, **kwargs)
        except InvalidParameterException as e:
            result = {
                 "success": False,
                 "errors": e.errors
            }
        self.result(result)
    return wrapper

class Validator(object):
    def __init__(self, immediate_exceptions=False):
        self._immediate_exceptions = immediate_exceptions
        self.errors = {}


    def has_errors(self):
        return len(self.errors) > 0

    def validate(self):
        if self.has_errors():
            raise InvalidParameterException(self.errors)

    def error(self, message, name=''):
        self.errors[name] = message
        if self._immediate_exceptions:
            raise InvalidParameterException(self.errors)

    def add_rule(self, value, name='', min_length=None, max_length=None, email=None):
        if email is not None:
            self._check_email(value, name)
        if min_length is not None:
            self._check_min_length(value, name, min_length)
        if max_length is not None:
            self._check_max_length(value, name, max_length)

    def _check_email(self, value, name):
        email_regex = re.compile('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$')
        if None == email_regex.match(value):
            self.error("Must be a valid email.", name)

    def _check_min_length(self, value, name, min_length):
        if len(value) < min_length:
            self.error("Must be at least {0} characters.".format(min_length), name)

    def _check_max_length(self, value, name, max_length):
        if len(value) > max_length:
            self.error("Must be at most " + max_length + " characters.", name)


class JsonRpcHandler(tornadorpc.json.JSONRPCHandler, handlers.PlaylistHandlerBase,
                     handlers.UserHandlerBase, handlers.ImageHandlerBase, tornado.auth.FacebookGraphMixin):

    @validated
    def validation_test(self, str):
        validator = Validator()
        validator.add_rules(str, 'str', email=True)
        validator.validate()
        return str

    @owns_playlist
    @type_enforcement.types(playlist_id=int, songs=list)
    def update_songlist(self, playlist_id, songs):
        self.db_session.query(model.Playlist).get(playlist_id).songs = songs
        self.db_session.commit()

    @owns_playlist
    @type_enforcement.types(playlist_id=int, title=unicode)
    def update_title(self, playlist_id, title):
        self.db_session.query(model.Playlist).get(playlist_id).title = title
        self.db_session.commit()

    @owns_playlist
    @type_enforcement.types(playlist_id=int, description=unicode)
    def update_description(self, playlist_id, description):
        self.db_session.query(model.Playlist).get(playlist_id).description = description
        self.db_session.commit()

    @type_enforcement.types(fb_id=int)
    def is_registered_fbid(self, fb_id):
        """ Wraps the inherited function so it can be called via RPC """
        return self._is_registered_fbid(fb_id)

    @tornadorpc.async
    @owns_playlist
    @type_enforcement.types(playlist_id=int, url=unicode)
    def set_image_from_url(self, playlist_id, url):
        self.playlist_id = playlist_id
        http = tornado.httpclient.AsyncHTTPClient()
        http.fetch(url, callback=self._on_set_image_from_url_response)

    def _on_set_image_from_url_response(self, response):
        result = self._handle_image(response.buffer, self.playlist_id)
        self.result(result)

    @validated
    def login(self, email, password, remember_me):
        email = email.strip()
        validator = Validator(immediate_exceptions=True)
        validator.add_rule(email, 'Email', email=True)

        user = self.db_session.query(model.User).filter_by(email=email).first()
        if not user:
            validator.error('No user with that email found.', 'Email')

        if not self._verify_password(password, user.password):
            validator.error('Incorrect password.', 'Password')

        # If we haven't failed out yet, the login is valid.
        self._log_user_in(user, expire_on_browser_close=(not remember_me))
        return user.user_visible_attrs

    def logout(self):
        self._log_user_out()
        return True

    @validated
    def new_playlist(self, title, description):
        title = title.strip()
        description = description.strip()
        validator = Validator(immediate_exceptions=False)
        validator.add_rule(title, 'Title', min_length=1, max_length=64)
        validator.add_rule(title, 'Description', min_length=1, max_length=64)
        validator.validate()

        playlist = model.Playlist(title)
        playlist.description = description
        self.db_session.add(playlist)
        self.db_session.commit()
        self.write(playlist.json())

    @validated_async
    @tornadorpc.async
    def signup_with_fbid(self, name, email, password, fb_id, auth_token):
        email = email.strip()
        name = name.strip()
        validator = Validator(immediate_exceptions=False)
        validator.add_rule(email, 'Email', unicode, email=True)
        validator.add_rule(name, 'Name', type=unicode, min_length=4, max_length=64)
        validator.add_rule(password, 'Password', type=unicode, min_length=6, max_length=64)
        validator.validate()

        # Make sure that FBID and email aren't already taken
        if self.db_session.query(model.User).filter_by(fb_id=fb_id).count() > 0:
            validator.error('This Facebook user is already registered on Instant.fm. Try logging in instead.')
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

    @validated_async
    def _on_fb_auth(self, user):
        validator = Validator(immediate_exceptions=True)
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
        self.db_session.commit()

        self._log_user_in(user)
        self.result(True)

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
