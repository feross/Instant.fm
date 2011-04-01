'''
Created on Mar 29, 2011

@author: dinkydogg
'''

import sqlalchemy.orm

# Set up database connection
engine = sqlalchemy.create_engine('mysql+mysqldb://instantfm:CXZrPkkJEgk7lAZMnzbk5hb9g@instant.fm/instantfm', pool_recycle=3600)
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
    pass

class Playlist(object):
    def __init__(self, title):
        self.title = title

class Image(object):
    pass

class Session(object):
    pass

# Set up mappings
sqlalchemy.orm.mapper(User, users_table)
sqlalchemy.orm.mapper(Playlist, playlists_table, properties={
    'user': sqlalchemy.orm.relationship(User, backref='playlists')
})
sqlalchemy.orm.mapper(Image, images_table, properties={
    'user': sqlalchemy.orm.relationship(User, backref='images')
})
sqlalchemy.orm.mapper(Session, sessions_table, properties={
    'user': sqlalchemy.orm.relationship(User, backref='sessions')
})
