#!/usr/bin/python
from sqlalchemy import *
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, scoped_session
import datetime
import time
import lastfm

api_key = 'LASTFM_API_KEY_HERE'
artists_per_query = 100
seconds_between_api_queries = 0.2

""" SqlAlchemy setup """

engine = create_engine('mysql://instantfm:PASSWORD_HERE@instant.fm/instantfm', echo=False)
Base = declarative_base(bind=engine)
Session = sessionmaker(engine)

class ArtistPopularity(Base):
    __tablename__ = 'artist_popularity'

    id = Column(Integer, primary_key=True)
    name = Column(String(255))
    sortname = Column(String(255))
    listeners = Column(Integer(unsigned=True), default=None, nullable=True)
    plays = Column(Integer(unsigned=True), default=None, nullable=True)
    updated = Column(Date)
    error = Column(Boolean, default=False)
   
Base.metadata.create_all()

def main():
    api = lastfm.Api(api_key)
    
    session = Session()
    artists = session.query(ArtistPopularity).filter_by(listeners=None, plays=None, error=False)[1:1+artists_per_query]
    while artists:
        for artist in artists:
            try:
                data = api.get_artist(artist.name)
                artist.listeners = data.stats.listeners
                artist.plays = data.stats.playcount
                print ('Artist: {0}, Plays: {1}, Listeners: {2}').format(artist.name, artist.plays, artist.listeners)
            except lastfm.error.InvalidParametersError:
                artist.plays = artist.listeners = 0
                print ('Artist {0} not found.'.format(artist.name))
            except:
                artist.error = True
                print ('Artist {0} had an error.').format(artist.name)
            artist.updated = datetime.date.today()
            session.commit()
            time.sleep(seconds_between_api_queries)
        artists = session.query(ArtistPopularity).filter_by(listeners=None, plays=None, error=False)[1:1+artists_per_query]
    
if __name__ == "__main__":    
    main()
