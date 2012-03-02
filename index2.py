#=======================================================================

__version__ = '''0.0.01'''
__sub_version__ = '''20120303021628'''
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

# XXX move this to a context-dependant module...
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
		'name': os.path.splitext(os.path.split(path)[-1])[0],
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


def common_len(a, *b):
	'''
	'''
	for i, l in enumerate(izip(*(a,) + b)):
		if len(set(l)) != 1:
			return i
	return len(min(*(a,) + b))


##!!! is this meaningless?
def path_distance(a, b):
	'''
	'''
	return len(a) + len(b) - common_len(a, b)*2





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
	failed = []
	for name, l in index.items():

		l.sort()

		raws = [e for e in l if e[2] == RAW] 

		# handle multiple raw files...
		if len(raws) > 1:
			common = common_len(*[ e[0] for e in raws ])

			# NOTE: do not change the order of raws after this point
			# 		and till the end of the loop...
			# 		XXX revise if there is a simpler way...
			##!!! this kills code like sets[0][1] += [...]
##			sets = [ (r, [r]) for r in raws ]
			sets = [ [r, [r]] for r in raws ]

			for e in l:
				if e[2] == RAW:
					continue
				# check if we are closer to other raws...
				# NOTE: this depends on stability of order in raws
				c_index = [(common_len(r[0], e[0]), r, i) for i, r in enumerate(raws)]
				c, raw, i = max(*c_index)
				# we have two locations with identical weight...
				if c_index.count([c, ANY, ANY]) > 1:
					# a file is at a path junction exactly...
					print '    !!! can\'t decide where to put %s.%s...' % (e[1], e[2])
					##!!! try different strategies here...
					##!!!
					failed += [e]
				# found a location...
				elif c > common:
					# XXX hack (se below)
##					s = sets[i][1]
##					s += [e]
					##!!! for some odd reason this does not work....
					sets[i][1] += [e]
				# file in an odd location ##!!! list these locations...
				else:
					print '    !!! can\'t decide where to put %s.%s...' % (e[1], e[2])
					##!!! try different strategies here...
					##!!!
					failed += [e]
		# single raw...
		elif len(raws) == 1:
			sets = [(raws[0], l)]
		# no raw files...
		else:
			print 'no raw file found for "%s"...' % os.path.join(name)
			sets = []
			##!!! need to report this in a usable way...
			failed += l


		for raw, l in sets:
			# get file GID...
			GID = image_gid('%s.%s' % (os.path.join(*[config['ARCHIVE_ROOT']] + raw[0] + [raw[1]]), raw[2]))

			GID_index[GID] = {
				'gid': GID,
				'name': name,
				'imported': time.time(),
				# NOTE: this might get distorted on archiving or
				# 		copying...
				# 		mostly intended for importing...
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
	
	# NOTE: raws number here may be more than indexed because some raws 
	# 		may get grouped by GID
	print '''results:
	indexed: %s
	raws: %s
	failed: %s
	''' % (len(GID_index), len([ e for e in lst if e[2] == RAW]), len(failed))

	pprint(GID_index.values()[0])


	


	



#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :
