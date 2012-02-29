#=======================================================================

__version__ = '''0.0.01'''
__sub_version__ = '''20120229165907'''
__copyright__ = '''(c) Alex A. Naanou 2011'''


#-----------------------------------------------------------------------
# The first index.py might be a little too complicated. try and resolve
# this as so:
# 	- list all relevant files (RAW, XMP, JPG, PSD, ...)
# 	- group by path (closeness)
# 		- deepest common path to contain all files with common name.
# 		  this will fail if we have different files with same names.
#
#-----------------------------------------------------------------------

import os
import json
import zipfile
import uuid
import time

from itertools import izip, izip_longest

from pli.logictypes import ANY, OR

from pprint import pprint


#-----------------------------------------------------------------------

##CONFIG_NAME = 'test_config.json'
CONFIG_NAME = 'tmp_config.json'

config = json.load(open(CONFIG_NAME))

RAW = OR(
	'NEF', 'nef', 
	'CRW', 'crw',
	'CR2', 'cr2',
	'X3F', 'x3f'
)

JPEG = OR(
	'JPG', 'jpg', 
	'JPEG', 'jpeg'
)

PSD = OR(
	'PSD', 'psd'
)

TIFF = OR(
	'TIFF', 'tiff', 
	'TIF', 'tif'
)

XMP = OR(
	'XMP', 'xmp'
)

ITEM = OR(RAW, JPEG, PSD, TIFF, XMP)

TYPES = {
	'raw': RAW,
	'jpeg': JPEG,
	'psd': PSD,
	'tiff': TIFF,
	'xmp': XMP,
}


SUBTREE_CLASSES = {
	'preview': 'preview', 
	'preview (RAW)': 'RAW preview', 
}


#-----------------------------------------------------------------------

##!!! we will need to normalize the paths to one single scheme (either relative or absolute)...
def list_files(root, sub_trees=SUBTREE_CLASSES, type=ITEM, include_root_path=False):
	'''
	yields:
		(<path>, <name>, <ext>),
	'''
	for path, dirs, files in os.walk(root):
		# XXX is this correct...
		path = path.split(os.path.sep)
		# process files...
		for f in files:
			name, ext = os.path.splitext(f)
			# we need the extension wothout the dot...
			ext = ext[1:]
			# filter by ext...
			if ext == type:
				if not include_root_path:
					yield path[len(root.split(os.path.sep)):], name, ext
				else:
					yield path, name, ext




#-----------------------------------------------------------------------
if __name__ == '__main__':
##	lst = list(list_files(config['ARCHIVE_ROOT']))
##
##	print len(lst)
##	pprint(lst[0])
##
##	json.dump(lst, file(os.path.join('test', 'flatfilelist.json'), 'w'))

	lst = json.load(file(os.path.join('test', 'flatfilelist.json')))
	print len(lst)

##	lst.sort()
	# sort via name, ext, path
	lst.sort(key=lambda e: (e[1], e[-1], e[0]))

	##!!! duplicate a raw file...
	for p, n, t in lst:
		if t == RAW:
			lst += [(p, n, t)]
			break

	# index by name (indexing preparation)...
	# {
	# 	<name> : [
	# 		(<path>, <name>, <type>),
	# 		...
	# 	],
	# 	...
	# }
	index = {}
	for p, n, t in lst:
		if n in index:
			index[n] += [(p, n, t)]
		else:
			index[n] = [(p, n, t)]

	# index via a propper GID...
	# split similarly named but different files...
	GID_index = {}
	for name, l in index.items():

		##!!! gid construction should be a customizable function in itself...
		# main gid criteria:
		# 	- unique
		# 	- calculable from the item (preferably any sub-item)
##		GID = '%s-%s' % (uuid.uuid4().hex, name)
		##!!! get RAW file creation date from EXIF...
		GID = '%s-%s' % (hex(long(time.time()*1000))[2:-1], name)

		l.sort()

		raws = [e for e in l if e[-1] == RAW] 
		if len(raws) > 1:
			# split the group into c seporate groups...
			# strategies:
			# 	- path proximity (distance)
			# 	- metadata
			##!!!
			print 'duplicates: %s (%sx)' % (name, len(raws))
##			raise TypeError, 'found %s RAW files with identical names (%s).' % (len(raws), name)
		else:
			GID_index[GID] = {
				'gid': GID,
				'name': name,
				'RAW': raws,
				'XMP': [e for e in l if e[-1] == XMP],
				'JPG': [e for e in l if e[-1] == JPEG],
				'PSD': [e for e in l if e[-1] == PSD],
				'TIFF': [e for e in l if e[-1] == TIFF],
				'other': [e for e in l if e[-1] != OR(TIFF, PSD, JPEG, XMP, RAW)],
			}
	
	print len(GID_index), GID


	


	



#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :
