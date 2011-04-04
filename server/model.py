'''
Created on Mar 29, 2011

@author: dinkydogg
'''

import sqlalchemy.orm
import json
import base36
import options
import re


# Create object classes
class User(object):
    def get_url(self):
        return '/user/' + self.profile
    
    def to_json(self):
        return json.dumps(self.to_dict())
    
    def to_dict(self):
        return {
            "id": int(self.id),
            "name": self.name,
            "profile_url": self.get_url()
        }
        
        
class Playlist(object):
    
    def _sanitize_songs(self, songs):
        sanitized_songs = []
        
        url_re = re.compile('^(http://userserve-ak\.last\.fm/|http://images.amazon.com/images/)') 
        
        for song in songs:
            title = song['t'] if song.has_key('t') else None
            artist = song['a'] if song.has_key('a') else None
            image = song['i'] if song.has_key('i') else None
            
            if title.__class__ == unicode and artist.__class__ == unicode:
                new_song = {'a': artist, 't': title}
                if image.__class__ == unicode and url_re.match(image) is not None:
                    new_song['i'] = image
                else:
                    new_song['i'] = None
                sanitized_songs.append(new_song)
        
        return sanitized_songs
    
    @property
    def songs(self):
        return json.loads(self._songs)
    
    @songs.setter
    def songs(self, songs):
        sanitized_songs = self._sanitize_songs(songs)
        self._songs = json.dumps(sanitized_songs)
    
    def __init__(self, title):
        self.title = title
        self.songs = []
        
    def get_url(self):
        return '/p/' + base36.base10_36(self.id)
    
    def to_dict(self):
        return {
            "status": "ok",
            "id": int(self.id),
            "_url": self.get_url(),
            "title": self.title,
            "description": self.description,
            "songs": self.songs,
            "user": self.user.to_dict() if self.user is not None else None,
            "image": self.image.to_dict() if self.image is not None else None,
        }

    def to_json(self):
        return json.dumps(self.to_dict())

class Image(object):
    def to_dict(self):
        return {
            "original": self.original,
            "medium": self.medium,
        }

class Session(object):
    pass

def _setup():
    # Set up database connection

    metadata = sqlalchemy.MetaData()
    
    # Set up tables
    bg_image_constraint = sqlalchemy.ForeignKeyConstraint(['bg_image_id'], 
                                                          ['uploaded_images.id'])
    playlist_owner_constraint = sqlalchemy.ForeignKeyConstraint(['user_id'], 
                                                                ['users.id'])
    playlist_session_constraint = sqlalchemy.ForeignKeyConstraint(['session_id'], 
                                                               ['sessions.id'])
    playlists_table = sqlalchemy.Table('playlists', 
                                       metadata, 
                                       bg_image_constraint, 
                                       playlist_owner_constraint, 
                                       playlist_session_constraint,
                                       autoload=True, 
                                       autoload_with=_engine)
    
    users_table = sqlalchemy.Table('users', 
                                   metadata, 
                                   autoload=True, 
                                   autoload_with=_engine)
    
    image_owner_constraint = sqlalchemy.ForeignKeyConstraint(['user_id'], 
                                                             ['users.id'])
    image_session_constraint = sqlalchemy.ForeignKeyConstraint(['session_id'], 
                                                               ['sessions.id'])
    images_table = sqlalchemy.Table('uploaded_images', 
                                    metadata, 
                                    image_owner_constraint, 
                                    image_session_constraint,
                                    autoload=True, 
                                    autoload_with=_engine)
    
    session_owner_constraint = sqlalchemy.ForeignKeyConstraint(['user_id'], 
                                                               ['users.id'])
    sessions_table = sqlalchemy.Table('sessions', 
                                    metadata, 
                                    session_owner_constraint, 
                                    autoload=True, 
                                    autoload_with=_engine)
    
    # Set up mappings
    sqlalchemy.orm.mapper(User, users_table)
    sqlalchemy.orm.mapper(Playlist, playlists_table, properties={
        'user': sqlalchemy.orm.relationship(User, backref='playlists'),
        'session': sqlalchemy.orm.relationship(Session, backref='playlists'),
        'image': sqlalchemy.orm.relationship(Image, backref='playlists'),
    })
    sqlalchemy.orm.mapper(Image, images_table, properties={
        'user': sqlalchemy.orm.relationship(User, backref='images'),
        'session': sqlalchemy.orm.relationship(Session, backref='images'),
    })
    sqlalchemy.orm.mapper(Session, sessions_table, properties={
        'user': sqlalchemy.orm.relationship(User, backref='sessions')
    })
    

_url = 'mysql+mysqldb://{0}:{1}@instant.fm/{2}'.format(
    options.cli_args.mysql_user,
    options.cli_args.mysql_password,
    options.cli_args.mysql_database
)
_engine = sqlalchemy.create_engine(
    _url,
    pool_recycle=3600, 
    echo=True)
DbSession = sqlalchemy.orm.sessionmaker(bind=_engine)
_setup()