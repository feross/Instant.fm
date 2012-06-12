#!/bin/sh
mysqldump -u instantfm --host=instant.fm --password=PASSWORD_HERE --no-data instantfm > schema.sql
