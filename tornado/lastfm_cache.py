'''
Created on Jan 16, 2011

@author: dinkydogg
'''

import lastfm
import server

class LastfmCache(object):
    '''
    classdocs
    '''
    
    # Note: Currently using Wikileaks: The Musical's key
    api_key = '386402dfcfeedad35dd7debb343a05d5'
    api = lastfm.Api(api_key)

    def __init__(self, db_conn):
        '''
        Constructor
        '''
        self.db_con = db_conn
        
    def get_artist(self, artist_name, callback):
        # First, check database for canonical name.
        
        # If not found, fetch it asynchronously
        self.api.get_artist(artist_name, callback)
