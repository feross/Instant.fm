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
    @property
    def url(self):
        return '/user/' + self.profile
    
    @property
    def json(self):
        return json.dumps(self.user_visible_properties())
    
    @property
    def user_visible_properties(self):
        return {
            "id": int(self.id),
            "name": self.name,
            "profile_url": self.url
        }
        
        
class Playlist(object):
    
    def __init__(self, title):
        self.title = title
        self.songs = []
     
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
       
    @property
    def url(self):
        return '/p/' + base36.base10_36(self.id)
    
    @property
    def user_visible_properties(self):
        return {
            "status": "ok",
            "id": int(self.id),
            "url": self.url,
            "title": self.title,
            "description": self.description,
            "songs": self.songs,
            "user": self.user.user_visible_properties if self.user is not None else None,
            "image": self.image.user_visible_properties if self.image is not None else None,
        }

    @property
    def json(self):
        return json.dumps(self.user_visible_properties)

class Image(object):
    @property
    def user_visible_properties(self):
        return {
            "original": self.original,
            "medium": self.medium,
        }

class Session(object):
    pass

def _setup():
    metadata = sqlalchemy.MetaData()
    
    # Set up tables
    constraints = (
        sqlalchemy.ForeignKeyConstraint(['bg_image_id'], ['images.id']),
        sqlalchemy.ForeignKeyConstraint(['user_id'], ['users.id']),
        sqlalchemy.ForeignKeyConstraint(['session_id'], ['sessions.id'])
    )
    playlists_table = sqlalchemy.Table('playlists', 
                                       metadata, 
                                       *constraints,
                                       autoload=True, 
                                       autoload_with=_engine)
    
    users_table = sqlalchemy.Table('users', 
                                   metadata, 
                                   autoload=True, 
                                   autoload_with=_engine)
    
    constraints = (
        sqlalchemy.ForeignKeyConstraint(['user_id'], ['users.id']), 
        sqlalchemy.ForeignKeyConstraint(['session_id'], ['sessions.id'])
    )
    images_table = sqlalchemy.Table('images', 
                                    metadata, 
                                    *constraints,
                                    autoload=True, 
                                    autoload_with=_engine)
    
    constraint = sqlalchemy.ForeignKeyConstraint(['user_id'], ['users.id'])
    sessions_table = sqlalchemy.Table('sessions', 
                                    metadata, 
                                    constraint, 
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