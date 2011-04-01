'''
Created on Mar 29, 2011

@author: dinkydogg
'''

import sqlalchemy.orm
import json
import base36

# Set up database connection
engine = sqlalchemy.create_engine(
    'mysql+mysqldb://instantfm:CXZrPkkJEgk7lAZMnzbk5hb9g@instant.fm/instantfm',
    pool_recycle=3600, 
    echo=True)
metadata = sqlalchemy.MetaData()
DbSession = sqlalchemy.orm.sessionmaker(bind=engine)

# Set up tables
bg_image_constraint = sqlalchemy.ForeignKeyConstraint(['bg_image_id'], 
                                                      ['uploaded_images.id'])
playlist_owner_constraint = sqlalchemy.ForeignKeyConstraint(['user_id'], 
                                                            ['users.id'])
playlists_table = sqlalchemy.Table('playlists', 
                                   metadata, 
                                   bg_image_constraint, 
                                   playlist_owner_constraint, 
                                   autoload=True, 
                                   autoload_with=engine)

users_table = sqlalchemy.Table('users', 
                               metadata, 
                               autoload=True, 
                               autoload_with=engine)

image_owner_constraint = sqlalchemy.ForeignKeyConstraint(['user_id'], 
                                                         ['users.id'])
images_table = sqlalchemy.Table('uploaded_images', 
                                metadata, 
                                image_owner_constraint, 
                                autoload=True, 
                                autoload_with=engine)

session_owner_constraint = sqlalchemy.ForeignKeyConstraint(['user_id'], 
                                                           ['users.id'])
sessions_table = sqlalchemy.Table('sessions', 
                                metadata, 
                                session_owner_constraint, 
                                autoload=True, 
                                autoload_with=engine)

# Create object classes
class User(object):
    def get_url(self):
        return '/user/' + self.profile
    
    def to_dict(self):
        return {
            "id": int(self.id),
            "name": self.name,
            "profile_url": self.get_url()
        }
        
        
class Playlist(object):
    def __init__(self, title):
        self.title = title
        
    def get_url(self):
        return '/p/' + base36.base10_36(self.id)
    
    def to_dict(self):
        return {
            "status": "ok",
            "id": int(self.id),
            "url": self.get_url(),
            "title": self.title,
            "description": self.description,
            "songs": json.loads(self.songs),
            "user": self.user.to_dict(),
            "image": self.image.to_dict(),
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

# Set up mappings
sqlalchemy.orm.mapper(User, users_table)
sqlalchemy.orm.mapper(Playlist, playlists_table, properties={
    'user': sqlalchemy.orm.relationship(User, backref='playlists'),
    'image': sqlalchemy.orm.relationship(Image, backref='playlists'),
})
sqlalchemy.orm.mapper(Image, images_table, properties={
    'user': sqlalchemy.orm.relationship(User, backref='images')
})
sqlalchemy.orm.mapper(Session, sessions_table, properties={
    'user': sqlalchemy.orm.relationship(User, backref='sessions')
})
