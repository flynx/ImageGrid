#=======================================================================

__version__ = '''0.0.01'''
__sub_version__ = '''20120302161602'''
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

import pyexiv2 as metadata

from itertools import izip, izip_longest

from pli.logictypes import ANY, OR

from pprint import pprint


#-----------------------------------------------------------------------

CONFIG_NAME = 'test_config.json'
##CONFIG_NAME = 'tmp_config.json'

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

# XXX need a strategy to check if two files that have the same GID are
# 	  identical, and if so, need to destinguish them in the GID...
# 	  might be a good idea to add a file hash
# XXX not yet sure if this is unique enough to avoid conflicts if one
# 	  photographer has enough cameras...
# XXX also might be wise to add a photographer ID into here...
def image_gid(path, format='%(artist)s-%(date)s-%(name)s', date_format='%Y%m%d-%H%M%S'):
	'''
	Calgulate image GID.

	Main gid criteria:
	 	- unique
	 	- calculable from the item (preferably any sub-item)
	 	- human-readable

	Default format:
		<artist>-<datetime>-<filename>

	Example:
		20110627-195706-DSC_1234	

	Supported fields:
		%(artist)s	- Exif.Image.Artist field, stripped and spaces replaced with underscores.
		%(date)s	- Exif.Image.DateTime formated to date_format argument.
		%(name)s	- file name.

	NOTE: date and time are the date and time the image was made ('Exif.Image.DateTime')
	NOTE: need EXIF data to generate a GID
	'''
	data = {
		'name': os.path.splitext(os.path.split(path)[-1])[0]
	}
	# check if we need a date in the id...
	if '%(date)s' in format:
		i = metadata.ImageMetadata('%s' % path)
		i.read()
		d = i['Exif.Image.DateTime'].value
		data['date'] = d.strftime(date_format)
	# check if we need an artist...
	if '%(artist)s' in format:
		data['artist'] = i['Exif.Image.Artist'].value.strip().replace(' ', '_')
	
	return format % data


##!!! we will need to normalize the paths to one single scheme (either relative or absolute)...
# XXX might need to fetch file data too...
def list_files(root, sub_trees=SUBTREE_CLASSES, type=ITEM, include_root_path=False, include_ctime=True):
	'''
	yields:
		(<path>, <name>, <ext>[, <ctime>]),
	'''
	for orig_path, dirs, files in os.walk(root):
		# XXX is this correct...
		path = orig_path.split(os.path.sep)
		# remove root from path...
		if not include_root_path:
			path = path[len(root.split(os.path.sep)):]
		# process files...
		for f in files:
			name, ext = os.path.splitext(f)
			# we need the extension wothout the dot...
			ext = ext[1:]
			# filter by ext...
			if ext == type:
				if include_ctime:
					t = os.path.getctime(os.path.join(orig_path, f))
					yield path, name, ext, t
				else:
					yield path, name, ext




#-----------------------------------------------------------------------
if __name__ == '__main__':

	FILE_LIST = os.path.join('test', 'flatfilelist.json')
	BUILD_FILE_LIST = False if os.path.exists(FILE_LIST) else True


	if BUILD_FILE_LIST:
		lst = list(list_files(config['ARCHIVE_ROOT']))
	
		print len(lst)
		pprint(lst[0])
	
		json.dump(lst, file(FILE_LIST, 'w'))

	lst = json.load(file(FILE_LIST))
	print len(lst)

	# sort via name, ext, path
	lst.sort(key=lambda e: (e[1], e[2], e[0]))

	# index by name (indexing preparation)...
	# {
	# 	<name> : [
	# 		(<path>, <name>, <type>),
	# 		...
	# 	],
	# 	...
	# }
	index = {}
	for p, n, t, c in lst:
		if n in index:
			index[n] += [(p, n, t, c)]
		else:
			index[n] = [(p, n, t, c)]

	# index via a propper GID...
	# split similarly named but different files...
	GID_index = {}
	for name, l in index.items():

		l.sort()

		raws = [e for e in l if e[2] == RAW] 

		for raw in raws:
			if len(raws) > 1:
				print 'duplicates: %s (%sx)...' % (name, len(raws)),
				# split the group into c seporate groups...
				# strategies:
				# 	- path proximity (distance)
				# 	- metadata
				##!!!
				print 'skipping.'
				break
			# get file GID...
			GID = image_gid('%s.%s' % (os.path.join(*[config['ARCHIVE_ROOT']] + raw[0] + [raw[1]]), raw[2]))

			GID_index[GID] = {
				'gid': GID,
				'name': name,
				'imported': time.time(),
				# NOTE: this might get distorted on archiving...
				'ctime': raw[3], 
				'RAW': raws,
				'XMP': [e for e in l if e[2] == XMP],
				'JPG': [e for e in l if e[2] == JPEG],
				'PSD': [e for e in l if e[2] == PSD],
				'TIFF': [e for e in l if e[2] == TIFF],
				'other': [e for e in l if e[2] != OR(TIFF, PSD, JPEG, XMP, RAW)],
			}


	##!!! TODO: archive descriptions to help index/tag items...

	# NOTE: each import from an existing archive will be as follows:
	# 			- full listing
	# 			- find new subtrees
	# 			- find modified items (file date diff)
	

	print GID
	print len(GID_index), len([ e for e in lst if e[2] == RAW])

	pprint(GID_index.values()[0])


	


	



#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :
