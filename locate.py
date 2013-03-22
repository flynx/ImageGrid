#=======================================================================

__version__ = '''0.0.01'''
__sub_version__ = '''20130322144912'''
__copyright__ = '''(c) Alex A. Naanou 2011'''


#-----------------------------------------------------------------------

import os
import json
from pprint import pprint

import gid
import store


#-----------------------------------------------------------------------

CONFIG_NAME = 'P7000_config.json'


#-----------------------------------------------------------------------


#-----------------------------------------------------------------------
if __name__ == '__main__':
	from optparse import OptionParser

	QUERY = 'PSD'

	config = json.load(open(CONFIG_NAME))
	INDEX_PATH = config.get('INDEX_ROOT', os.path.join('test', 'index2'))
	ARCHIVE_ROOT = config.get('ARCHIVE_ROOT', '')

	parser = OptionParser()

	##!!! need to define the path so that it shoes up in -h

	options, args = parser.parse_args()

	if len(args) != 1:
		parser.print_usage()
	else:
		IN_PATH = args[0]
		IN_PATH = IN_PATH.replace('\\', '/')

		guid = gid.image_gid(IN_PATH)

		index = store.Index(INDEX_PATH)

		for p in index[guid][QUERY]:
			path, name, ext, date = p
			print '%s\\%s.%s' % ('\\'.join([ARCHIVE_ROOT] + path), name, ext)




#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :
