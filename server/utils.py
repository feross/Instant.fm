import re

def urlify(name):
    name = re.sub('[^a-zA-Z0-9]+', ' ', name)
    ' '.join([word.capitalize() for word in name.split()])
    name = re.sub(' ', '-', name)
    return name


def deurlify(name):
    return name.replace('-', ' ')
    

def base36_10(alpha_id):
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

def base10_36(playlist_id):
    playlist_id = int(playlist_id)  # Make sure it's an int
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
